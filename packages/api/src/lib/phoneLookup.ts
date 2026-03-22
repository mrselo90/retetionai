import crypto from 'node:crypto';
import { normalizePhone } from './events.js';

function getLookupSecret(): string {
  const phoneLookupSecret = process.env.PHONE_LOOKUP_HASH_SECRET?.trim();
  if (phoneLookupSecret) return phoneLookupSecret;

  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  if (encryptionKey && /^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    return encryptionKey;
  }

  const envSecret =
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
