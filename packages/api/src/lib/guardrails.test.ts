/**
 * Guardrails Tests
 * Tests for content safety and guardrail checks
 */

import { describe, it, expect } from 'vitest';
import {
  checkUserMessageGuardrails,
  checkUserMessageGuardrailsWithoutCrisis,
  checkAIResponseGuardrails,
  checkForHumanHandoffRequest,
  evaluateCrisisEscalation,
  getSafeResponse,
} from './guardrails';

describe('checkUserMessageGuardrails', () => {
  it('should detect crisis keywords', () => {
    const crisisMessages = [
      'I want to kill myself',
      'I am going to commit suicide',
      'I want to end my life',
      'I will sue you and open a legal case',
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
      'I want to help. Could you share a bit more detail so I can better understand your question?',
      'Great, I can build a morning and evening routine with all your products.',
    ];

    safeResponses.forEach((response) => {
      const result = checkAIResponseGuardrails(response);
      expect(result.safe).toBe(true);
    });
  });

  it('should not escalate harmless routine guidance phrases as crisis', () => {
    const result = checkAIResponseGuardrails(
      'Great, for all of them I can suggest: Morning cleanser + SPF, Evening cleanser + serum.',
    );
    expect(result.safe).toBe(true);
    expect(result.requiresHuman).toBe(false);
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

  it('should not classify "for all of them" as crisis', () => {
    const result = checkUserMessageGuardrails('For all of them');
    expect(result.safe).toBe(true);
    expect(result.requiresHuman).toBe(false);
  });

  it('should keep unclear but harmless messages non-crisis', () => {
    const result = checkUserMessageGuardrails('Can you help me with this?');
    expect(result.safe).toBe(true);
    expect(result.requiresHuman).toBe(false);
  });
});

describe('Layered crisis evaluation', () => {
  it('should not escalate harmless message even if precheck can be noisy', async () => {
    const fakeLlm = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: '{"is_crisis":false,"severity":"low"}' } }],
          }),
        },
      },
    };
    const result = await evaluateCrisisEscalation({
      userMessage: 'Can you help me use them together?',
      model: 'gpt-4o-mini',
      llmClient: fakeLlm as any,
    });
    expect(result.shouldEscalate).toBe(false);
  });

  it('should escalate high-severity self-harm without waiting for LLM', async () => {
    const fakeLlm = {
      chat: {
        completions: {
          create: async () => {
            throw new Error('should not be called');
          },
        },
      },
    };
    const result = await evaluateCrisisEscalation({
      userMessage: 'I want to kill myself',
      model: 'gpt-4o-mini',
      llmClient: fakeLlm as any,
    });
    expect(result.shouldEscalate).toBe(true);
    expect(result.severity).toBe('high');
  });

  it('should keep medical/custom checks working when crisis is handled separately', () => {
    const result = checkUserMessageGuardrailsWithoutCrisis('I need medical treatment advice');
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('medical_advice');
  });
});

describe('Human handoff detection', () => {
  it('should still detect explicit human handoff requests', () => {
    expect(checkForHumanHandoffRequest('I want to speak to a human agent')).toBe(true);
    expect(checkForHumanHandoffRequest('Can you connect me to customer support?')).toBe(true);
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
