/**
 * New Relic custom event helpers.
 *
 * `newrelic` is loaded via `-r newrelic` node flag at startup.
 * We always guard with optional chaining so this file is safe to import
 * even when New Relic is not loaded (dev, test, start:no-nr).
 */

function record(eventType: string, attrs: Record<string, unknown>): void {
  (globalThis as any).newrelic?.recordCustomEvent(eventType, {
    ...attrs,
    timestamp: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

export function trackWhatsAppSent(attrs: {
  merchantId: string;
  messageKind: string;
  provider: string;
  success: boolean;
  userId?: string;
}): void {
  record('WhatsAppSent', attrs);
}

export function trackWhatsAppReceived(attrs: {
  merchantId: string;
  intent?: string;
  language?: string;
}): void {
  record('WhatsAppReceived', attrs);
}

// ---------------------------------------------------------------------------
// Workers / Jobs
// ---------------------------------------------------------------------------

export function trackWorkerJob(attrs: {
  queue: string;
  jobId: string;
  status: 'completed' | 'failed';
  durationMs?: number;
  merchantId?: string;
}): void {
  record('WorkerJob', attrs);
}

// ---------------------------------------------------------------------------
// Business features
// ---------------------------------------------------------------------------

export function trackAIVision(attrs: {
  merchantId: string;
  success: boolean;
  planAllowed: boolean;
}): void {
  record('AIVision', attrs);
}

export function trackUpsell(attrs: {
  merchantId: string;
  strategy: string;
  triggered: boolean;
}): void {
  record('Upsell', attrs);
}

export function trackRecipeLimitHit(attrs: {
  merchantId: string;
  current: number;
  limit: number;
}): void {
  record('RecipeLimitHit', attrs);
}

export function trackCommerceEvent(attrs: {
  merchantId?: string;
  topic: string;
  status: 'processed' | 'failed';
}): void {
  record('CommerceEvent', attrs);
}

export function trackConversation(attrs: {
  merchantId: string;
  event: 'created' | 'resolved' | 'escalated';
}): void {
  record('Conversation', attrs);
}

export function trackScheduledMessage(attrs: {
  merchantId: string;
  type: string;
  status: 'sent' | 'skipped' | 'failed';
}): void {
  record('ScheduledMessage', attrs);
}
