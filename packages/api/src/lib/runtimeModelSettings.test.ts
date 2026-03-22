import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertSingle = vi.fn();
const maybeSingle = vi.fn();

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle,
        }),
      }),
      upsert: () => ({
        select: () => ({
          single: upsertSingle,
        }),
      }),
    }),
  }),
  logger: {
    warn: vi.fn(),
  },
}));

const runtimeModelSettings = await import('./runtimeModelSettings.js');

describe('runtimeModelSettings', () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    upsertSingle.mockReset();
    runtimeModelSettings.__resetPlatformAiSettingsCacheForTests();
    upsertSingle.mockResolvedValue({
      data: {
        id: 'default',
        default_llm_model: 'gpt-4o',
        allowed_llm_models: ['gpt-4o', 'gpt-4o-mini'],
        default_embedding_model: 'text-embedding-3-small',
        allowed_embedding_models: ['text-embedding-3-small'],
        default_vision_model: 'gpt-4o',
        allowed_vision_models: ['gpt-4o', 'gpt-4o-mini'],
        corporate_whatsapp_provider: 'twilio',
        corporate_whatsapp_from_number: '+447915922506',
        corporate_whatsapp_phone_number_display: '+447915922506',
        conversation_memory_mode: 'last_n',
        conversation_memory_count: 10,
        products_cache_ttl_seconds: 300,
      },
      error: null,
    });
  });

  it('rejects unsupported default llm models', async () => {
    await expect(runtimeModelSettings.updatePlatformAiSettings({
      default_llm_model: 'gpt-5',
    })).rejects.toThrow('default_llm_model is not supported');
  });

  it('rejects unsupported allowed vision models', async () => {
    await expect(runtimeModelSettings.updatePlatformAiSettings({
      default_llm_model: 'gpt-4o',
      default_vision_model: 'gpt-4o',
      allowed_vision_models: ['gpt-4o', 'gpt-bad-model'],
    })).rejects.toThrow('allowed_vision_models contains unsupported model');
  });

  it('rejects invalid corporate twilio whatsapp sender numbers', async () => {
    await expect(runtimeModelSettings.updatePlatformAiSettings({
      default_llm_model: 'gpt-4o',
      default_embedding_model: 'text-embedding-3-small',
      default_vision_model: 'gpt-4o',
      corporate_whatsapp_provider: 'twilio',
      corporate_whatsapp_from_number: '07915922506',
    })).rejects.toThrow('corporate_whatsapp_from_number must be E.164 format');
  });

  it('persists supported llm and vision models', async () => {
    const result = await runtimeModelSettings.updatePlatformAiSettings({
      default_llm_model: 'gpt-4o',
      allowed_llm_models: ['gpt-4o', 'gpt-4o-mini'],
      default_embedding_model: 'text-embedding-3-small',
      allowed_embedding_models: ['text-embedding-3-small'],
      default_vision_model: 'gpt-4o-mini',
      allowed_vision_models: ['gpt-4o-mini', 'gpt-4o'],
      corporate_whatsapp_provider: 'twilio',
      corporate_whatsapp_from_number: '+447915922506',
      corporate_whatsapp_phone_number_display: '+447915922506',
    });

    expect(upsertSingle).toHaveBeenCalled();
    expect(result.default_llm_model).toBe('gpt-4o');
    expect(result.default_vision_model).toBe('gpt-4o');
    expect(result.allowed_vision_models).toEqual(['gpt-4o', 'gpt-4o-mini']);
    expect(result.corporate_whatsapp_provider).toBe('twilio');
    expect(result.corporate_whatsapp_from_number).toBe('+447915922506');
  });
});
