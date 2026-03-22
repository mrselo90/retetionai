import { describe, it, expect } from 'vitest';
import { buildGroundedPrompt, buildGroundedMessages } from './groundedPromptBuilder';

describe('buildGroundedPrompt', () => {
  it('should build a prompt with merchant name and bot persona', () => {
    const prompt = buildGroundedPrompt({
      merchantName: 'DermShop',
      persona: { bot_name: 'DermBot', tone: 'friendly', emoji: true, response_length: 'short' },
      intent: 'question',
      ragContext: 'Product A contains vitamin C.',
      lang: 'en',
      channel: 'whatsapp',
    });

    expect(prompt).toContain('DermBot');
    expect(prompt).toContain('DermShop');
    expect(prompt).toContain('friendly and warm');
    expect(prompt).toContain('Use appropriate emojis sparingly');
    expect(prompt).toContain('Keep responses brief');
    expect(prompt).toContain('WhatsApp');
    expect(prompt).toContain('Product A contains vitamin C.');
  });

  it('should include NO PRODUCT EVIDENCE block when ragContext is empty', () => {
    const prompt = buildGroundedPrompt({
      merchantName: 'TestShop',
      intent: 'question',
      lang: 'en',
      channel: 'api',
    });

    expect(prompt).toContain('NO PRODUCT EVIDENCE AVAILABLE');
  });

  it('should include return intent instructions', () => {
    const prompt = buildGroundedPrompt({
      merchantName: 'TestShop',
      intent: 'return_intent',
      ragContext: 'Some product info',
      lang: 'en',
      channel: 'whatsapp',
    });

    expect(prompt).toContain('dissatisfied');
    expect(prompt).toContain('return');
  });

  it('should include bot info when provided', () => {
    const prompt = buildGroundedPrompt({
      merchantName: 'TestShop',
      intent: 'question',
      ragContext: 'Context',
      botInfo: {
        brand_guidelines: 'Always mention our natural ingredients.',
        custom_instructions: 'Recommend sunscreen after treatment.',
      },
      lang: 'en',
      channel: 'api',
    });

    expect(prompt).toContain('Always mention our natural ingredients');
    expect(prompt).toContain('Recommend sunscreen after treatment');
  });

  it('should not include emoji instructions when emoji is false', () => {
    const prompt = buildGroundedPrompt({
      merchantName: 'TestShop',
      persona: { emoji: false },
      intent: 'question',
      lang: 'en',
      channel: 'api',
    });

    expect(prompt).toContain('Do not use emojis');
  });

  it('should include runtime hint when provided', () => {
    const prompt = buildGroundedPrompt({
      merchantName: 'TestShop',
      intent: 'question',
      ragContext: 'Context',
      runtimeHint: 'Customer bought this 3 days ago',
      lang: 'en',
      channel: 'whatsapp',
    });

    expect(prompt).toContain('Customer bought this 3 days ago');
  });

  it('should specify the response language', () => {
    const prompt = buildGroundedPrompt({
      merchantName: 'TestShop',
      intent: 'question',
      lang: 'tr',
      channel: 'api',
    });

    expect(prompt).toContain('respond in tr');
  });
});

describe('buildGroundedMessages', () => {
  it('should create system + user messages with no history', () => {
    const messages = buildGroundedMessages('System prompt', 'User question');

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'system', content: 'System prompt' });
    expect(messages[1]).toEqual({ role: 'user', content: 'User question' });
  });

  it('should include conversation history between system and user messages', () => {
    const history = [
      { role: 'user' as const, content: 'Hi' },
      { role: 'assistant' as const, content: 'Hello!' },
      { role: 'user' as const, content: 'Tell me about product X' },
      { role: 'assistant' as const, content: 'Product X is...' },
    ];
    const messages = buildGroundedMessages('System', 'New question', history);

    expect(messages).toHaveLength(6);
    expect(messages[0].role).toBe('system');
    expect(messages[1]).toEqual({ role: 'user', content: 'Hi' });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'Hello!' });
    expect(messages[5]).toEqual({ role: 'user', content: 'New question' });
  });

  it('should skip empty history messages', () => {
    const history = [
      { role: 'user' as const, content: '' },
      { role: 'assistant' as const, content: 'Valid reply' },
      { role: 'user' as const, content: '  ' },
    ];
    const messages = buildGroundedMessages('System', 'Question', history);

    expect(messages).toHaveLength(3);
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Valid reply' });
  });

  it('should map merchant role to assistant', () => {
    const history = [
      { role: 'merchant' as const, content: 'Merchant note' },
    ];
    const messages = buildGroundedMessages('System', 'Q', history);

    expect(messages[1]).toEqual({ role: 'assistant', content: 'Merchant note' });
  });
});
