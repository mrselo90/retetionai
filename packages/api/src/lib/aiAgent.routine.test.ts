import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockMemorySettings: { mode: 'last_n' | 'full'; count: number } = { mode: 'last_n', count: 10 };
let mockHandoffRequest = false;
let mockMerchantPersona: Record<string, unknown> = {};
let mockEnabledLangs: string[] = ['en'];
let mockStructuredState: any = null;

vi.mock('./openaiClient', () => ({
  getOpenAIClient: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'question' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      },
    },
  })),
}));

vi.mock('./runtimeModelSettings', () => ({
  getDefaultLlmModel: vi.fn(async () => 'gpt-4o-mini'),
  getConversationMemorySettings: vi.fn(async () => mockMemorySettings),
}));

vi.mock('./aiUsageEvents', () => ({
  trackAiUsageEvent: vi.fn(),
}));

vi.mock('./botInfo', () => ({
  getMerchantBotInfo: vi.fn(async () => ({})),
}));

vi.mock('./conversation', () => ({
  getConversationStructuredState: vi.fn(async (conversationId: string) => ({
    conversation_id: conversationId,
    order_id: 'order-1',
    known_order_products: mockStructuredState?.known_order_products || [],
    selected_products: mockStructuredState?.selected_products || [],
    current_intent: mockStructuredState?.current_intent,
    last_question_type: mockStructuredState?.last_question_type || 'none',
    language_preference: mockStructuredState?.language_preference || 'en',
    constraints: mockStructuredState?.constraints || {
      routine_scope: 'unknown',
      simplicity: 'unknown',
      for_whom: 'unknown',
      routine_format: 'unknown',
    },
    updated_at: new Date().toISOString(),
  })),
  updateConversationStructuredState: vi.fn(async (_conversationId: string, patch: any) => {
    mockStructuredState = {
      ...(mockStructuredState || {}),
      ...patch,
      constraints: {
        ...(mockStructuredState?.constraints || {}),
        ...(patch?.constraints || {}),
      },
    };
    return mockStructuredState;
  }),
}));

vi.mock('./multiLangRag/shopSettingsService', () => ({
  ShopSettingsService: class {
    async getOrCreate() {
      return { enabled_langs: mockEnabledLangs, default_source_lang: 'en' };
    }
  },
}));

vi.mock('./guardrails', () => ({
  checkUserMessageGuardrailsWithoutCrisis: vi.fn(() => ({ safe: true, requiresHuman: false })),
  checkAIResponseGuardrails: vi.fn(() => ({ safe: true, requiresHuman: false })),
  evaluateCrisisEscalation: vi.fn(async () => ({
    shouldEscalate: false,
    precheckMatched: false,
    llmConfirmed: false,
    severity: 'none',
  })),
  checkForHumanHandoffRequest: vi.fn(() => mockHandoffRequest),
  escalateToHuman: vi.fn(),
  getSafeResponse: vi.fn(() => 'Safe response'),
}));

vi.mock('./rag', () => ({
  getOrderProductContextResolved: vi.fn(async () => ({
    productIds: ['p-serum', 'p-spf', 'p-deodorant'],
    source: 'external_events',
  })),
  formatRAGResultsForLLM: vi.fn(() => ''),
}));

vi.mock('./groundedAnswer', () => ({
  generateGroundedProductAnswer: vi.fn(async () => ({
    answer: 'I could not find enough clear product evidence to answer that safely. Could you clarify which product or variant you mean?',
    langDetected: 'en',
    citedProducts: [],
    latencyMs: 10,
    ragContext: '',
    usedDeterministicFacts: false,
    orderScopeSource: 'external_events',
    retrievalLanguage: 'en',
    retrievalUsedFallback: false,
    retrievalFallbackLanguage: null,
  })),
}));

vi.mock('./unifiedRetrieval', () => ({
  UnifiedRetrievalService: vi.fn().mockImplementation(() => ({
    retrieve: vi.fn(async () => ({
      query: '',
      results: [],
      totalResults: 0,
      executionTime: 0,
      effectiveLanguage: 'en',
      usedFallback: false,
      fallbackLanguage: null,
    })),
  })),
}));

vi.mock('./productFactsQuery', () => ({
  getActiveProductFactsContext: vi.fn(async () => ({ text: '', factCount: 0 })),
  getActiveProductFactsSnapshots: vi.fn(async () => []),
}));

vi.mock('./groundingAssembler', () => ({
  buildGroundedEvidenceContext: vi.fn(() => ''),
}));

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'merchants') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { name: 'Test Merchant', persona_settings: mockMerchantPersona, guardrail_settings: {} },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({
                data: [
                  { id: 'p-serum', name: 'Hydrating Serum' },
                  { id: 'p-spf', name: 'SPF 50 Sunscreen' },
                  { id: 'p-deodorant', name: 'Sport Deodorant' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  })),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  getProductInstructionsByProductIds: vi.fn(async () => []),
}));

import { generateAIResponse } from './aiAgent';

describe('generateAIResponse routine orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMemorySettings = { mode: 'last_n', count: 10 };
    mockHandoffRequest = false;
    mockMerchantPersona = {};
    mockEnabledLangs = ['en'];
    mockStructuredState = null;
  });

  it('should generate best-effort routine for "For all of them" without escalation', async () => {
    const response = await generateAIResponse(
      'For all of them',
      'merchant-1',
      'user-1',
      'conversation-1',
      'order-1',
      [
        {
          role: 'assistant',
          content: 'Which products would you like to use in your routine?',
          timestamp: new Date().toISOString(),
        } as any,
      ],
    );

    expect(response.intent).toBe('question');
    expect(response.requiresHuman).toBe(false);
    expect(response.guardrailBlocked).toBe(false);
    expect(response.response).toContain('Morning');
    expect(response.response).toContain('Evening');
    expect(response.response).toContain('Hydrating Serum');
    expect(response.response).toContain('SPF 50 Sunscreen');
    expect(response.response).toContain('Skipped from routine');
    expect(response.response).toContain('Sport Deodorant');
    expect(response.response.toLowerCase()).not.toContain('clear product evidence');
  });

  it('should honor formal tone and short response length in routine fallback', async () => {
    mockMerchantPersona = { tone: 'formal', response_length: 'short', emoji: false };

    const response = await generateAIResponse(
      'For all of them',
      'merchant-1',
      'user-1',
      'conversation-1',
      'order-1',
      [{ role: 'assistant', content: 'Which products should I include?', timestamp: new Date().toISOString() } as any],
    );

    expect(response.response).toContain('Here is a practical routine');
    expect(response.response).not.toContain('Great,');
    expect(response.response.length).toBeLessThan(650);
    expect(response.response).not.toContain('🙌');
  });

  it('should respect language restrictions and add fallback notice', async () => {
    mockEnabledLangs = ['en'];

    const response = await generateAIResponse(
      'Hepsi için rutin yap',
      'merchant-1',
      'user-1',
      'conversation-1',
      'order-1',
      [{ role: 'assistant', content: 'Hangi ürünleri rutine ekleyeyim?', timestamp: new Date().toISOString() } as any],
    );

    expect(response.response).toContain('I can currently help in these languages');
    expect(response.response).toContain('Morning');
  });

  it('should resolve continuation with limited memory mode', async () => {
    mockMemorySettings = { mode: 'last_n', count: 1 };

    const response = await generateAIResponse(
      'all',
      'merchant-1',
      'user-1',
      'conversation-1',
      'order-1',
      [
        { role: 'assistant', content: 'Older unrelated message', timestamp: new Date().toISOString() } as any,
        { role: 'assistant', content: 'Which products would you like to use in your routine?', timestamp: new Date().toISOString() } as any,
      ],
    );

    expect(response.intent).toBe('question');
    expect(response.response).toContain('Morning');
    expect(response.requiresHuman).toBe(false);
  });

  it('should keep explicit human handoff working and obey emoji setting', async () => {
    mockHandoffRequest = true;
    mockMerchantPersona = { emoji: false };

    const response = await generateAIResponse(
      'connect me to a person',
      'merchant-1',
      'user-1',
      'conversation-1',
      'order-1',
      [],
    );

    expect(response.requiresHuman).toBe(true);
    expect(response.response).not.toContain('🙏');
  });

  it('should allow emoji in handoff response when merchant enabled emoji', async () => {
    mockHandoffRequest = true;
    mockMerchantPersona = { emoji: true };

    const response = await generateAIResponse(
      'connect me to support',
      'merchant-1',
      'user-1',
      'conversation-1',
      'order-1',
      [],
    );

    expect(response.requiresHuman).toBe(true);
    expect(response.response).toContain('🙏');
  });
});
