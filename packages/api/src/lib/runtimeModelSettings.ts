import { getSupabaseServiceClient, logger } from '@recete/shared';

type PlatformAiSettingsRow = {
  id: string;
  default_llm_model: string;
  allowed_llm_models: string[] | null;
};

let cache: { value: PlatformAiSettingsRow; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

const DEFAULT_ALLOWED = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];

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
  };

  try {
    const svc = getSupabaseServiceClient();
    const { data, error } = await svc
      .from('platform_ai_settings')
      .select('id, default_llm_model, allowed_llm_models')
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

export async function updatePlatformAiSettings(input: {
  default_llm_model: string;
  allowed_llm_models?: string[];
}): Promise<PlatformAiSettingsRow> {
  const svc = getSupabaseServiceClient();
  const defaultModel = String(input.default_llm_model || '').trim();
  if (!defaultModel) throw new Error('default_llm_model is required');
  const allowed = normalizeAllowed(input.allowed_llm_models || DEFAULT_ALLOWED);
  if (!allowed.includes(defaultModel)) allowed.unshift(defaultModel);

  const { data, error } = await svc
    .from('platform_ai_settings')
    .upsert(
      {
        id: 'default',
        default_llm_model: defaultModel,
        allowed_llm_models: allowed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('id, default_llm_model, allowed_llm_models')
    .single();

  if (error) throw new Error(`platform_ai_settings update failed: ${error.message}`);

  const row: PlatformAiSettingsRow = {
    id: data.id || 'default',
    default_llm_model: String(data.default_llm_model || defaultModel),
    allowed_llm_models: normalizeAllowed(data.allowed_llm_models),
  };
  cache = { value: row, expiresAt: Date.now() + CACHE_TTL_MS };
  return row;
}

export function __resetPlatformAiSettingsCacheForTests() {
  cache = null;
}

