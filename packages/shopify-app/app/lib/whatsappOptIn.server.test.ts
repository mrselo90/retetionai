import { describe, expect, it, vi } from 'vitest';
import { getOptInStatus, OPT_IN_WINDOW_MS, subscribeToWhatsApp, toOrderGid } from './whatsappOptIn.server';

const now = Date.parse('2026-10-23T12:00:00Z');

function adminReturning(data: unknown) {
  const graphql = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data })));
  return { admin: { graphql }, graphql };
}

const order = (overrides: Record<string, unknown> = {}) => ({
  order: {
    createdAt: '2026-10-23T11:30:00Z',
    checkoutToken: 'chk_123',
    customer: {
      id: 'gid://shopify/Customer/42',
      defaultPhoneNumber: { phoneNumber: '+447700900123', whatsAppMarketingConsent: { state: 'NEVER_SUBSCRIBED' } },
    },
    ...overrides,
  },
});

describe('toOrderGid', () => {
  it('turns the thank-you page OrderIdentity id into an Order id', () => {
    expect(toOrderGid('gid://shopify/OrderIdentity/123')).toBe('gid://shopify/Order/123');
    expect(toOrderGid('123')).toBe('gid://shopify/Order/123');
    expect(toOrderGid('nope')).toBeNull();
  });
});

describe('getOptInStatus', () => {
  const input = { orderId: 'gid://shopify/OrderIdentity/123', checkoutToken: 'chk_123' };

  it('is eligible for a recent order of this checkout with a phone number', async () => {
    const { admin, graphql } = adminReturning(order());
    expect(await getOptInStatus(admin, input, now)).toEqual({
      eligible: true,
      customerId: 'gid://shopify/Customer/42',
      state: 'NEVER_SUBSCRIBED',
    });
    expect(graphql.mock.calls[0][1].variables).toEqual({ id: 'gid://shopify/Order/123' });
  });

  it("refuses an order from another checkout, so nobody can opt in someone else", async () => {
    const { admin } = adminReturning(order({ checkoutToken: 'chk_other' }));
    expect(await getOptInStatus(admin, input, now)).toEqual({ eligible: false, reason: 'checkout_mismatch' });
  });

  it('refuses old orders and orders without a phone or customer', async () => {
    const old = new Date(now - OPT_IN_WINDOW_MS - 1000).toISOString();
    expect(await getOptInStatus(adminReturning(order({ createdAt: old })).admin, input, now)).toMatchObject({ reason: 'expired' });
    expect(
      await getOptInStatus(adminReturning(order({ customer: { id: 'c', defaultPhoneNumber: null } })).admin, input, now)
    ).toMatchObject({ reason: 'no_phone' });
    expect(await getOptInStatus(adminReturning(order({ customer: null })).admin, input, now)).toMatchObject({
      reason: 'no_customer',
    });
    expect(await getOptInStatus(adminReturning({ order: null }).admin, input, now)).toMatchObject({
      reason: 'order_not_found',
    });
  });
});

describe('subscribeToWhatsApp', () => {
  it('records a single opt-in in Shopify', async () => {
    const { admin, graphql } = adminReturning({ customerWhatsAppMarketingConsentUpdate: { userErrors: [] } });
    expect(await subscribeToWhatsApp(admin, 'gid://shopify/Customer/42', new Date(now))).toEqual({ ok: true });
    expect(graphql.mock.calls[0][1].variables.input).toEqual({
      customerId: 'gid://shopify/Customer/42',
      whatsAppMarketingConsent: { state: 'SUBSCRIBED', optInLevel: 'SINGLE_OPT_IN', updatedAt: '2026-10-23T12:00:00.000Z' },
    });
  });

  it('reports Shopify user errors', async () => {
    const { admin } = adminReturning({ customerWhatsAppMarketingConsentUpdate: { userErrors: [{ message: 'Invalid phone' }] } });
    expect(await subscribeToWhatsApp(admin, 'gid://shopify/Customer/42')).toEqual({ ok: false, errors: ['Invalid phone'] });
  });
});
