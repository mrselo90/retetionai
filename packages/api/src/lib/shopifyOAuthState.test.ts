import { describe, it, expect, beforeEach } from 'vitest';
import { createShopifyOAuthState, verifyShopifyOAuthState } from './shopifyOAuthState';

describe('shopifyOAuthState', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = 'test-shopify-secret';
  });

  it('round-trips the merchant id for the shop it was issued for', () => {
    const state = createShopifyOAuthState('merchant-1', 'shop-a.myshopify.com');
    expect(verifyShopifyOAuthState(state, 'shop-a.myshopify.com')).toBe('merchant-1');
  });

  it('rejects the old unsigned base64 JSON state', () => {
    const forged = Buffer.from(JSON.stringify({ merchantId: 'victim', n: 'x' })).toString(
      'base64url'
    );
    expect(verifyShopifyOAuthState(forged, 'shop-a.myshopify.com')).toBeNull();
  });

  it('rejects a payload swapped under a valid signature', () => {
    const state = createShopifyOAuthState('attacker', 'shop-a.myshopify.com');
    const [, signature] = state.split('.');
    const swapped = Buffer.from(
      JSON.stringify({ merchantId: 'victim', shop: 'shop-a.myshopify.com', iat: Date.now(), n: 'x' })
    ).toString('base64url');
    expect(verifyShopifyOAuthState(`${swapped}.${signature}`, 'shop-a.myshopify.com')).toBeNull();
  });

  it('rejects a state signed with a different secret', () => {
    const state = createShopifyOAuthState('merchant-1', 'shop-a.myshopify.com');
    process.env.SHOPIFY_API_SECRET = 'other-secret';
    expect(verifyShopifyOAuthState(state, 'shop-a.myshopify.com')).toBeNull();
  });

  it('rejects a state issued for another shop', () => {
    const state = createShopifyOAuthState('merchant-1', 'shop-a.myshopify.com');
    expect(verifyShopifyOAuthState(state, 'shop-b.myshopify.com')).toBeNull();
  });

  it('rejects an expired state', () => {
    const issuedAt = Date.now() - 11 * 60 * 1000;
    const state = createShopifyOAuthState('merchant-1', 'shop-a.myshopify.com', issuedAt);
    expect(verifyShopifyOAuthState(state, 'shop-a.myshopify.com')).toBeNull();
  });
});
