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
 * Embeddings are cached in tmp/, so reruns cost nothing. Needs Docker. See
 * evals/lib for the local index and the OpenAI access (key or proxy).
 */
import fs from 'node:fs';
import path from 'node:path';
import { getCosmeticRagPolicy } from '../../src/lib/ragRetrievalPolicy.js';
import { queryKnowledgeBaseI18n, type RetrievalBackend } from '../../src/lib/unifiedRetrieval.js';
import type { RAGResult } from '../../src/lib/rag.js';
import { createModelClient } from '../lib/modelClient.js';
import { buildChunks, EmbeddingCache, LocalIndex, productIdFor, REPO_ROOT, SHOP_ID, type EvalProduct } from '../lib/localIndex.js';

const REPORT_FILE = path.join(REPO_ROOT, 'tmp/rag-retrieval-eval.json');

// Thresholds getCosmeticRagPolicy returned before migration 049.
const BASELINE_THRESHOLDS: Record<string, number> = {
  ingredients: 0.62,
  usage: 0.58,
  warnings: 0.55,
  specs: 0.65,
  default: 0.6,
};

type Fixture = {
  products: EvalProduct[];
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
const productIdByKey = new Map(fixture.products.map((product) => [product.key, productIdFor(fixture.products, product.key)]));
const index = new LocalIndex('recete-rag-eval');
const embeddings = new EmbeddingCache();

const backend: RetrievalBackend = {
  embed: async (query) => embeddings.get(query),
  rpc: (name, params) => index.rpc(name, params),
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
  const chunks = buildChunks(fixture.products);
  const client = createModelClient();
  await embeddings.ensure([...chunks.map((c) => c.text), ...fixture.cases.map((c) => c.question)], client);
  client.close();

  index.start();
  for (const file of index.chunkIndexMigrations().filter((file) => Number(file.slice(0, 3)) <= 44)) {
    index.applyMigration(file);
  }
  index.loadChunks(fixture.products, chunks, embeddings);
  const baseline = await runVariant('baseline');

  const later = index.chunkIndexMigrations(44);
  later.forEach((file) => index.applyMigration(file));
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
  index.stop();
}

main().catch((error) => {
  console.error(error);
  index.stop();
  process.exit(1);
});
