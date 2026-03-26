export interface MultiLangRagFlags {
  chunkShadowWrite: boolean;
  embeddingModel: string;
}

let cachedFlags: MultiLangRagFlags | null = null;
const MULTI_LANG_RAG_SCHEMA_EMBEDDING_MODEL = 'text-embedding-3-small';

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback;
  const n = v.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(n)) return true;
  if (['0', 'false', 'no', 'off'].includes(n)) return false;
  return fallback;
}

function parseNum(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getMultiLangRagFlags(): MultiLangRagFlags {
  if (cachedFlags) return cachedFlags;
  const requestedEmbeddingModel = (process.env.EMBEDDING_MODEL || '').trim();
  const embeddingModel = requestedEmbeddingModel || MULTI_LANG_RAG_SCHEMA_EMBEDDING_MODEL;
  // Multilingual chunk indexing is stored as vector(1536).
  // Prevent runtime dimension mismatches by pinning to the compatible model.
  const effectiveEmbeddingModel =
    embeddingModel === MULTI_LANG_RAG_SCHEMA_EMBEDDING_MODEL
      ? embeddingModel
      : MULTI_LANG_RAG_SCHEMA_EMBEDDING_MODEL;
  cachedFlags = {
    chunkShadowWrite: parseBool(process.env.MULTI_LANG_CHUNK_SHADOW_WRITE, false),
    embeddingModel: effectiveEmbeddingModel,
  };
  return cachedFlags;
}

export function __resetMultiLangRagFlagsForTests() {
  cachedFlags = null;
}

export function getEmbeddingDimensionForModel(model: string): number {
  const normalized = (model || '').trim();
  if (normalized === 'text-embedding-3-small') return 1536;
  if (normalized === 'text-embedding-3-large') return 3072;
  throw new Error(`Unsupported embedding model for multi-lang RAG: ${normalized}`);
}
