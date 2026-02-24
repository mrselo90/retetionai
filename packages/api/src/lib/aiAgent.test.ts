/**
 * AI Agent Tests
 * Tests for AI agent functionality (intent classification, response generation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyIntent, generateAIResponse } from './aiAgent';
import { __setOpenAIClientForTests } from './openaiClient';

// Mock dependencies
vi.mock('./rag', () => ({
  queryKnowledgeBase: vi.fn(),
  formatRAGResultsForLLM: vi.fn(),
}));

vi.mock('./guardrails', () => ({
  checkUserMessageGuardrails: vi.fn(() => ({ safe: true, requiresHuman: false })),
  checkAIResponseGuardrails: vi.fn(() => ({ safe: true, requiresHuman: false })),
  checkForHumanHandoffRequest: vi.fn(() => false),
  escalateToHuman: vi.fn(),
  getSafeResponse: vi.fn(),
}));

vi.mock('./i18n', () => ({
  detectLanguage: vi.fn(() => 'en'),
  getLocalizedHandoffResponse: vi.fn(() => 'Connecting you with our team.'),
  getLocalizedEscalationResponse: vi.fn(() => 'Let me connect you with a team member.'),
}));

vi.mock('./conversation', () => ({
  findUserByPhone: vi.fn(),
  getOrCreateConversation: vi.fn(),
  addMessageToConversation: vi.fn(),
  getConversationHistory: vi.fn(() => []),
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
    const { queryKnowledgeBase, formatRAGResultsForLLM } = await import('./rag');

    // Mock RAG query
    (queryKnowledgeBase as any).mockResolvedValueOnce({
      results: [
        {
          chunkText: 'This product is size M',
          productName: 'Test Product',
          similarity: 0.95,
        },
      ],
      totalResults: 1,
    });

    (formatRAGResultsForLLM as any).mockReturnValueOnce('Context: This product is size M');

    // Mock OpenAI calls:
    // 1) intent classification
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'question' } }],
    });
    // 2) final response generation
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'This product is available in size M.',
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
      'test-conversation-id'
    );

    expect(response).toBeDefined();
    expect(response.intent).toBeDefined();
    expect(response.response).toBeDefined();
    expect(response.response).toContain('size M');
  });

  it('should handle guardrail violations', async () => {
    const { checkUserMessageGuardrails } = await import('./guardrails');

    (checkUserMessageGuardrails as any).mockReturnValueOnce({
      safe: false,
      reason: 'crisis_keyword',
      requiresHuman: true,
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
    const callArgs = mockCreate.mock.calls[1]?.[0];
    const messages = callArgs?.messages || [];
    expect(messages.some((m: any) => m?.content === 'Hello')).toBe(true);
    expect(messages.some((m: any) => m?.content === 'Hi! How can I help?')).toBe(true);
  });
});
