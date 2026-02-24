export interface MultiLangRagFlags {
  enabled: boolean;
  shadowWrite: boolean;
  shadowRead: boolean;
  minSimilarity: number;
  embeddingModel: string;
  llmModel: string;
}

let cachedFlags: MultiLangRagFlags | null = null;

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
  cachedFlags = {
    enabled: parseBool(process.env.MULTI_LANG_RAG_ENABLED, false),
    shadowWrite: parseBool(process.env.MULTI_LANG_RAG_SHADOW_WRITE, false),
    shadowRead: parseBool(process.env.MULTI_LANG_RAG_SHADOW_READ, false),
    minSimilarity: parseNum(process.env.MULTI_LANG_RAG_MIN_SIM, 0.75),
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
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

