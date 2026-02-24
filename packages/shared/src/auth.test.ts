import { describe, it, expect } from 'vitest';
import { getMerchantIdFromToken } from './auth';

function makeJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

describe('getMerchantIdFromToken', () => {
  it('returns sub claim when token is valid', () => {
    const token = makeJwt({ sub: 'merchant-123' });
    expect(getMerchantIdFromToken(token)).toBe('merchant-123');
  });

  it('returns null for invalid token', () => {
    expect(getMerchantIdFromToken('invalid')).toBeNull();
  });
});
