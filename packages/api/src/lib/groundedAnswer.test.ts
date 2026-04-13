import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateGroundedProductAnswer } from './groundedAnswer';
import { __setOpenAIClientForTests } from './openaiClient';

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'shop_settings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: null,
              })),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  shop_id: 'merchant-1',
                  default_source_lang: 'en',
                  enabled_langs: ['en', 'tr'],
                },
                error: null,
              })),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { name: 'TestShop', persona_settings: { bot_name: 'TestBot', tone: 'friendly' } },
              error: null,
            })),
          })),
        })),
      };
    }),
  })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./botInfo', () => ({
  getMerchantBotInfo: vi.fn(() => ({})),
}));

vi.mock('./runtimeModelSettings', () => ({
  getDefaultLlmModel: vi.fn(() => 'gpt-4o-mini'),
  getConversationMemorySettings: vi.fn(() => ({ mode: 'sliding_window', count: 10 })),
}));

vi.mock('./aiUsageEvents', () => ({
  trackAiUsageEvent: vi.fn(),
}));

vi.mock('./groundingAssembler', () => ({
  assembleGroundingEvidence: vi.fn(),
}));

vi.mock('./i18n', () => ({
  detectLanguage: vi.fn(() => 'en'),
  resolveMerchantReplyLanguage: vi.fn((requested: string, enabled: string[]) => {
    const normalizedRequested = String(requested || 'en').toLowerCase();
    const supported = Array.isArray(enabled) && enabled.length > 0 ? enabled : ['en'];
    const canUseRequested = supported.includes(normalizedRequested);
    return {
      responseLanguage: canUseRequested ? normalizedRequested : 'en',
      usedFallback: !canUseRequested,
      supportedLanguages: supported,
    };
  }),
  describeSupportedLanguagesForPrompt: vi.fn(() => 'English'),
  buildUnsupportedLanguageNotice: vi.fn(() => 'Unsupported language fallback applied.'),
}));

import { assembleGroundingEvidence } from './groundingAssembler';

describe('generateGroundedProductAnswer', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn();
    __setOpenAIClientForTests({
      chat: { completions: { create: mockCreate } },
    } as any);
  });

  it('should return deterministic answer when facts planner produces one', async () => {
    vi.mocked(assembleGroundingEvidence).mockResolvedValueOnce({
      context: 'Product facts here',
      citedProducts: ['prod-1'],
      usedDeterministicFacts: true,
      deterministicAnswer: 'Apply twice daily to clean skin.',
      orderScopeSource: 'external_events',
      retrievalLanguage: 'en',
      retrievalUsedFallback: false,
      retrievalFallbackLanguage: null,
    });

    const result = await generateGroundedProductAnswer({
      merchantId: 'merchant-1',
      question: 'How do I use this product?',
      channel: 'api',
    });

    expect(result.usedDeterministicFacts).toBe(true);
    expect(result.answer).toBe('Apply twice daily to clean skin.');
    expect(result.citedProducts).toEqual(['prod-1']);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should call LLM when no deterministic answer is available', async () => {
    vi.mocked(assembleGroundingEvidence).mockResolvedValueOnce({
      context: 'RAG context about product',
      citedProducts: ['prod-2'],
      usedDeterministicFacts: false,
      deterministicAnswer: undefined,
      orderScopeSource: undefined,
      retrievalLanguage: 'en',
      retrievalUsedFallback: false,
      retrievalFallbackLanguage: null,
    });

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'This product contains vitamin C.' } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    });

    const result = await generateGroundedProductAnswer({
      merchantId: 'merchant-1',
      question: 'What ingredients does this have?',
      channel: 'whatsapp',
    });

    expect(result.usedDeterministicFacts).toBe(false);
    expect(result.answer).toBe('This product contains vitamin C.');
    expect(result.citedProducts).toEqual(['prod-2']);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should return a safe fallback when LLM returns empty content', async () => {
    vi.mocked(assembleGroundingEvidence).mockResolvedValueOnce({
      context: undefined,
      citedProducts: [],
      usedDeterministicFacts: false,
      orderScopeSource: undefined,
      retrievalLanguage: 'en',
      retrievalUsedFallback: false,
      retrievalFallbackLanguage: null,
    });

    const result = await generateGroundedProductAnswer({
      merchantId: 'merchant-1',
      question: 'Something?',
      channel: 'api',
    });

    expect(result.answer).toContain('clear product evidence');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should replace unsupported guarantee-style model answers with a clarifying answer', async () => {
    vi.mocked(assembleGroundingEvidence).mockResolvedValueOnce({
      context: 'Evidence about a serum',
      citedProducts: ['prod-1'],
      usedDeterministicFacts: false,
      orderScopeSource: undefined,
      retrievalLanguage: 'en',
      retrievalUsedFallback: false,
      retrievalFallbackLanguage: null,
    });

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'This is completely safe and guaranteed to work for everyone.' } }],
      usage: { prompt_tokens: 70, completion_tokens: 12, total_tokens: 82 },
    });

    const result = await generateGroundedProductAnswer({
      merchantId: 'merchant-1',
      question: 'Can I use this safely?',
      channel: 'api',
    });

    expect(result.answer).toContain('clear product evidence');
  });

  it('should use provided persona and merchant name without DB lookup', async () => {
    vi.mocked(assembleGroundingEvidence).mockResolvedValueOnce({
      context: 'Some context',
      citedProducts: ['prod-3'],
      usedDeterministicFacts: false,
      orderScopeSource: undefined,
      retrievalLanguage: 'tr',
      retrievalUsedFallback: false,
      retrievalFallbackLanguage: null,
    });

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Cevap burada.' } }],
      usage: { prompt_tokens: 80, completion_tokens: 10, total_tokens: 90 },
    });

    const result = await generateGroundedProductAnswer({
      merchantId: 'merchant-1',
      question: 'Nasıl kullanılır?',
      userLang: 'tr',
      channel: 'whatsapp',
      merchantName: 'TestBrand',
      persona: { bot_name: 'Yardımcı', tone: 'professional' },
      botInfo: { brand_guidelines: 'Be helpful' },
    });

    expect(result.answer).toBe('Cevap burada.');
    expect(result.langDetected).toBe('tr');
  });
});
