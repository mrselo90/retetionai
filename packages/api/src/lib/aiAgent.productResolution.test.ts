import { beforeEach, describe, expect, it, vi } from 'vitest';

let lastGroundedCall: any = null;
let mockStructuredState: any = null;

vi.mock('./openaiClient', () => ({
  getOpenAIClient: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async (input: any) => {
          const systemText = String(input?.messages?.[0]?.content || '');
          const userText = String(input?.messages?.[input.messages.length - 1]?.content || '');
          if (systemText.includes('intent classifier')) {
            return { choices: [{ message: { content: 'question' } }] };
          }
          if (systemText.includes('Infer customer goal')) {
            if (/routine|my products|these|them|all/i.test(userText)) {
              return { choices: [{ message: { content: 'build_routine' } }] };
            }
            return { choices: [{ message: { content: 'understand_product' } }] };
          }
          return { choices: [{ message: { content: 'ok' } }] };
        }),
      },
    },
  })),
}));

vi.mock('./runtimeModelSettings', () => ({
  getDefaultLlmModel: vi.fn(async () => 'gpt-4o-mini'),
  getConversationMemorySettings: vi.fn(async () => ({ mode: 'last_n', count: 10 })),
}));

vi.mock('./conversation', () => ({
  getConversationStructuredState: vi.fn(async (conversationId: string) => ({
    conversation_id: conversationId,
    order_id: 'order-1',
    known_order_products: mockStructuredState?.known_order_products || [],
    selected_products: mockStructuredState?.selected_products || [],
    current_intent: mockStructuredState?.current_intent,
    last_question_type: mockStructuredState?.last_question_type || 'none',
    language_preference: 'en',
    constraints: {
      routine_scope: 'unknown',
      simplicity: 'unknown',
      for_whom: 'unknown',
      routine_format: 'unknown',
      ...(mockStructuredState?.constraints || {}),
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
    productIds: ['p1', 'p2', 'p3'],
    source: 'external_events',
  })),
  formatRAGResultsForLLM: vi.fn(() => ''),
}));

vi.mock('./groundedAnswer', () => ({
  generateGroundedProductAnswer: vi.fn(async (input: any) => {
    lastGroundedCall = input;
    return {
      answer: `Guidance for ${Array.isArray(input.productIds) ? input.productIds.join(',') : 'all'}`,
      langDetected: 'en',
      citedProducts: Array.isArray(input.productIds) ? input.productIds : ['p1', 'p2'],
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

vi.mock('./multiLangRag/shopSettingsService', () => ({
  ShopSettingsService: class {
    async getOrCreate() {
      return { enabled_langs: ['en'], default_source_lang: 'en' };
    }
  },
}));

vi.mock('./aiUsageEvents', () => ({ trackAiUsageEvent: vi.fn() }));
vi.mock('./botInfo', () => ({ getMerchantBotInfo: vi.fn(async () => ({})) }));
vi.mock('./addons', () => ({
  isAddonActive: vi.fn(async () => false),
  logReturnPreventionAttempt: vi.fn(),
  hasPendingPreventionAttempt: vi.fn(async () => false),
  updatePreventionOutcome: vi.fn(),
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
                  { id: 'p1', name: 'Hydrating Serum' },
                  { id: 'p2', name: 'SPF 50 Sunscreen' },
                  { id: 'p3', name: 'Night Repair Cream' },
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

describe('product awareness and strict product resolution', () => {
  beforeEach(() => {
    mockStructuredState = null;
    lastGroundedCall = null;
    vi.clearAllMocks();
  });

  it('keeps multi-product awareness for generic usage question and does not re-ask', async () => {
    const response = await generateAIResponse(
      'How should I use my products?',
      'merchant-1',
      'user-1',
      'conv-pr-1',
      'order-1',
      [],
    );

    expect(Array.isArray(lastGroundedCall.productIds)).toBe(true);
    expect(lastGroundedCall.productIds).toEqual(['p1', 'p2', 'p3']);
    expect(response.response.toLowerCase()).not.toContain('which product');
  });

  it('treats "these/them" as full order product context', async () => {
    await generateAIResponse('How do I use these together?', 'merchant-1', 'user-1', 'conv-pr-1b', 'order-1', []);
    expect(lastGroundedCall.productIds).toEqual(['p1', 'p2', 'p3']);
  });

  it('maps index-based selection to correct product (second item)', async () => {
    const response = await generateAIResponse(
      '2',
      'merchant-1',
      'user-1',
      'conv-pr-2',
      'order-1',
      [{ role: 'assistant', content: '1. Hydrating Serum\n2. SPF 50 Sunscreen\n3. Night Repair Cream', timestamp: new Date().toISOString() } as any],
    );

    expect(lastGroundedCall.productIds).toEqual(['p2']);
    expect(response.response).toContain('p2');
  });

  it('maps ordinal selection to correct product (the second one)', async () => {
    const response = await generateAIResponse(
      'the second one',
      'merchant-1',
      'user-1',
      'conv-pr-2b',
      'order-1',
      [{ role: 'assistant', content: '1. Hydrating Serum\n2. SPF 50 Sunscreen\n3. Night Repair Cream', timestamp: new Date().toISOString() } as any],
    );

    expect(lastGroundedCall.productIds).toEqual(['p2']);
    expect(response.response).toContain('p2');
  });

  it('unknown product returns safe fallback and never substitutes another product', async () => {
    const response = await generateAIResponse(
      'How to use Deneme-1 product?',
      'merchant-1',
      'user-1',
      'conv-pr-3',
      'order-1',
      [],
    );

    expect(response.response).toContain('I do not have enough info about this product');
    expect(response.response).toContain('Hydrating Serum');
    expect(response.response).toContain('SPF 50 Sunscreen');
    expect(response.response).not.toContain('Guidance for p1');
    expect(lastGroundedCall).toBeNull();
  });

  it('does not return wrong product mapping for unknown reference', async () => {
    const response = await generateAIResponse(
      'Tell me about product X-999',
      'merchant-1',
      'user-1',
      'conv-pr-4',
      'order-1',
      [],
    );

    expect(response.response).toContain('I do not have enough info about this product');
    expect(lastGroundedCall).toBeNull();
  });
});
