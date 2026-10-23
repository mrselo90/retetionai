import { describe, expect, it } from 'vitest';
import { redactUrlForLog } from './logUrl.mjs';

describe('redactUrlForLog', () => {
  it('keeps URLs without a query unchanged', () => {
    expect(redactUrlForLog('/app/products')).toBe('/app/products');
  });

  it('redacts the embedded load credentials and keeps the rest', () => {
    expect(
      redactUrlForLog(
        '/app/products/1?embedded=1&hmac=abc123&host=YWRtaW4&id_token=eyJ.x.y&locale=en&session=f720&shop=a.myshopify.com&timestamp=179'
      )
    ).toBe(
      '/app/products/1?embedded=1&hmac=[redacted]&host=YWRtaW4&id_token=[redacted]&locale=en&session=[redacted]&shop=a.myshopify.com&timestamp=179'
    );
  });

  it('redacts OAuth and checkout secrets', () => {
    expect(redactUrlForLog('/auth/callback?code=c0de&state=s7&shop=a.myshopify.com')).toBe(
      '/auth/callback?code=[redacted]&state=[redacted]&shop=a.myshopify.com'
    );
    expect(redactUrlForLog('/public/whatsapp-optin?orderId=gid%3A%2F%2F1&checkoutToken=bb21')).toBe(
      '/public/whatsapp-optin?orderId=gid%3A%2F%2F1&checkoutToken=[redacted]'
    );
  });

  it('matches encoded parameter names and leaves malformed ones alone', () => {
    expect(redactUrlForLog('/x?id%5Ftoken=abc&a=%E0')).toBe('/x?id%5Ftoken=[redacted]&a=%E0');
    expect(redactUrlForLog('/x?%E0=1&hmac')).toBe('/x?%E0=1&hmac');
  });
});
