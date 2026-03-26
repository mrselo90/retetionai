import { getSupabaseServiceClient, logger } from '@recete/shared';
import { getEmbeddingDimensionForModel } from './multiLangRag/config.js';

type PlatformAiSettingsRow = {
  id: string;
  default_llm_model: string;
  allowed_llm_models: string[] | null;
  default_embedding_model?: string;
  allowed_embedding_models?: string[] | null;
  default_vision_model?: string;
  allowed_vision_models?: string[] | null;
  corporate_whatsapp_provider?: 'twilio' | 'meta';
  corporate_whatsapp_from_number?: string | null;
  corporate_whatsapp_phone_number_display?: string | null;
  conversation_memory_mode?: 'last_n' | 'full';
  conversation_memory_count?: number;
  products_cache_ttl_seconds?: number;
};

let cache: { value: PlatformAiSettingsRow; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

const DEFAULT_ALLOWED = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];
const DEFAULT_ALLOWED_EMBEDDINGS = ['text-embedding-3-small'];
const DEFAULT_ALLOWED_VISION = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'];
const DEFAULT_CORPORATE_WHATSAPP_PROVIDER: 'twilio' | 'meta' = 'twilio';
const DEFAULT_MEMORY_MODE: 'last_n' | 'full' = 'last_n';
const DEFAULT_MEMORY_COUNT = 10;
const DEFAULT_PRODUCTS_CACHE_TTL_SECONDS = 300;

function normalizeModelId(value: unknown): string {
  return String(value || '').replace(/\s+/g, '').trim();
}

function normalizeAllowed(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const arr = value.map((v) => normalizeModelId(v)).filter(Boolean);
  return arr.length ? [...new Set(arr)] : fallback;
}

function validateAllowedModels(label: string, models: string[], supported: string[]) {
  const unsupported = models.filter((model) => !supported.includes(model));
  if (unsupported.length > 0) {
    throw new Error(`${label} contains unsupported model(s): ${unsupported.join(', ')}`);
  }
}

function validateDefaultModel(label: string, model: string, supported: string[]) {
  if (!supported.includes(model)) {
    throw new Error(`${label} is not supported: ${model}`);
  }
}

function normalizeCorporateWhatsAppProvider(value: unknown): 'twilio' | 'meta' {
  return String(value || '').trim().toLowerCase() === 'meta' ? 'meta' : 'twilio';
}

function normalizeOptionalText(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function validateCorporateWhatsAppSettings(input: {
  corporate_whatsapp_provider?: 'twilio' | 'meta';
  corporate_whatsapp_from_number?: string | null;
}) {
  const provider = normalizeCorporateWhatsAppProvider(input.corporate_whatsapp_provider);
  const fromNumber = normalizeOptionalText(input.corporate_whatsapp_from_number);
  if (!fromNumber) return;

  if (provider === 'twilio') {
    const normalized = fromNumber.startsWith('whatsapp:') ? fromNumber.slice('whatsapp:'.length) : fromNumber;
    if (!/^\+\d{7,20}$/.test(normalized)) {
      throw new Error('corporate_whatsapp_from_number must be E.164 format like +447915922506 for Twilio');
    }
    return;
  }

  if (!/^\d{5,32}$/.test(fromNumber)) {
    throw new Error('corporate_whatsapp_from_number must be a valid Meta phone number ID');
  }
}

export async function getPlatformAiSettings(): Promise<PlatformAiSettingsRow> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const fallback: PlatformAiSettingsRow = {
    id: 'default',
    default_llm_model: normalizeModelId(process.env.LLM_MODEL) || 'gpt-4o-mini',
    allowed_llm_models: DEFAULT_ALLOWED,
    default_embedding_model: normalizeModelId(process.env.EMBEDDING_MODEL) || 'text-embedding-3-small',
    allowed_embedding_models: DEFAULT_ALLOWED_EMBEDDINGS,
    default_vision_model: normalizeModelId(process.env.VISION_LLM_MODEL) || normalizeModelId(process.env.LLM_MODEL) || 'gpt-4o',
    allowed_vision_models: DEFAULT_ALLOWED_VISION,
    corporate_whatsapp_provider: DEFAULT_CORPORATE_WHATSAPP_PROVIDER,
    corporate_whatsapp_from_number: process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_FROM || process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    corporate_whatsapp_phone_number_display: process.env.PLATFORM_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_FROM || null,
    conversation_memory_mode: DEFAULT_MEMORY_MODE,
    conversation_memory_count: DEFAULT_MEMORY_COUNT,
    products_cache_ttl_seconds: DEFAULT_PRODUCTS_CACHE_TTL_SECONDS,
  };

  try {
    const svc = getSupabaseServiceClient();
    const { data, error } = await svc
      .from('platform_ai_settings')
      .select('id, default_llm_model, allowed_llm_models, default_embedding_model, allowed_embedding_models, default_vision_model, allowed_vision_models, corporate_whatsapp_provider, corporate_whatsapp_from_number, corporate_whatsapp_phone_number_display, conversation_memory_mode, conversation_memory_count, products_cache_ttl_seconds')
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
          default_llm_model: normalizeModelId(data.default_llm_model || fallback.default_llm_model),
          allowed_llm_models: normalizeAllowed(data.allowed_llm_models, DEFAULT_ALLOWED),
          default_embedding_model: normalizeModelId(data.default_embedding_model || fallback.default_embedding_model),
          allowed_embedding_models: normalizeAllowed(data.allowed_embedding_models, DEFAULT_ALLOWED_EMBEDDINGS),
          default_vision_model: normalizeModelId(data.default_vision_model || data.default_llm_model || fallback.default_vision_model),
          allowed_vision_models: normalizeAllowed(data.allowed_vision_models, DEFAULT_ALLOWED_VISION),
          corporate_whatsapp_provider: normalizeCorporateWhatsAppProvider(data.corporate_whatsapp_provider || fallback.corporate_whatsapp_provider),
          corporate_whatsapp_from_number: normalizeOptionalText(data.corporate_whatsapp_from_number ?? fallback.corporate_whatsapp_from_number),
          corporate_whatsapp_phone_number_display: normalizeOptionalText(data.corporate_whatsapp_phone_number_display ?? fallback.corporate_whatsapp_phone_number_display),
          conversation_memory_mode: data.conversation_memory_mode === 'full' ? 'full' : 'last_n',
          conversation_memory_count: typeof data.conversation_memory_count === 'number'
            ? Math.max(1, Math.min(200, Math.floor(data.conversation_memory_count)))
            : DEFAULT_MEMORY_COUNT,
          products_cache_ttl_seconds: typeof data.products_cache_ttl_seconds === 'number'
            ? Math.max(30, Math.min(3600, Math.floor(data.products_cache_ttl_seconds)))
            : DEFAULT_PRODUCTS_CACHE_TTL_SECONDS,
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
  return normalizeModelId(settings.default_llm_model) || normalizeModelId(process.env.LLM_MODEL) || 'gpt-4o-mini';
}

export async function getDefaultEmbeddingModel(): Promise<string> {
  const settings = await getPlatformAiSettings();
  return normalizeModelId(settings.default_embedding_model) || normalizeModelId(process.env.EMBEDDING_MODEL) || 'text-embedding-3-small';
}

export async function getAllowedEmbeddingModels(): Promise<string[]> {
  const settings = await getPlatformAiSettings();
  return normalizeAllowed(settings.allowed_embedding_models, DEFAULT_ALLOWED_EMBEDDINGS);
}

export async function getDefaultVisionModel(): Promise<string> {
  const settings = await getPlatformAiSettings();
  return normalizeModelId(settings.default_vision_model)
    || normalizeModelId(settings.default_llm_model)
    || normalizeModelId(process.env.VISION_LLM_MODEL)
    || normalizeModelId(process.env.LLM_MODEL)
    || 'gpt-4o';
}

export async function getAllowedVisionModels(): Promise<string[]> {
  const settings = await getPlatformAiSettings();
  return normalizeAllowed(settings.allowed_vision_models, DEFAULT_ALLOWED_VISION);
}

export async function getConversationMemorySettings(): Promise<{ mode: 'last_n' | 'full'; count: number }> {
  const settings = await getPlatformAiSettings();
  return {
    mode: settings.conversation_memory_mode === 'full' ? 'full' : 'last_n',
    count: typeof settings.conversation_memory_count === 'number' ? settings.conversation_memory_count : DEFAULT_MEMORY_COUNT,
  };
}

export async function getProductsCacheTtlSeconds(): Promise<number> {
  const settings = await getPlatformAiSettings();
  return typeof settings.products_cache_ttl_seconds === 'number'
    ? settings.products_cache_ttl_seconds
    : DEFAULT_PRODUCTS_CACHE_TTL_SECONDS;
}

export async function getPlatformCorporateWhatsAppSettings(): Promise<{
  provider: 'twilio' | 'meta';
  fromNumber: string | null;
  phoneNumberDisplay: string | null;
}> {
  const settings = await getPlatformAiSettings();
  return {
    provider: normalizeCorporateWhatsAppProvider(settings.corporate_whatsapp_provider),
    fromNumber: normalizeOptionalText(settings.corporate_whatsapp_from_number),
    phoneNumberDisplay: normalizeOptionalText(settings.corporate_whatsapp_phone_number_display),
  };
}

export async function updatePlatformAiSettings(input: {
  default_llm_model: string;
  allowed_llm_models?: string[];
  default_embedding_model?: string;
  allowed_embedding_models?: string[];
  default_vision_model?: string;
  allowed_vision_models?: string[];
  corporate_whatsapp_provider?: 'twilio' | 'meta';
  corporate_whatsapp_from_number?: string | null;
  corporate_whatsapp_phone_number_display?: string | null;
  conversation_memory_mode?: 'last_n' | 'full';
  conversation_memory_count?: number;
  products_cache_ttl_seconds?: number;
}): Promise<PlatformAiSettingsRow> {
  const svc = getSupabaseServiceClient();
  const defaultModel = normalizeModelId(input.default_llm_model);
  if (!defaultModel) throw new Error('default_llm_model is required');
  const allowed = normalizeAllowed(input.allowed_llm_models || DEFAULT_ALLOWED, DEFAULT_ALLOWED);
  validateAllowedModels('allowed_llm_models', allowed, DEFAULT_ALLOWED);
  validateDefaultModel('default_llm_model', defaultModel, DEFAULT_ALLOWED);
  if (!allowed.includes(defaultModel)) allowed.unshift(defaultModel);
  const defaultEmbeddingModel = normalizeModelId(input.default_embedding_model) || 'text-embedding-3-small';
  const allowedEmbeddingModels = normalizeAllowed(input.allowed_embedding_models || DEFAULT_ALLOWED_EMBEDDINGS, DEFAULT_ALLOWED_EMBEDDINGS);
  validateAllowedModels('allowed_embedding_models', allowedEmbeddingModels, DEFAULT_ALLOWED_EMBEDDINGS);
  if (!allowedEmbeddingModels.includes(defaultEmbeddingModel)) allowedEmbeddingModels.unshift(defaultEmbeddingModel);
  const embeddingDimension = getEmbeddingDimensionForModel(defaultEmbeddingModel);
  if (embeddingDimension !== 1536) {
    throw new Error(`default_embedding_model must be 1536-dimensional for the current vector schema; received ${defaultEmbeddingModel}`);
  }
  for (const model of allowedEmbeddingModels) {
    if (getEmbeddingDimensionForModel(model) !== 1536) {
      throw new Error(`allowed_embedding_models contains an incompatible model for the current vector schema: ${model}`);
    }
  }
  const defaultVisionModel = normalizeModelId(input.default_vision_model) || defaultModel;
  const allowedVisionModels = normalizeAllowed(input.allowed_vision_models || DEFAULT_ALLOWED_VISION, DEFAULT_ALLOWED_VISION);
  validateAllowedModels('allowed_vision_models', allowedVisionModels, DEFAULT_ALLOWED_VISION);
  validateDefaultModel('default_vision_model', defaultVisionModel, DEFAULT_ALLOWED_VISION);
  if (!allowedVisionModels.includes(defaultVisionModel)) allowedVisionModels.unshift(defaultVisionModel);
  const corporateWhatsAppProvider = normalizeCorporateWhatsAppProvider(input.corporate_whatsapp_provider);
  const corporateWhatsAppFromNumber = normalizeOptionalText(input.corporate_whatsapp_from_number);
  const corporateWhatsAppPhoneNumberDisplay = normalizeOptionalText(input.corporate_whatsapp_phone_number_display);
  validateCorporateWhatsAppSettings({
    corporate_whatsapp_provider: corporateWhatsAppProvider,
    corporate_whatsapp_from_number: corporateWhatsAppFromNumber,
  });
  const memoryMode = input.conversation_memory_mode === 'full' ? 'full' : 'last_n';
  const memoryCount = typeof input.conversation_memory_count === 'number'
    ? Math.max(1, Math.min(200, Math.floor(input.conversation_memory_count)))
    : DEFAULT_MEMORY_COUNT;
  const productsCacheTtlSeconds = typeof input.products_cache_ttl_seconds === 'number'
    ? Math.max(30, Math.min(3600, Math.floor(input.products_cache_ttl_seconds)))
    : DEFAULT_PRODUCTS_CACHE_TTL_SECONDS;

  const { data, error } = await svc
    .from('platform_ai_settings')
    .upsert(
      {
        id: 'default',
        default_llm_model: defaultModel,
        allowed_llm_models: allowed,
        default_embedding_model: defaultEmbeddingModel,
        allowed_embedding_models: allowedEmbeddingModels,
        default_vision_model: defaultVisionModel,
        allowed_vision_models: allowedVisionModels,
        corporate_whatsapp_provider: corporateWhatsAppProvider,
        corporate_whatsapp_from_number: corporateWhatsAppFromNumber,
        corporate_whatsapp_phone_number_display: corporateWhatsAppPhoneNumberDisplay,
        conversation_memory_mode: memoryMode,
        conversation_memory_count: memoryCount,
        products_cache_ttl_seconds: productsCacheTtlSeconds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('id, default_llm_model, allowed_llm_models, default_embedding_model, allowed_embedding_models, default_vision_model, allowed_vision_models, corporate_whatsapp_provider, corporate_whatsapp_from_number, corporate_whatsapp_phone_number_display, conversation_memory_mode, conversation_memory_count, products_cache_ttl_seconds')
    .single();

  if (error) throw new Error(`platform_ai_settings update failed: ${error.message}`);

  const row: PlatformAiSettingsRow = {
    id: data.id || 'default',
    default_llm_model: normalizeModelId(data.default_llm_model || defaultModel),
    allowed_llm_models: normalizeAllowed(data.allowed_llm_models, DEFAULT_ALLOWED),
    default_embedding_model: normalizeModelId(data.default_embedding_model || defaultEmbeddingModel),
    allowed_embedding_models: normalizeAllowed(data.allowed_embedding_models, DEFAULT_ALLOWED_EMBEDDINGS),
    default_vision_model: normalizeModelId(data.default_vision_model || defaultVisionModel),
    allowed_vision_models: normalizeAllowed(data.allowed_vision_models, DEFAULT_ALLOWED_VISION),
    corporate_whatsapp_provider: normalizeCorporateWhatsAppProvider(data.corporate_whatsapp_provider || corporateWhatsAppProvider),
    corporate_whatsapp_from_number: normalizeOptionalText(data.corporate_whatsapp_from_number ?? corporateWhatsAppFromNumber),
    corporate_whatsapp_phone_number_display: normalizeOptionalText(data.corporate_whatsapp_phone_number_display ?? corporateWhatsAppPhoneNumberDisplay),
    conversation_memory_mode: data.conversation_memory_mode === 'full' ? 'full' : 'last_n',
    conversation_memory_count: typeof data.conversation_memory_count === 'number'
      ? Math.max(1, Math.min(200, Math.floor(data.conversation_memory_count)))
      : DEFAULT_MEMORY_COUNT,
    products_cache_ttl_seconds: typeof data.products_cache_ttl_seconds === 'number'
      ? Math.max(30, Math.min(3600, Math.floor(data.products_cache_ttl_seconds)))
      : DEFAULT_PRODUCTS_CACHE_TTL_SECONDS,
  };
  cache = { value: row, expiresAt: Date.now() + CACHE_TTL_MS };
  return row;
}

export function __resetPlatformAiSettingsCacheForTests() {
  cache = null;
}
