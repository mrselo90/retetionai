/**
 * AI Agent Tests
 * Tests for AI agent functionality (intent classification, response generation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyIntent, detectPostDeliveryFollowUpSignal, generateAIResponse } from './aiAgent';
import { __setOpenAIClientForTests } from './openaiClient';

// Mock dependencies
vi.mock('./rag', () => ({
  queryKnowledgeBase: vi.fn(),
  formatRAGResultsForLLM: vi.fn(),
}));

vi.mock('./groundedAnswer', () => ({
  generateGroundedProductAnswer: vi.fn(),
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
  getSafeResponse: vi.fn(),
}));

vi.mock('./i18n', () => ({
  detectLanguage: vi.fn(() => 'en'),
  resolveMerchantReplyLanguage: vi.fn(() => ({
    responseLanguage: 'en',
    usedFallback: false,
    supportedLanguages: ['en'],
  })),
  buildUnsupportedLanguageNotice: vi.fn(() => 'Unsupported language fallback applied.'),
  getLocalizedHandoffResponse: vi.fn(() => 'Connecting you with our team.'),
  getLocalizedEscalationResponse: vi.fn(() => 'Let me connect you with a team member.'),
}));

vi.mock('./conversation', () => ({
  findUserByPhone: vi.fn(),
  getOrCreateConversation: vi.fn(),
  addMessageToConversation: vi.fn(),
  getConversationHistory: vi.fn(() => []),
  getConversationStructuredState: vi.fn(async (conversationId: string) => ({
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
  })),
  updateConversationStructuredState: vi.fn(async (_conversationId: string, patch: any) => patch),
}));

describe('classifyIntent', () => {
  let mockCreate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn();
    __setOpenAIClientForTests({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    } as any);
  });

  it('should classify question intent', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'question',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 10,
        total_tokens: 110,
      },
    });

    const intent = await classifyIntent('What is the size of this product?');

    expect(intent).toBe('question');
  });

  it('should classify complaint intent', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'complaint',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 10,
        total_tokens: 110,
      },
    });

    const intent = await classifyIntent('My order is damaged');

    expect(intent).toBe('complaint');
  });

  it('should default to chat for invalid classification', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'invalid',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 10,
        total_tokens: 110,
      },
    });

    const intent = await classifyIntent('Hello');

    expect(intent).toBe('chat');
  });

  it('should handle API errors gracefully', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API Error'));

    const intent = await classifyIntent('Test message');

    // Should default to chat on error
    expect(intent).toBe('chat');
  });
});

describe('generateAIResponse', () => {
  let mockCreate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn();
    __setOpenAIClientForTests({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    } as any);
  });

  it('should generate AI response with RAG context', async () => {
    const { generateGroundedProductAnswer } = await import('./groundedAnswer');
    (generateGroundedProductAnswer as any).mockResolvedValueOnce({
      answer: 'This product is available in size M.',
      langDetected: 'en',
      citedProducts: ['p1'],
      latencyMs: 10,
      ragContext: 'Context: This product is size M',
      usedDeterministicFacts: false,
      orderScopeSource: undefined,
      retrievalLanguage: 'en',
      retrievalUsedFallback: false,
      retrievalFallbackLanguage: null,
    });

    // Mock OpenAI call: intent classification
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'question' } }],
    });

    const response = await generateAIResponse(
      'What is the size?',
      'test-merchant-id',
      'test-user-id',
      'test-conversation-id'
    );

    expect(response).toBeDefined();
    expect(response.intent).toBeDefined();
    expect(response.response).toBeDefined();
    expect(response.response).toContain('size M');
    expect(generateGroundedProductAnswer).toHaveBeenCalled();
  });

  it('should handle guardrail violations', async () => {
    const { evaluateCrisisEscalation } = await import('./guardrails');

    (evaluateCrisisEscalation as any).mockResolvedValueOnce({
      shouldEscalate: true,
      precheckMatched: true,
      llmConfirmed: true,
      severity: 'high',
      reason: 'llm_confirmed',
      suggestedResponse: 'Crisis response',
    });

    const response = await generateAIResponse(
      'I want to kill myself',
      'test-merchant-id',
      'test-user-id',
      'test-conversation-id'
    );

    expect(response.guardrailBlocked).toBe(true);
    expect(response.requiresHuman).toBe(true);
  });

  it('should use conversation history', async () => {
    const history = [
      { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Hi! How can I help?', timestamp: new Date().toISOString() },
    ];

    // intent classification
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'chat' } }],
    });
    // user goal inference
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'smalltalk' } }],
    });
    // final response generation
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Test response',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 200,
        completion_tokens: 50,
        total_tokens: 250,
      },
    });

    const response = await generateAIResponse(
      'What is the size?',
      'test-merchant-id',
      'test-user-id',
      'test-conversation-id',
      undefined,
      history
    );

    expect(response).toBeDefined();
    // Should include conversation history in messages
    const callArgs = mockCreate.mock.calls[mockCreate.mock.calls.length - 1]?.[0];
    const messages = callArgs?.messages || [];
    expect(messages.some((m: any) => m?.content === 'Hello')).toBe(true);
    expect(messages.some((m: any) => m?.content === 'Hi! How can I help?')).toBe(true);
  });
});

describe('detectPostDeliveryFollowUpSignal', () => {
  it('should detect standalone routine-building asks', () => {
    const signal = detectPostDeliveryFollowUpSignal('Can you make a daily skincare routine?');
    expect(signal.detected).toBe(true);
    expect(signal.type).toBe('usage_routine_request');
    expect(signal.promoteIntentToQuestion).toBe(true);
  });

  it('should detect "use all products together" phrasing', () => {
    const signal = detectPostDeliveryFollowUpSignal('How should I use all the products together?');
    expect(signal.detected).toBe(true);
    expect(signal.type).toBe('usage_routine_request');
  });

  it('should treat "For all of them" as valid continuation in product-selection context', () => {
    const signal = detectPostDeliveryFollowUpSignal('For all of them', [
      {
        role: 'assistant',
        content: 'Which products would you like to use in your routine?',
        timestamp: new Date().toISOString(),
      } as any,
    ]);
    expect(signal.detected).toBe(true);
    expect(signal.type).toBe('usage_routine_request');
    expect(signal.promoteIntentToQuestion).toBe(true);
  });
});
