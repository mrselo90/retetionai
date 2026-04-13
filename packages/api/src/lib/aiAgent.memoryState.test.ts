import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockMemorySettings: { mode: 'last_n' | 'full'; count: number } = { mode: 'last_n', count: 2 };
const structuredStateStore = new Map<string, any>();
const openaiCalls: Array<any> = [];
let forceGroundedError = false;

vi.mock('./openaiClient', () => ({
  getOpenAIClient: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async (input: any) => {
          openaiCalls.push(input);
          const systemText = String(input?.messages?.[0]?.content || '');
          const userText = String(input?.messages?.[input.messages.length - 1]?.content || '');
          if (systemText.includes('intent classifier')) {
            if (/delay|delivery/i.test(userText)) return { choices: [{ message: { content: 'complaint' } }] };
            if (/routine|all|together|use/i.test(userText)) return { choices: [{ message: { content: 'question' } }] };
            return { choices: [{ message: { content: 'chat' } }] };
          }
          if (systemText.includes('Infer customer goal')) {
            if (/routine|all|together|use/i.test(userText)) return { choices: [{ message: { content: 'build_routine' } }] };
            return { choices: [{ message: { content: 'unknown' } }] };
          }
          return {
            choices: [{ message: { content: 'Delivery is in transit. I can also help with product usage anytime.' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          };
        }),
      },
    },
  })),
}));

vi.mock('./runtimeModelSettings', () => ({
  getDefaultLlmModel: vi.fn(async () => 'gpt-4o-mini'),
  getConversationMemorySettings: vi.fn(async () => mockMemorySettings),
}));

vi.mock('./conversation', () => ({
  getConversationStructuredState: vi.fn(async (conversationId: string) => {
    return (
      structuredStateStore.get(conversationId) || {
        conversation_id: conversationId,
        order_id: null,
        known_order_products: [],
        selected_products: [],
        current_intent: undefined,
        last_question_type: 'none',
        language_preference: 'en',
        constraints: {
          routine_scope: 'unknown',
          simplicity: 'unknown',
          for_whom: 'unknown',
          routine_format: 'unknown',
        },
        updated_at: new Date().toISOString(),
      }
    );
  }),
  updateConversationStructuredState: vi.fn(async (conversationId: string, patch: any) => {
    const current = structuredStateStore.get(conversationId) || {};
    const merged = {
      ...current,
      ...patch,
      conversation_id: conversationId,
      constraints: {
        ...(current.constraints || {}),
        ...(patch.constraints || {}),
      },
      known_order_products: patch.known_order_products ?? current.known_order_products ?? [],
      selected_products: patch.selected_products ?? current.selected_products ?? [],
      updated_at: new Date().toISOString(),
    };
    structuredStateStore.set(conversationId, merged);
    return merged;
  }),
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
  checkForHumanHandoffRequest: vi.fn(() => false),
  escalateToHuman: vi.fn(),
  getSafeResponse: vi.fn(() => 'Safe response'),
}));

vi.mock('./rag', () => ({
  getOrderProductContextResolved: vi.fn(async () => ({
    productIds: ['p-serum', 'p-spf', 'p-deo'],
    source: 'external_events',
  })),
  formatRAGResultsForLLM: vi.fn(() => ''),
}));

vi.mock('./groundedAnswer', () => ({
  generateGroundedProductAnswer: vi.fn(async () => {
    if (forceGroundedError) throw new Error('grounded unavailable');
    return {
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
    };
  }),
}));

vi.mock('./aiUsageEvents', () => ({ trackAiUsageEvent: vi.fn() }));
vi.mock('./botInfo', () => ({ getMerchantBotInfo: vi.fn(async () => ({})) }));
vi.mock('./addons', () => ({
  isAddonActive: vi.fn(async () => false),
  logReturnPreventionAttempt: vi.fn(),
  hasPendingPreventionAttempt: vi.fn(async () => false),
  updatePreventionOutcome: vi.fn(),
}));
vi.mock('./i18n', async () => {
  const actual = await vi.importActual<any>('./i18n');
  return {
    ...actual,
    detectLanguage: vi.fn(() => 'en'),
  };
});
vi.mock('./multiLangRag/shopSettingsService', () => ({
  ShopSettingsService: class {
    async getOrCreate() {
      return { enabled_langs: ['en'], default_source_lang: 'en' };
    }
  },
}));
vi.mock('./productFactsQuery', () => ({
  getActiveProductFactsContext: vi.fn(async () => ({ text: '', factCount: 0 })),
  getActiveProductFactsSnapshots: vi.fn(async () => []),
}));
vi.mock('./groundingAssembler', () => ({ buildGroundedEvidenceContext: vi.fn(() => '') }));
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

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'merchants') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { name: 'Test Merchant', persona_settings: {}, guardrail_settings: {} },
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
                  { id: 'p-deo', name: 'Sport Deodorant' },
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  getProductInstructionsByProductIds: vi.fn(async () => []),
}));

import { generateAIResponse } from './aiAgent';

describe('generateAIResponse persistent memory and sticky products', () => {
  beforeEach(() => {
    mockMemorySettings = { mode: 'last_n', count: 2 };
    structuredStateStore.clear();
    openaiCalls.length = 0;
    forceGroundedError = false;
    vi.clearAllMocks();
  });

  it('stores products early and reuses them later', async () => {
    const conversationId = 'conv-memory-1';
    await generateAIResponse('Make me a routine', 'merchant-1', 'user-1', conversationId, 'order-1', []);
    const stateAfterFirst = structuredStateStore.get(conversationId);
    expect(stateAfterFirst.known_order_products.length).toBeGreaterThan(0);

    const second = await generateAIResponse('Use all of them together', 'merchant-1', 'user-1', conversationId, undefined, []);
    expect(second.response).toContain('Hydrating Serum');
    expect(second.response).toContain('SPF 50 Sunscreen');
  });

  it('keeps order products after delivery-topic detour then returns to usage', async () => {
    const conversationId = 'conv-memory-2';
    await generateAIResponse('Create routine for all products', 'merchant-1', 'user-1', conversationId, 'order-1', []);
    await generateAIResponse('My delivery is delayed', 'merchant-1', 'user-1', conversationId, undefined, []);

    const backToUsage = await generateAIResponse('How do I use everything together?', 'merchant-1', 'user-1', conversationId, undefined, []);
    expect(backToUsage.response).toContain('Hydrating Serum');
    expect(backToUsage.response.toLowerCase()).not.toContain('which products did you buy');
  });

  it('uses full history in full memory mode', async () => {
    mockMemorySettings = { mode: 'full', count: 50 };
    const history = Array.from({ length: 12 }).map((_, idx) => ({
      role: idx % 2 === 0 ? 'user' : ('assistant' as const),
      content: `Message ${idx + 1}`,
      timestamp: new Date().toISOString(),
    }));

    await generateAIResponse('hello', 'merchant-1', 'user-1', 'conv-memory-3', undefined, history as any);
    const lastCall = openaiCalls.at(-1);
    const sentHistory = lastCall.messages.filter((m: any) => m.role !== 'system' && m.content !== 'hello');
    expect(sentHistory.length).toBe(history.length);
  });

  it('keeps sticky order products in limited memory mode', async () => {
    mockMemorySettings = { mode: 'last_n', count: 1 };
    structuredStateStore.set('conv-memory-4', {
      conversation_id: 'conv-memory-4',
      order_id: 'order-1',
      known_order_products: [
        { id: 'p-serum', name: 'Hydrating Serum' },
        { id: 'p-spf', name: 'SPF 50 Sunscreen' },
      ],
      selected_products: 'all',
      current_intent: 'question',
      last_question_type: 'product_selection',
      language_preference: 'en',
      constraints: { routine_scope: 'unknown', simplicity: 'unknown', for_whom: 'unknown', routine_format: 'unknown' },
    });

    const res = await generateAIResponse(
      'all of them',
      'merchant-1',
      'user-1',
      'conv-memory-4',
      undefined,
      [{ role: 'assistant', content: 'old unrelated', timestamp: new Date().toISOString() } as any],
    );
    expect(res.response).toContain('Hydrating Serum');
  });

  it('prevents redundant purchased-product question when products are known', async () => {
    const conversationId = 'conv-memory-5';
    structuredStateStore.set(conversationId, {
      conversation_id: conversationId,
      order_id: 'order-1',
      known_order_products: [
        { id: 'p-serum', name: 'Hydrating Serum' },
        { id: 'p-spf', name: 'SPF 50 Sunscreen' },
      ],
      selected_products: 'all',
      last_question_type: 'routine_builder',
      constraints: { routine_scope: 'unknown', simplicity: 'unknown', for_whom: 'unknown', routine_format: 'unknown' },
    });

    forceGroundedError = true;
    const res = await generateAIResponse('Give me routine', 'merchant-1', 'user-1', conversationId, undefined, []);
    expect(res.response.toLowerCase()).not.toContain('which product are you using');
    expect(res.response.toLowerCase()).not.toContain('which products did you buy');
  });

  it('fallback branch still remembers and uses known products', async () => {
    const conversationId = 'conv-memory-6';
    structuredStateStore.set(conversationId, {
      conversation_id: conversationId,
      order_id: 'order-1',
      known_order_products: [
        { id: 'p-serum', name: 'Hydrating Serum' },
        { id: 'p-spf', name: 'SPF 50 Sunscreen' },
      ],
      selected_products: [],
      last_question_type: 'none',
      constraints: { routine_scope: 'unknown', simplicity: 'unknown', for_whom: 'unknown', routine_format: 'unknown' },
    });

    forceGroundedError = true;
    const res = await generateAIResponse('How to use?', 'merchant-1', 'user-1', conversationId, undefined, []);
    expect(res.response).toContain('Hydrating Serum');
    expect(res.requiresHuman).toBe(false);
  });
});
