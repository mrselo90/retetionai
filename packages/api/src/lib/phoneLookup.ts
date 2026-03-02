import crypto from 'node:crypto';
import { normalizePhone } from './events.js';

function getLookupSecret(): string {
  const envSecret =
    process.env.PHONE_LOOKUP_HASH_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    process.env.INTERNAL_SERVICE_SECRET?.trim();
  // Deterministic fallback for local/dev environments where dedicated secret is not set.
  return envSecret || 'recete-phone-lookup-dev-fallback';
}

export function hashNormalizedPhone(normalizedPhone: string): string {
  return crypto
    .createHmac('sha256', getLookupSecret())
    .update(normalizedPhone, 'utf8')
    .digest('hex');
}

export function normalizeAndHashPhone(rawPhone: string): { normalizedPhone: string; phoneLookupHash: string } {
  const normalizedPhone = normalizePhone(rawPhone);
  return {
    normalizedPhone,
    phoneLookupHash: hashNormalizedPhone(normalizedPhone),
  };
}
