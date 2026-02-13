/**
 * Guardrails Tests
 * Tests for content safety and guardrail checks
 */

import { describe, it, expect } from 'vitest';
import {
  checkUserMessageGuardrails,
  checkAIResponseGuardrails,
  getSafeResponse,
} from './guardrails';

describe('checkUserMessageGuardrails', () => {
  it('should detect crisis keywords', () => {
    const crisisMessages = [
      'I want to kill myself',
      'I am going to commit suicide',
      'I want to end my life',
    ];

    crisisMessages.forEach((message) => {
      const result = checkUserMessageGuardrails(message);
      expect(result.safe).toBe(false);
      expect(result.requiresHuman).toBe(true);
    });
  });

  it('should not detect crisis in normal messages', () => {
    const normalMessages = [
      'Hello, how are you?',
      'I want to return my order',
      'When will my order arrive?',
    ];

    normalMessages.forEach((message) => {
      const result = checkUserMessageGuardrails(message);
      expect(result.safe).toBe(true);
    });
  });
});

describe('checkAIResponseGuardrails', () => {
  it('should detect unsafe AI responses', () => {
    const unsafeResponses = [
      'You should kill yourself',
      'Take this medicine without consulting a doctor',
    ];

    unsafeResponses.forEach((response) => {
      const result = checkAIResponseGuardrails(response);
      expect(result.safe).toBe(false);
    });
  });

  it('should allow safe AI responses', () => {
    const safeResponses = [
      'Thank you for your question',
      'I can help you with that',
    ];

    safeResponses.forEach((response) => {
      const result = checkAIResponseGuardrails(response);
      expect(result.safe).toBe(true);
    });
  });
});

describe('Guardrail Integration', () => {
  it('should detect crisis situations requiring escalation', () => {
    const crisisResult = checkUserMessageGuardrails('I want to kill myself');
    
    expect(crisisResult.safe).toBe(false);
    expect(crisisResult.requiresHuman).toBe(true);
    expect(crisisResult.reason).toBe('crisis_keyword');
  });

  it('should allow normal messages', () => {
    const normalResult = checkUserMessageGuardrails('Hello, how are you?');
    const aiResult = checkAIResponseGuardrails('Thank you for your question');
    
    expect(normalResult.safe).toBe(true);
    expect(aiResult.safe).toBe(true);
  });
});

describe('getSafeResponse', () => {
  it('should return crisis response for crisis situations', () => {
    const response = getSafeResponse('crisis_keyword');

    expect(response).toBeDefined();
    expect(response).toContain('112');
    expect(response).toContain('acil');
  });

  it('should return medical advice response for medical questions', () => {
    const response = getSafeResponse('medical_advice');

    expect(response).toBeDefined();
    expect(response).toContain('tıbbi');
    expect(response).toContain('sağlık');
  });
});
