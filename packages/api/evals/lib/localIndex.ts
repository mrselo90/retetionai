/**
 * A throwaway Postgres + pgvector (Docker) holding the multilingual chunk
 * index for the eval products, built the way production builds it, with the
 * real SQL functions from supabase/migrations. Shared by the retrieval and the
 * answer evals.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chunkText } from '../../src/lib/embeddings.js';
import { buildSectionedChunkDocs } from '../../src/lib/multiLangRag/chunkShadowWriteService.js';
import { buildProductI18nSourceSnapshot } from '../../src/lib/multiLangRag/productI18nSnapshot.js';
import type { ModelClient } from './modelClient.js';

export const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');
const MIGRATIONS = path.join(REPO_ROOT, 'supabase/migrations');
const CACHE_FILE = path.join(REPO_ROOT, 'tmp/rag-eval-embeddings.json');
const IMAGE = 'pgvector/pgvector:pg17';
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const SHOP_ID = '00000000-0000-4000-8000-000000000001';

export type EvalProduct = {
  key: string;
  lang: string;
  name: string;
  description: string;
  usage_instructions?: string;
  prevention_tips?: string;
};

export const productIdFor = (products: EvalProduct[], key: string) => {
  const index = products.findIndex((product) => product.key === key);
  if (index < 0) throw new Error(`Unknown eval product: ${key}`);
  return `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`;
};

// ---------- Postgres in Docker ----------

function docker(args: string[], input?: string): string {
  return execFileSync('docker', args, {
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export class LocalIndex {
  constructor(private container: string) {}

  psql(sql: string, database = 'eval'): string {
    return docker(
      ['exec', '-i', this.container, 'psql', '-U', 'postgres', '-d', database, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'],
      sql,
    ).trim();
  }

  start() {
    this.stop();
    docker(['run', '-d', '--name', this.container, '-e', 'POSTGRES_PASSWORD=eval', IMAGE]);
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        docker(['exec', this.container, 'pg_isready', '-U', 'postgres']);
        this.psql('select 1', 'postgres');
        break;
      } catch {
        execFileSync('sleep', ['1']);
      }
    }
    this.psql('create database eval', 'postgres');
    // Stubs for the tables the chunk index references.
    this.psql(`
      create extension if not exists vector;
      create table merchants (id uuid primary key);
      create table products (id uuid primary key, merchant_id uuid, name text, url text);
      -- Legacy chunk table: migration 044 indexes it; the evals don't fill it.
      create table knowledge_chunks (id uuid primary key default gen_random_uuid(), product_id uuid, chunk_text text, chunk_index int, embedding vector(1536));
    `);
  }

  stop() {
    try {
      docker(['rm', '-f', this.container]);
    } catch {
      // Not running.
    }
  }

  applyMigration(file: string) {
    this.psql(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
  }

  /** Every migration that touches the chunk index, optionally only those after `afterNumber`. */
  chunkIndexMigrations(afterNumber = 0): string[] {
    return fs
      .readdirSync(MIGRATIONS)
      .filter((file) => /^\d{3}_/.test(file) && Number(file.slice(0, 3)) > afterNumber)
      .filter((file) => fs.readFileSync(path.join(MIGRATIONS, file), 'utf8').includes('knowledge_chunks_i18n'))
      .sort();
  }

  loadChunks(products: EvalProduct[], chunks: Chunk[], embeddings: EmbeddingCache) {
    const productRows = products
      .map((p) => `(${sqlText(productIdFor(products, p.key))}, ${sqlText(SHOP_ID)}, ${sqlText(p.name)}, '')`)
      .join(',');
    const chunkRows = chunks
      .map(
        (c) =>
          `(${sqlText(SHOP_ID)}, ${sqlText(productIdFor(products, c.productKey))}, ${sqlText(c.lang)}, ${sqlText(c.lang)}, ` +
          `${sqlText(EMBEDDING_MODEL)}, ${sqlText(c.text)}, ${sqlVector(embeddings.get(c.text))}, ${c.index}, ` +
          `${sqlText(c.section)}, ${sqlText(c.section)}, ${sqlText(c.sourceKind)}, ${sqlText(c.sourceKind)}, ` +
          `${sqlText(crypto.createHash('sha256').update(c.text).digest('hex'))})`,
      )
      .join(',\n');
    this.psql(`
      insert into merchants values (${sqlText(SHOP_ID)});
      insert into products values ${productRows};
      insert into knowledge_chunks_i18n
        (shop_id, product_id, lang, language_code, embedding_model, chunk_text, embedding, chunk_index,
         section_type, chunk_type, source_kind, source_type, content_hash)
      values ${chunkRows};
    `);
  }

  /** A Supabase-style rpc() over the local database. */
  async rpc(name: string, params: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> {
    const args = Object.entries(params)
      .map(([key, value]) => `${key} => ${sqlParam(key, value)}`)
      .join(', ');
    try {
      const out = this.psql(`select coalesce(json_agg(t), '[]'::json) from public.${name}(${args}) t;`);
      return { data: JSON.parse(out), error: null };
    } catch (error) {
      // e.g. the legacy match_knowledge_chunks, which the evals don't build.
      return { data: null, error: { message: error instanceof Error ? error.message.split('\n')[0] : String(error) } };
    }
  }
}

const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`;
const sqlVector = (vector: number[]) => `'[${vector.join(',')}]'::vector`;

function sqlParam(name: string, value: unknown): string {
  if (value === null || value === undefined) {
    if (name.endsWith('_ids')) return 'null::uuid[]';
    if (name.endsWith('_types')) return 'null::text[]';
    return 'null';
  }
  if (name.endsWith('embedding')) {
    const vector = typeof value === 'string' ? JSON.parse(value) : value;
    return sqlVector(vector as number[]);
  }
  if (Array.isArray(value)) return `array[${value.map((v) => sqlText(String(v))).join(',')}]::uuid[]`;
  if (typeof value === 'number') return String(value);
  if (name === 'p_shop_id' || name === 'match_merchant_id') return `${sqlText(String(value))}::uuid`;
  return sqlText(String(value));
}

// ---------- Chunks, built the way production indexes a product ----------

export type Chunk = { productKey: string; lang: string; section: string; sourceKind: string; index: number; text: string };

export function buildChunks(products: EvalProduct[]): Chunk[] {
  return products.flatMap((product) => {
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
      product_id: productIdFor(products, product.key),
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

// ---------- Embeddings with a local cache (tmp/, git-ignored) ----------

export class EmbeddingCache {
  private cache: Record<string, number[]> = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    : {};

  private key(text: string) {
    return crypto.createHash('sha256').update(`${EMBEDDING_MODEL}\u0000${text}`).digest('hex');
  }

  async ensure(texts: string[], client: ModelClient) {
    const missing = [...new Set(texts)].filter((text) => !this.cache[this.key(text)]);
    for (let i = 0; i < missing.length; i += 100) {
      const batch = missing.slice(i, i + 100);
      const response = await client.embed({ model: EMBEDDING_MODEL, input: batch });
      batch.forEach((text, index) => {
        this.cache[this.key(text)] = response.data[index].embedding;
      });
    }
    if (missing.length > 0) {
      fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache));
    }
  }

  get(text: string): number[] {
    const vector = this.cache[this.key(text)];
    if (!vector) throw new Error(`No embedding for: ${text.slice(0, 40)}`);
    return vector;
  }

  has(text: string) {
    return Boolean(this.cache[this.key(text)]);
  }

  set(text: string, vector: number[]) {
    this.cache[this.key(text)] = vector;
  }
}
