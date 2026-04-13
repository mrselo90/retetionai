import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockMemorySettings: { mode: 'last_n' | 'full'; count: number } = { mode: 'last_n', count: 10 };
let mockHandoffRequest = false;
let mockMerchantPersona: Record<string, unknown> = {};
let mockEnabledLangs: string[] = ['en'];
let mockStructuredState: any = null;
let mockCrisisDecision = {
  shouldEscalate: false,
  precheckMatched: false,
  llmConfirmed: false,
  severity: 'none',
} as any;

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
  evaluateCrisisEscalation: vi.fn(async () => mockCrisisDecision),
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

async function runTranscript(steps: Array<{ role: 'assistant' | 'user'; content: string }>) {
  const history: any[] = [];
  const outputs: Array<{ message: string; response: Awaited<ReturnType<typeof generateAIResponse>> }> = [];

  for (const step of steps) {
    if (step.role === 'assistant') {
      history.push({ role: 'assistant', content: step.content, timestamp: new Date().toISOString() });
      continue;
    }

    const response = await generateAIResponse(
      step.content,
      'merchant-1',
      'user-1',
      'conversation-1',
      'order-1',
      history as any,
    );
    outputs.push({ message: step.content, response });
    history.push({ role: 'user', content: step.content, timestamp: new Date().toISOString() });
    history.push({ role: 'assistant', content: response.response, timestamp: new Date().toISOString() });
  }

  return outputs;
}

describe('conversation quality fixtures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMemorySettings = { mode: 'last_n', count: 10 };
    mockHandoffRequest = false;
    mockMerchantPersona = {};
    mockEnabledLangs = ['en'];
    mockStructuredState = null;
    mockCrisisDecision = {
      shouldEscalate: false,
      precheckMatched: false,
      llmConfirmed: false,
      severity: 'none',
    };
  });

  it('handles short contextual routine continuation naturally', async () => {
    const outputs = await runTranscript([
      { role: 'assistant', content: 'Which products would you like to use in your routine?' },
      { role: 'user', content: 'all of them' },
    ]);

    const last = outputs.at(-1)!.response;
    expect(last.response).toContain('Morning');
    expect(last.response).toContain('Evening');
    expect(last.response.toLowerCase()).not.toContain('could you clarify');
    expect(last.requiresHuman).toBe(false);
  });

  it('adapts to simple scope constraints: morning only + keep it simple', async () => {
    const outputs = await runTranscript([
      { role: 'assistant', content: 'Should I make a morning/evening routine?' },
      { role: 'user', content: 'morning only, keep it simple' },
    ]);
    const last = outputs.at(-1)!.response;
    expect(last.response).toContain('Morning');
    expect(last.response).not.toContain('Evening');
    expect(last.response.length).toBeLessThan(700);
  });

  it('handles indirect request: for my wife + just tell me the order', async () => {
    const outputs = await runTranscript([
      { role: 'assistant', content: 'Which products should I include?' },
      { role: 'user', content: 'for my wife, just tell me the order' },
    ]);
    const last = outputs.at(-1)!.response;
    expect(last.response.toLowerCase()).toContain('for your wife');
    expect(last.response).toContain('Just the order');
  });

  it('respects supported language settings in mixed-language thread', async () => {
    mockEnabledLangs = ['en'];
    const outputs = await runTranscript([
      { role: 'assistant', content: 'Hangi ürünleri birlikte kullanmak istersiniz?' },
      { role: 'user', content: 'hepsi, lütfen sabah akşam rutin ver' },
    ]);
    const last = outputs.at(-1)!.response;
    expect(last.response).toContain('I can currently help in these languages');
    expect(last.response).toContain('Morning');
  });

  it('applies configured tone/length/emoji policy to deterministic replies', async () => {
    mockMerchantPersona = { tone: 'formal', response_length: 'short', emoji: false };
    mockHandoffRequest = true;

    const outputs = await runTranscript([{ role: 'user', content: 'please connect me to a human' }]);
    const last = outputs.at(-1)!.response;
    expect(last.requiresHuman).toBe(true);
    expect(last.response).not.toContain('🙏');
    expect(last.response.length).toBeLessThan(420);
  });

  it('does not escalate harmless routine request as crisis', async () => {
    const outputs = await runTranscript([
      { role: 'assistant', content: 'How can I help with your products?' },
      { role: 'user', content: 'can you make a routine with all of them?' },
    ]);
    const last = outputs.at(-1)!.response;
    expect(last.requiresHuman).toBe(false);
    expect(last.guardrailBlocked).toBe(false);
  });

  it('still escalates real high-severity crisis', async () => {
    mockCrisisDecision = {
      shouldEscalate: true,
      precheckMatched: true,
      llmConfirmed: true,
      severity: 'high',
      reason: 'llm_confirmed',
      suggestedResponse: 'Emergency response',
    };
    const outputs = await runTranscript([{ role: 'user', content: 'I want to kill myself' }]);
    const last = outputs.at(-1)!.response;
    expect(last.requiresHuman).toBe(true);
    expect(last.guardrailBlocked).toBe(true);
  });
});
