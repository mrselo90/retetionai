import crypto from 'node:crypto';
import { logger } from '@recete/shared';
import { trackAiUsageEvent } from './aiUsageEvents.js';

type PilotDiagnosticInput = {
  merchantId: string;
  conversationId?: string;
  orderId?: string;
  model: string;
  userMessage: string;
  assistantResponse: string;
  diagnostics: Record<string, unknown>;
};

function hashText(value: string): string {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function sanitizePreview(value: string, max = 180): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

export async function captureAssistantPilotDiagnostic(input: PilotDiagnosticInput): Promise<void> {
  const sanitized = {
    conversationId: input.conversationId || null,
    orderId: input.orderId || null,
    userMessagePreview: sanitizePreview(input.userMessage),
    assistantResponsePreview: sanitizePreview(input.assistantResponse),
    userMessageHash: hashText(input.userMessage),
    assistantResponseHash: hashText(input.assistantResponse),
    ...input.diagnostics,
  };

  logger.info(
    {
      merchantId: input.merchantId,
      conversationId: input.conversationId || null,
      orderId: input.orderId || null,
      pilotDiagnostic: sanitized,
    },
    'assistant_pilot_diagnostic',
  );

  await trackAiUsageEvent({
    merchantId: input.merchantId,
    feature: 'assistant_pilot_diagnostic',
    model: input.model,
    requestKind: 'other',
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    metadata: sanitized,
  });
}

