import { afterEach, describe, expect, it } from 'vitest';
import { hashNormalizedPhone, normalizeAndHashPhone } from './phoneLookup.js';

const ORIGINAL_ENV = {
  PHONE_LOOKUP_HASH_SECRET: process.env.PHONE_LOOKUP_HASH_SECRET,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET,
};

afterEach(() => {
  process.env.PHONE_LOOKUP_HASH_SECRET = ORIGINAL_ENV.PHONE_LOOKUP_HASH_SECRET;
  process.env.ENCRYPTION_KEY = ORIGINAL_ENV.ENCRYPTION_KEY;
  process.env.INTERNAL_SERVICE_SECRET = ORIGINAL_ENV.INTERNAL_SERVICE_SECRET;
});

describe('phoneLookup', () => {
  it('ignores invalid encryption key placeholders and falls back to internal secret', () => {
    process.env.PHONE_LOOKUP_HASH_SECRET = '';
    process.env.ENCRYPTION_KEY = 'your_32_character_encryption_key_here_change_in_production';
    process.env.INTERNAL_SERVICE_SECRET = '7c3541b17f96ec0d85fd8ff7669babac2806db2a0ccc0fe4';

    const result = normalizeAndHashPhone('+905545736900');
    expect(result.normalizedPhone).toBe('+905545736900');
    expect(result.phoneLookupHash).toBe(
      'cbf492fc79bce5887508585ec6aa0b0aa72b8695d506e25227c6833629c11bad'
    );
  });

  it('uses explicit phone lookup secret when provided', () => {
    process.env.PHONE_LOOKUP_HASH_SECRET = 'lookup-secret';
    process.env.ENCRYPTION_KEY = 'your_32_character_encryption_key_here_change_in_production';
    process.env.INTERNAL_SERVICE_SECRET = 'different-internal-secret';

    expect(hashNormalizedPhone('+905545736900')).toBe(
      '647b9e49d6b5df1b9071e9f3c184c70ffd3e43637cf87bf6052fffd3f9821ae9'
    );
  });
});
