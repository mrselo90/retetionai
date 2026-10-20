#!/usr/bin/env node
/**
 * Report, and optionally renew, every Shopify integration's offline token.
 *
 * Why: install-sync used to hand the API an expiring offline token without its
 * refresh token, so every stored token died an hour after install and nothing
 * renewed it. After the shared/shopifyToken.ts change, the first API or worker
 * use of a shop asks the Shopify app for a fresh token. This script does that
 * for all shops at once, so the ones whose refresh token is still valid are
 * renewed now rather than on first use, and the ones that can only recover by
 * the merchant opening the app are listed.
 *
 * Never prints tokens. Run from the repo root on the server, with the API env:
 *
 *   node scripts/check-shopify-tokens.mjs            # report only, no network calls
 *   node scripts/check-shopify-tokens.mjs --refresh  # renew via the Shopify app, then
 *                                                    # confirm each token with a { shop { name } } query
 */

import { getShopifyAccessToken, getSupabaseServiceClient } from '../packages/shared/dist/index.js';

const REFRESH = process.argv.includes('--refresh');
const API_VERSION = '2026-01';

function describe(auth) {
  const expires = auth?.expires_at ? new Date(auth.expires_at) : null;
  return {
    owner: auth?.token_owner || 'legacy (shell)',
    expires: expires ? expires.toISOString() : 'unknown',
    expired: expires ? expires.getTime() <= Date.now() : 'unknown',
    apiRefreshToken: Boolean(auth?.refresh_token),
  };
}

async function confirm(shop, accessToken) {
  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query: '{ shop { name } }' }),
    signal: AbortSignal.timeout(15_000),
  });
  return response.ok ? 'ok' : `http ${response.status}`;
}

const { data: rows, error } = await getSupabaseServiceClient()
  .from('integrations')
  .select('id, status, auth_data')
  .eq('provider', 'shopify')
  .order('created_at', { ascending: true });

if (error) {
  console.error('Could not read integrations:', error.message);
  process.exit(1);
}

const results = [];
for (const row of rows) {
  const shop = row.auth_data?.shop || '(no shop)';
  const entry = { shop, status: row.status, ...describe(row.auth_data) };

  if (REFRESH && row.status === 'active') {
    try {
      const { accessToken } = await getShopifyAccessToken(row);
      entry.result = await confirm(shop, accessToken);
    } catch (err) {
      entry.result = err?.name === 'ShopifyReauthRequiredError' ? 'reauth_required' : `error: ${err?.message}`;
    }
  }
  results.push(entry);
}

console.table(results);
if (REFRESH) {
  const needsReauth = results.filter((r) => r.result === 'reauth_required').map((r) => r.shop);
  console.log(`\n${results.filter((r) => r.result === 'ok').length} ok, ${needsReauth.length} need the merchant to open the app:`);
  for (const shop of needsReauth) console.log(`  - ${shop}`);
}
process.exit(0);
