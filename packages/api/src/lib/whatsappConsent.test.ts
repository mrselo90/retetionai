import { describe, expect, it } from 'vitest';
import { decideConsentUpdate, decisionForPhone, mapShopifyWhatsAppState } from './whatsappConsent.js';

describe('mapShopifyWhatsAppState', () => {
  it('maps Shopify consent states to the messaging gate', () => {
    expect(mapShopifyWhatsAppState('SUBSCRIBED')).toBe('opt_in');
    expect(mapShopifyWhatsAppState('UNSUBSCRIBED')).toBe('opt_out');
    expect(mapShopifyWhatsAppState('REDACTED')).toBe('opt_out');
    expect(mapShopifyWhatsAppState('NEVER_SUBSCRIBED')).toBe('pending');
    expect(mapShopifyWhatsAppState('PENDING')).toBe('pending');
    expect(mapShopifyWhatsAppState(null)).toBe('pending');
  });
});

describe('decideConsentUpdate', () => {
  const at = (iso: string) => iso;

  it('stores the first decision for a new customer', () => {
    expect(decideConsentUpdate(null, { status: 'pending', source: 'shopify', updatedAt: null })?.consent_status).toBe('pending');
  });

  it('keeps a STOP reply when an order brings an older Shopify opt-in', () => {
    const current = { consent_status: 'opt_out', consent_source: 'whatsapp_reply', consent_updated_at: at('2026-10-20T10:00:00Z') };
    expect(decideConsentUpdate(current, { status: 'opt_in', source: 'shopify', updatedAt: at('2026-09-01T00:00:00Z') })).toBeNull();
    expect(decideConsentUpdate(current, { status: 'opt_in', source: 'shopify', updatedAt: null })).toBeNull();
  });

  it('re-subscribes after a STOP only when the opt-in is newer', () => {
    const current = { consent_status: 'opt_out', consent_source: 'whatsapp_reply', consent_updated_at: at('2026-10-20T10:00:00Z') };
    const patch = decideConsentUpdate(current, { status: 'opt_in', source: 'thank_you_page', updatedAt: at('2026-10-21T09:00:00Z') });
    expect(patch).toMatchObject({ consent_status: 'opt_in', consent_source: 'thank_you_page' });
  });

  it('never lets unknown overwrite a known answer', () => {
    const optIn = { consent_status: 'opt_in', consent_source: 'shopify', consent_updated_at: at('2026-10-01T00:00:00Z') };
    expect(decideConsentUpdate(optIn, { status: 'pending', source: 'shopify', updatedAt: null })).toBeNull();
    const optOut = { consent_status: 'opt_out', consent_source: 'whatsapp_reply', consent_updated_at: at('2026-10-01T00:00:00Z') };
    expect(decideConsentUpdate(optOut, { status: 'pending', source: 'shopify', updatedAt: null })).toBeNull();
  });

  it('replaces legacy email/SMS-derived consent with the real WhatsApp answer', () => {
    const legacy = { consent_status: 'opt_in', consent_source: 'legacy', consent_updated_at: at('2026-08-01T00:00:00Z') };
    expect(decideConsentUpdate(legacy, { status: 'pending', source: 'shopify', updatedAt: null })?.consent_status).toBe('pending');
  });

  it('always applies an opt-out', () => {
    const optIn = { consent_status: 'opt_in', consent_source: 'thank_you_page', consent_updated_at: at('2026-10-22T00:00:00Z') };
    expect(decideConsentUpdate(optIn, { status: 'opt_out', source: 'shopify', updatedAt: at('2026-10-01T00:00:00Z') })?.consent_status).toBe('opt_out');
  });
});

describe('decisionForPhone', () => {
  it('uses Shopify consent only for the number we would message', () => {
    const consent = { phoneNumber: '+447700900123', state: 'SUBSCRIBED', updatedAt: '2026-10-22T00:00:00Z' };
    expect(decisionForPhone(consent, '+44 7700 900123').status).toBe('opt_in');
    expect(decisionForPhone(consent, '+447700900999').status).toBe('pending');
    expect(decisionForPhone(null, '+447700900123').status).toBe('pending');
  });
});
