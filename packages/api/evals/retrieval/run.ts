/**
 * Retrieval eval: runs production retrieval (queryKnowledgeBaseI18n, the RRF
 * fusion and rerank, getCosmeticRagPolicy) against a throwaway Postgres with
 * pgvector and the real SQL functions from supabase/migrations, over the
 * fictional products and questions in fixtures.json.
 *
 *   OPENAI_API_KEY=... pnpm --filter @recete/api eval:retrieval
 *
 * Two variants run on the same chunks:
 *   baseline  migrations up to 044 (all-terms 'simple' keyword search) and the
 *             similarity thresholds the policy used before 049 (0.55-0.65)
 *   current   every migration (049: any-term, language-aware keyword search)
 *             and the policy as it is in the code now
 *
 * Embeddings (text-embedding-3-small, as in production) are cached in
 * tmp/rag-eval-embeddings.json, so reruns cost nothing. Needs Docker.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { chunkText } from '../../src/lib/embeddings.js';
import { buildSectionedChunkDocs } from '../../src/lib/multiLangRag/chunkShadowWriteService.js';
import { buildProductI18nSourceSnapshot } from '../../src/lib/multiLangRag/productI18nSnapshot.js';
import { getCosmeticRagPolicy } from '../../src/lib/ragRetrievalPolicy.js';
import { queryKnowledgeBaseI18n, type RetrievalBackend } from '../../src/lib/unifiedRetrieval.js';
import type { RAGResult } from '../../src/lib/rag.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');
const MIGRATIONS = path.join(REPO_ROOT, 'supabase/migrations');
const CACHE_FILE = path.join(REPO_ROOT, 'tmp/rag-eval-embeddings.json');
const REPORT_FILE = path.join(REPO_ROOT, 'tmp/rag-retrieval-eval.json');
const CONTAINER = 'recete-rag-eval';
const IMAGE = 'pgvector/pgvector:pg17';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const SHOP_ID = '00000000-0000-4000-8000-000000000001';

// Thresholds getCosmeticRagPolicy returned before migration 049.
const BASELINE_THRESHOLDS: Record<string, number> = {
  ingredients: 0.62,
  usage: 0.58,
  warnings: 0.55,
  specs: 0.65,
  default: 0.6,
};

type Fixture = {
  products: Array<{
    key: string;
    lang: string;
    name: string;
    description: string;
    usage_instructions?: string;
    prevention_tips?: string;
  }>;
  cases: Array<{
    id: string;
    lang: string;
    scope: 'product' | 'none';
    product: string | null;
    question: string;
    expect: { anyOf: string[] } | null;
  }>;
};

const fixture: Fixture = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'fixtures.json'), 'utf8'),
);
const productIdByKey = new Map(
  fixture.products.map((product, index) => [
    product.key,
    `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
  ]),
);

// ---------- Postgres in Docker ----------

function docker(args: string[], input?: string): string {
  return execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}

function psql(sql: string, database = 'eval'): string {
  return docker(
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', database, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'],
    sql,
  ).trim();
}

function startDatabase() {
  try {
    docker(['rm', '-f', CONTAINER]);
  } catch {
    // Not running.
  }
  docker(['run', '-d', '--name', CONTAINER, '-e', 'POSTGRES_PASSWORD=eval', IMAGE]);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      docker(['exec', CONTAINER, 'pg_isready', '-U', 'postgres']);
      psql('select 1', 'postgres');
      break;
    } catch {
      execFileSync('sleep', ['1']);
    }
  }
  psql('create database eval', 'postgres');
  // Stubs for the tables the chunk index references.
  psql(`
    create extension if not exists vector;
    create table merchants (id uuid primary key);
    create table products (id uuid primary key, merchant_id uuid, name text, url text);
    -- Legacy chunk table: migration 044 indexes it; the eval doesn't fill it.
    create table knowledge_chunks (id uuid primary key default gen_random_uuid(), product_id uuid, chunk_text text, chunk_index int, embedding vector(1536));
  `);
}

function applyMigration(file: string) {
  psql(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
}

// ---------- Embeddings with a local cache ----------

const cache: Record<string, number[]> = fs.existsSync(CACHE_FILE)
  ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  : {};
const cacheKey = (text: string) => crypto.createHash('sha256').update(`${EMBEDDING_MODEL}\u0000${text}`).digest('hex');

async function embedAll(texts: string[]) {
  const missing = [...new Set(texts)].filter((text) => !cache[cacheKey(text)]);
  if (missing.length > 0) {
    // RAG_EVAL_EMBED_CMD: a command that reads a JSON array of texts on stdin and
    // prints a JSON array of vectors, for embedding where the API key lives
    // instead of copying it to this machine.
    const embedCommand = process.env.RAG_EVAL_EMBED_CMD;
    const client = embedCommand ? null : new OpenAI();
    for (let i = 0; i < missing.length; i += 100) {
      const batch = missing.slice(i, i + 100);
      const vectors: number[][] = embedCommand
        ? JSON.parse(execFileSync('sh', ['-c', embedCommand], { input: JSON.stringify(batch), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }))
        : (await client!.embeddings.create({ model: EMBEDDING_MODEL, input: batch })).data.map((item) => item.embedding);
      batch.forEach((text, index) => {
        cache[cacheKey(text)] = vectors[index];
      });
    }
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  }
}

const embeddingOf = (text: string) => {
  const vector = cache[cacheKey(text)];
  if (!vector) throw new Error(`No embedding for: ${text.slice(0, 40)}`);
  return vector;
};

// ---------- Index the fixture products the way production does ----------

function buildChunks() {
  return fixture.products.flatMap((product) => {
    const snapshot = buildProductI18nSourceSnapshot({
      name: product.name,
      raw_text: product.description,
      enriched_text: null,
      product_instructions: {
        usage_instructions: product.usage_instructions || null,
        prevention_tips: product.prevention_tips || null,
      },
    });
    const docs = buildSectionedChunkDocs({
      product_id: productIdByKey.get(product.key)!,
      lang: product.lang,
      title: snapshot.title,
      description_html: snapshot.description_html,
      specs_json: snapshot.specs_json,
      faq_json: snapshot.faq_json,
    });
    return docs
      .flatMap((doc) => chunkText(doc.text, 1000, 150).map((chunk) => ({ doc, chunk })))
      .map(({ doc, chunk }, index) => ({
        productKey: product.key,
        lang: product.lang,
        section: doc.sectionType,
        sourceKind: doc.sourceKind,
        index,
        text: chunk.text,
      }));
  });
}

const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`;
const sqlVector = (vector: number[]) => `'[${vector.join(',')}]'::vector`;

function loadChunks(chunks: ReturnType<typeof buildChunks>) {
  const productRows = fixture.products
    .map((p) => `(${sqlText(productIdByKey.get(p.key)!)}, ${sqlText(SHOP_ID)}, ${sqlText(p.name)}, '')`)
    .join(',');
  const chunkRows = chunks
    .map(
      (c) =>
        `(${sqlText(SHOP_ID)}, ${sqlText(productIdByKey.get(c.productKey)!)}, ${sqlText(c.lang)}, ${sqlText(c.lang)}, ` +
        `${sqlText(EMBEDDING_MODEL)}, ${sqlText(c.text)}, ${sqlVector(embeddingOf(c.text))}, ${c.index}, ` +
        `${sqlText(c.section)}, ${sqlText(c.section)}, ${sqlText(c.sourceKind)}, ${sqlText(c.sourceKind)}, ` +
        `${sqlText(crypto.createHash('sha256').update(c.text).digest('hex'))})`,
    )
    .join(',\n');
  psql(`
    insert into merchants values (${sqlText(SHOP_ID)});
    insert into products values ${productRows};
    insert into knowledge_chunks_i18n
      (shop_id, product_id, lang, language_code, embedding_model, chunk_text, embedding, chunk_index,
       section_type, chunk_type, source_kind, source_type, content_hash)
    values ${chunkRows};
  `);
}

// ---------- Retrieval backend over the local database ----------

function sqlParam(name: string, value: unknown): string {
  if (value === null || value === undefined) {
    if (name.endsWith('_ids')) return 'null::uuid[]';
    if (name.endsWith('_types')) return 'null::text[]';
    return 'null';
  }
  if (name.endsWith('embedding')) return sqlVector(JSON.parse(String(value)));
  if (Array.isArray(value)) return `array[${value.map((v) => sqlText(String(v))).join(',')}]::uuid[]`;
  if (typeof value === 'number') return String(value);
  if (name === 'p_shop_id' || name === 'match_merchant_id') return `${sqlText(String(value))}::uuid`;
  return sqlText(String(value));
}

const backend: RetrievalBackend = {
  embed: async (query) => embeddingOf(query),
  rpc: async (name, params) => {
    const args = Object.entries(params)
      .map(([key, value]) => `${key} => ${sqlParam(key, value)}`)
      .join(', ');
    try {
      const out = psql(`select coalesce(json_agg(t), '[]'::json) from public.${name}(${args}) t;`);
      return { data: JSON.parse(out), error: null };
    } catch (error) {
      // e.g. the legacy match_knowledge_chunks table, which the eval doesn't build.
      return { data: null, error: { message: error instanceof Error ? error.message.split('\n')[0] : String(error) } };
    }
  },
  productPresentation: async (_merchantId, ids) =>
    new Map(
      fixture.products
        .filter((p) => ids.includes(productIdByKey.get(p.key)!))
        .map((p) => [productIdByKey.get(p.key)!, { name: p.name, url: '' }]),
    ),
};

// ---------- Run and score ----------

const normalize = (value: string) =>
  value.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ');

type CaseResult = {
  id: string;
  lang: string;
  scope: string;
  offCatalogue: boolean;
  hit: boolean;
  firstHitRank: number | null;
  rightProductFirst: boolean;
  empty: boolean;
  resultCount: number;
  topSimilarity: number;
  top: Array<{ product: string; section: string | null | undefined; similarity: number }>;
};

async function runVariant(variant: 'baseline' | 'current'): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const testCase of fixture.cases) {
    const policy = getCosmeticRagPolicy(testCase.question);
    const expectedId = testCase.product ? productIdByKey.get(testCase.product)! : null;
    const retrieved = await queryKnowledgeBaseI18n(
      {
        merchantId: SHOP_ID,
        question: testCase.question,
        userLang: testCase.lang,
        languageCode: testCase.lang,
        productIds: testCase.scope === 'product' && expectedId ? [expectedId] : undefined,
        topK: policy.topK,
        similarityThreshold:
          variant === 'baseline'
            ? BASELINE_THRESHOLDS[policy.profile]
            : Number(process.env.RAG_EVAL_THRESHOLD || policy.similarityThreshold),
        preferredSectionTypes: policy.preferredSectionTypes,
      },
      backend,
    );
    const rows: RAGResult[] = retrieved.results;
    const isHit = (row: RAGResult) =>
      Boolean(testCase.expect) &&
      row.productId === expectedId &&
      testCase.expect!.anyOf.some((needle) => normalize(row.chunkText).includes(normalize(needle)));
    const firstHit = rows.findIndex(isHit);
    const keyById = new Map([...productIdByKey].map(([key, id]) => [id, key]));
    results.push({
      id: testCase.id,
      lang: testCase.lang,
      scope: testCase.scope,
      offCatalogue: !testCase.expect,
      hit: firstHit >= 0,
      firstHitRank: firstHit >= 0 ? firstHit + 1 : null,
      rightProductFirst: Boolean(expectedId) && rows[0]?.productId === expectedId,
      empty: rows.length === 0,
      resultCount: rows.length,
      topSimilarity: Math.max(0, ...rows.map((row) => Number(row.similarity || 0))),
      top: rows.slice(0, 3).map((row) => ({
        product: keyById.get(row.productId) || row.productId,
        section: row.sectionType,
        similarity: Number(Number(row.similarity || 0).toFixed(3)),
      })),
    });
  }
  return results;
}

function summarize(results: CaseResult[]) {
  const scored = results.filter((r) => !r.offCatalogue);
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '-');
  const group = (filter: (r: CaseResult) => boolean) => {
    const rows = scored.filter(filter);
    return `${pct(rows.filter((r) => r.hit).length, rows.length)} (${rows.filter((r) => r.hit).length}/${rows.length})`;
  };
  const unscoped = scored.filter((r) => r.scope === 'none');
  const mrr = scored.reduce((sum, r) => sum + (r.firstHitRank ? 1 / r.firstHitRank : 0), 0) / (scored.length || 1);
  const off = results.filter((r) => r.offCatalogue);
  return {
    'evidence found (hit@K)': group(() => true),
    '  product known': group((r) => r.scope === 'product'),
    '  no product context': group((r) => r.scope === 'none'),
    '  tr': group((r) => r.lang === 'tr'),
    '  en': group((r) => r.lang === 'en'),
    '  hu': group((r) => r.lang === 'hu'),
    'MRR': mrr.toFixed(2),
    'right product ranked first (no context)': pct(unscoped.filter((r) => r.rightProductFirst).length, unscoped.length),
    'empty retrievals': pct(scored.filter((r) => r.empty).length, scored.length),
    'off-catalogue: results returned': off.map((r) => `${r.id}=${r.resultCount}@${r.topSimilarity.toFixed(2)}`).join(' '),
  };
}

async function main() {
  const chunks = buildChunks();
  await embedAll([...chunks.map((c) => c.text), ...fixture.cases.map((c) => c.question)]);

  startDatabase();
  for (const file of ['030_multi_lang_chunk_shadow_index.sql', '031_multi_lang_chunk_shadow_retrieval.sql', '044_knowledge_chunks_lexical_search.sql']) {
    applyMigration(file);
  }
  loadChunks(chunks);
  const baseline = await runVariant('baseline');

  const later = fs
    .readdirSync(MIGRATIONS)
    .filter((file) => /^\d{3}_/.test(file) && Number(file.slice(0, 3)) > 44)
    .filter((file) => fs.readFileSync(path.join(MIGRATIONS, file), 'utf8').includes('knowledge_chunks_i18n'))
    .sort();
  later.forEach(applyMigration);
  const current = await runVariant('current');

  const summaryBaseline = summarize(baseline);
  const summaryCurrent = summarize(current);
  console.log(`\nRetrieval eval: ${fixture.products.length} products, ${chunks.length} chunks, ${fixture.cases.length} questions`);
  console.log(`Migrations applied for "current": ${later.join(', ') || '(none after 044)'}\n`);
  const width = Math.max(...Object.keys(summaryBaseline).map((k) => k.length));
  console.log(`${'metric'.padEnd(width)} | baseline | current`);
  for (const key of Object.keys(summaryBaseline) as Array<keyof typeof summaryBaseline>) {
    if (key.startsWith('off-catalogue')) continue;
    console.log(`${key.padEnd(width)} | ${String(summaryBaseline[key]).padEnd(8)} | ${summaryCurrent[key]}`);
  }
  console.log(`\noff-catalogue (count@top similarity)\n  baseline: ${summaryBaseline['off-catalogue: results returned']}\n  current:  ${summaryCurrent['off-catalogue: results returned']}`);
  const misses = current.filter((r) => !r.offCatalogue && !r.hit);
  console.log(`\nStill missed in current (${misses.length}): ${misses.map((r) => r.id).join(', ') || 'none'}`);

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify({ summaryBaseline, summaryCurrent, baseline, current }, null, 2));
  console.log(`\nPer-case report: ${path.relative(REPO_ROOT, REPORT_FILE)}`);
  docker(['rm', '-f', CONTAINER]);
}

main().catch((error) => {
  console.error(error);
  try {
    docker(['rm', '-f', CONTAINER]);
  } catch {
    // Already gone.
  }
  process.exit(1);
});
