import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SHOPIFY_API_VERSION } from './shopifyApiVersion';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Shopify API version', () => {
  it('shopify.app.toml webhooks use the same version as the app', () => {
    const toml = read('../../shopify.app.toml');
    const match = toml.match(/\[webhooks\][^[]*?api_version\s*=\s*"([^"]+)"/);
    expect(match?.[1]).toBe(SHOPIFY_API_VERSION);
  });

  it('the API and workers (@recete/shared) use the same version', () => {
    const shared = read('../../../shared/src/shopify.ts');
    const match = shared.match(/SHOPIFY_ADMIN_API_VERSION = '([^']+)'/);
    expect(match?.[1]).toBe(SHOPIFY_API_VERSION);
  });
});
