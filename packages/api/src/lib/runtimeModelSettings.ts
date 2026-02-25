import { getSupabaseServiceClient, logger } from '@recete/shared';

type PlatformAiSettingsRow = {
  id: string;
  default_llm_model: string;
  allowed_llm_models: string[] | null;
  conversation_memory_mode?: 'last_n' | 'full';
  conversation_memory_count?: number;
};

let cache: { value: PlatformAiSettingsRow; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

const DEFAULT_ALLOWED = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];
const DEFAULT_MEMORY_MODE: 'last_n' | 'full' = 'last_n';
const DEFAULT_MEMORY_COUNT = 10;

function normalizeAllowed(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_ALLOWED;
  const arr = value.map((v) => String(v)).filter(Boolean);
  return arr.length ? [...new Set(arr)] : DEFAULT_ALLOWED;
}

export async function getPlatformAiSettings(): Promise<PlatformAiSettingsRow> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const fallback: PlatformAiSettingsRow = {
    id: 'default',
    default_llm_model: process.env.LLM_MODEL || 'gpt-4o-mini',
    allowed_llm_models: DEFAULT_ALLOWED,
    conversation_memory_mode: DEFAULT_MEMORY_MODE,
    conversation_memory_count: DEFAULT_MEMORY_COUNT,
  };

  try {
    const svc = getSupabaseServiceClient();
    const { data, error } = await svc
      .from('platform_ai_settings')
      .select('id, default_llm_model, allowed_llm_models, conversation_memory_mode, conversation_memory_count')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || error.code === '42703') {
        logger.warn({ error }, 'platform_ai_settings table/columns missing; using env fallback');
      } else {
        logger.warn({ error }, 'platform_ai_settings fetch failed; using env fallback');
      }
      cache = { value: fallback, expiresAt: now + CACHE_TTL_MS };
      return fallback;
    }

    const row: PlatformAiSettingsRow = data
      ? {
          id: data.id || 'default',
          default_llm_model: String(data.default_llm_model || fallback.default_llm_model),
          allowed_llm_models: normalizeAllowed(data.allowed_llm_models),
          conversation_memory_mode: data.conversation_memory_mode === 'full' ? 'full' : 'last_n',
          conversation_memory_count: typeof data.conversation_memory_count === 'number'
            ? Math.max(1, Math.min(200, Math.floor(data.conversation_memory_count)))
            : DEFAULT_MEMORY_COUNT,
        }
      : fallback;

    cache = { value: row, expiresAt: now + CACHE_TTL_MS };
    return row;
  } catch (error) {
    logger.warn({ error }, 'platform_ai_settings fetch exception; using env fallback');
    cache = { value: fallback, expiresAt: now + CACHE_TTL_MS };
    return fallback;
  }
}

export async function getDefaultLlmModel(): Promise<string> {
  const settings = await getPlatformAiSettings();
  return settings.default_llm_model || process.env.LLM_MODEL || 'gpt-4o-mini';
}

export async function getConversationMemorySettings(): Promise<{ mode: 'last_n' | 'full'; count: number }> {
  const settings = await getPlatformAiSettings();
  return {
    mode: settings.conversation_memory_mode === 'full' ? 'full' : 'last_n',
    count: typeof settings.conversation_memory_count === 'number' ? settings.conversation_memory_count : DEFAULT_MEMORY_COUNT,
  };
}

export async function updatePlatformAiSettings(input: {
  default_llm_model: string;
  allowed_llm_models?: string[];
  conversation_memory_mode?: 'last_n' | 'full';
  conversation_memory_count?: number;
}): Promise<PlatformAiSettingsRow> {
  const svc = getSupabaseServiceClient();
  const defaultModel = String(input.default_llm_model || '').trim();
  if (!defaultModel) throw new Error('default_llm_model is required');
  const allowed = normalizeAllowed(input.allowed_llm_models || DEFAULT_ALLOWED);
  if (!allowed.includes(defaultModel)) allowed.unshift(defaultModel);
  const memoryMode = input.conversation_memory_mode === 'full' ? 'full' : 'last_n';
  const memoryCount = typeof input.conversation_memory_count === 'number'
    ? Math.max(1, Math.min(200, Math.floor(input.conversation_memory_count)))
    : DEFAULT_MEMORY_COUNT;

  const { data, error } = await svc
    .from('platform_ai_settings')
    .upsert(
      {
        id: 'default',
        default_llm_model: defaultModel,
        allowed_llm_models: allowed,
        conversation_memory_mode: memoryMode,
        conversation_memory_count: memoryCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('id, default_llm_model, allowed_llm_models, conversation_memory_mode, conversation_memory_count')
    .single();

  if (error) throw new Error(`platform_ai_settings update failed: ${error.message}`);

  const row: PlatformAiSettingsRow = {
    id: data.id || 'default',
    default_llm_model: String(data.default_llm_model || defaultModel),
    allowed_llm_models: normalizeAllowed(data.allowed_llm_models),
    conversation_memory_mode: data.conversation_memory_mode === 'full' ? 'full' : 'last_n',
    conversation_memory_count: typeof data.conversation_memory_count === 'number'
      ? Math.max(1, Math.min(200, Math.floor(data.conversation_memory_count)))
      : DEFAULT_MEMORY_COUNT,
  };
  cache = { value: row, expiresAt: Date.now() + CACHE_TTL_MS };
  return row;
}

export function __resetPlatformAiSettingsCacheForTests() {
  cache = null;
}
