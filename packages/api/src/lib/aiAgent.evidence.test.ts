import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Intent classification sees the conversation, and complaint/chat replies get
 * product evidence (they used to reach the model with none).
 */

let classifierLabel = 'complaint';
let structuredOrderId: string | null = 'order-1';
const modelCalls: Array<{ system: string; user: string }> = [];
const retrieve = vi.fn(async () => ({
  query: '',
  results: [],
  totalResults: 0,
  executionTime: 0,
  effectiveLanguage: 'en',
  usedFallback: false,
  fallbackLanguage: null,
}));

vi.mock('./openaiClient', () => ({
  getOpenAIClient: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async (input: any) => {
          const system = String(input.messages?.[0]?.content || '');
          const user = String(input.messages?.[input.messages.length - 1]?.content || '');
          modelCalls.push({ system, user });
          const content = system.includes('intent classifier') ? classifierLabel : 'Reply text';
          return { choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
        }),
      },
    },
  })),
}));

vi.mock('./runtimeModelSettings', () => ({
  getDefaultLlmModel: vi.fn(async () => 'gpt-4o-mini'),
  getConversationMemorySettings: vi.fn(async () => ({ mode: 'last_n', count: 10 })),
}));
vi.mock('./aiUsageEvents', () => ({ trackAiUsageEvent: vi.fn() }));
vi.mock('./botInfo', () => ({ getMerchantBotInfo: vi.fn(async () => ({})) }));
vi.mock('./addons', () => ({ isAddonActive: vi.fn(async () => false) }));
vi.mock('./conversation', () => ({
  getConversationStructuredState: vi.fn(async (conversationId: string) => ({
    conversation_id: conversationId,
    order_id: structuredOrderId,
    known_order_products: [],
    selected_products: [],
    last_question_type: 'none',
    language_preference: 'en',
    constraints: { routine_scope: 'unknown', simplicity: 'unknown', for_whom: 'unknown', routine_format: 'unknown' },
    updated_at: new Date().toISOString(),
  })),
  updateConversationStructuredState: vi.fn(async (_id: string, patch: any) => patch),
}));
vi.mock('./multiLangRag/shopSettingsService', () => ({
  ShopSettingsService: class {
    async getOrCreate() {
      return { enabled_langs: ['en'], default_source_lang: 'en' };
    }
  },
}));
vi.mock('./guardrails', () => ({
  checkUserMessageGuardrailsWithoutCrisis: vi.fn(() => ({ safe: true, requiresHuman: false })),
  checkAIResponseGuardrails: vi.fn(() => ({ safe: true, requiresHuman: false })),
  evaluateCrisisEscalation: vi.fn(async () => ({ shouldEscalate: false, precheckMatched: false, llmConfirmed: false, severity: 'none' })),
  checkForHumanHandoffRequest: vi.fn(() => false),
  escalateToHuman: vi.fn(),
  getSafeResponse: vi.fn(() => 'Safe response'),
}));
vi.mock('./rag', () => ({
  getOrderProductContextResolved: vi.fn(async () => ({ productIds: ['p-serum'], source: 'external_events' })),
  formatRAGResultsForLLM: vi.fn(() => ''),
}));
vi.mock('./groundedAnswer', () => ({ generateGroundedProductAnswer: vi.fn() }));
vi.mock('./unifiedRetrieval', () => ({
  // A class: Vitest 5 can't call an arrow-function mock implementation with `new`.
  UnifiedRetrievalService: class {
    retrieve = retrieve;
  },
}));
vi.mock('./productFactsQuery', () => ({
  getActiveProductFactsContext: vi.fn(async () => ({ text: '', factCount: 0 })),
  getActiveProductFactsSnapshots: vi.fn(async () => []),
}));
vi.mock('./groundingAssembler', () => ({
  buildGroundedEvidenceContext: vi.fn(({ instructions }: { instructions?: unknown[] }) =>
    instructions?.length ? 'EVIDENCE: apply 2-3 drops after cleansing; stop if redness occurs' : '',
  ),
}));
vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'merchants') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { name: 'Test Merchant', persona_settings: {}, guardrail_settings: {} }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({ data: [{ id: 'p-serum', name: 'Hydrating Serum' }], error: null }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  getProductInstructionsByProductIds: vi.fn(async () => [
    { product_id: 'p-serum', product_name: 'Hydrating Serum', usage_instructions: 'Apply 2-3 drops after cleansing.' },
  ]),
}));

import { buildIntentClassifierInput, generateAIResponse } from './aiAgent';

const at = new Date().toISOString();
const replyCall = () => modelCalls.find((call) => call.system.includes('IMPORTANT RULES'));
const classifierCall = () => modelCalls.find((call) => call.system.includes('intent classifier'));

describe('buildIntentClassifierInput', () => {
  it('returns the message alone without history', () => {
    expect(buildIntentClassifierInput('Hello')).toBe('Hello');
  });

  it('includes the recent turns, newest last, trimmed', () => {
    const history = Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn ${i} ${'x'.repeat(i === 7 ? 400 : 1)}`,
      timestamp: at,
    }));
    const input = buildIntentClassifierInput('peki akşam?', history);
    expect(input).toContain('Recent conversation:');
    expect(input).not.toContain('turn 1 ');
    expect(input).toContain('Customer: turn 2');
    expect(input).toContain('Assistant: turn 7');
    expect(input).toContain('…');
    expect(input.endsWith('Latest customer message:\npeki akşam?')).toBe(true);
  });
});

describe('generateAIResponse evidence for non-question intents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelCalls.length = 0;
    classifierLabel = 'complaint';
    structuredOrderId = 'order-1';
  });

  it('classifies with the conversation, without repeating the current message', async () => {
    classifierLabel = 'question';
    const history = [
      { role: 'assistant' as const, content: 'Apply 2-3 drops in the morning.', timestamp: at },
      { role: 'user' as const, content: 'and at night?', timestamp: at },
    ];
    await generateAIResponse('and at night?', 'merchant-1', 'user-1', 'conversation-1', 'order-1', history);

    const input = classifierCall()!.user;
    expect(input).toContain('Assistant: Apply 2-3 drops in the morning.');
    // The inbound processor stores the message before loading history; it must appear once.
    expect(input.split('and at night?')).toHaveLength(2);
  });

  it('gives a complaint the order products’ instructions as evidence', async () => {
    const response = await generateAIResponse(
      'This serum made my face red',
      'merchant-1',
      'user-1',
      'conversation-1',
      'order-1',
      [],
    );

    expect(response.intent).toBe('complaint');
    expect(retrieve).toHaveBeenCalledTimes(1);
    const system = replyCall()!.system;
    expect(system).toContain('PRODUCT INFORMATION');
    expect(system).toContain('stop if redness occurs');
    expect(system).toContain('Never state order status, shipping or delivery times');
    expect(system).toContain('You are not a medical professional');
  });

  it('gives chat in an order conversation evidence, worded for small talk', async () => {
    classifierLabel = 'chat';
    await generateAIResponse('thanks!', 'merchant-1', 'user-1', 'conversation-1', 'order-1', []);

    expect(retrieve).toHaveBeenCalledTimes(1);
    const system = replyCall()!.system;
    expect(system).toContain('PRODUCT INFORMATION');
    expect(system).toContain('For greetings or thanks, reply naturally');
  });

  it('does not retrieve for chat without an order', async () => {
    classifierLabel = 'chat';
    structuredOrderId = null;
    await generateAIResponse('hello', 'merchant-1', 'user-1', 'conversation-1', undefined, []);

    expect(retrieve).not.toHaveBeenCalled();
    expect(replyCall()!.system).not.toContain('PRODUCT INFORMATION');
  });
});
