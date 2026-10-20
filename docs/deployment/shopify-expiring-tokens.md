# Shopify expiring offline tokens: rollout and migration

## What was wrong

The Shopify app has used expiring offline tokens since March 2026 (`expiringOfflineAccessTokens: true` in `packages/shopify-app/app/shopify.server.ts`). Each token lives 60 minutes and comes with a 90-day rotating refresh token, which the app keeps in `shopify."Session"`.

The app's install-sync sends only the access token to the API. The API stored it in `integrations.auth_data` with no expiry and no refresh token. Every stored token therefore stopped working about an hour after install, and nothing renewed it.

Affected callers were every API and worker call to the Admin API:
- product fallback fetches
- `/api/integrations/shopify/products`
- billing charges
- the scrape worker

Production check on 2026-10-20: all 11 API tokens were identical to the app's session tokens. All of them were expired; the newest expired on 2026-10-09.

## How it works now

Shopify keeps one token chain per app and store. If two places acquire or refresh a token for the same store, each retires the other's tokens. Each chain therefore has exactly one owner, recorded in `auth_data.token_owner`. The rules live in `packages/shared/src/shopifyToken.ts` (`getShopifyAccessToken`).

| Owner | Set by | Who refreshes |
| --- | --- | --- |
| `shell` (also rows with no owner, written before this change) | install-sync from the Shopify app | The Shopify app. The API and workers call `POST /internal/offline-token` on `SHOPIFY_SHELL_INTERNAL_URL`, which runs `unauthenticated.admin(shop)` (the library refreshes when the token is within 5 minutes of expiry). The answer is cached in `auth_data` until shortly before it expires. |
| `api` | dashboard OAuth callback, `/verify-session` (both now send `expiring=1`) | The API, with `grant_type=refresh_token` under a Redis lock per shop. The rotated pair is stored back in `auth_data`. |

If a shop can only recover by re-authorizing, `getShopifyAccessToken` throws `ShopifyReauthRequiredError`. That happens when the app's refresh token is expired or retired, or when an API-owned refresh token is expired. `/api/integrations/shopify/products` turns it into a 409 with `code: shopify_reauth_required`. Billing routes keep answering "reconnect your Shopify store".

`ecosystem.config.cjs` sets `SHOPIFY_SHELL_INTERNAL_URL=http://127.0.0.1:3003` for `api` and `workers`. It deliberately does not reuse `SHOPIFY_SHELL_URL`, because setting that also enables the API's shell plan and usage integration (`lib/shopifyShell.ts`).

## Migrating the 11 existing shops

There is no data migration. The rows stay as they are, and the first use of each shop goes through the Shopify app. What a shop needs depends on whether the refresh token in the app's session is still valid (as of 2026-10-20):

| Shop | Refresh token expires | What happens |
| --- | --- | --- |
| blackeagletest | 2027-01-07 | Renewed automatically on first use, or by step 2 below |
| fitjourneygoods | **2026-11-05** | Same, but must happen before 2026-11-05 |
| app-review-…-r99750-a0-victim, app-review-…-r99776-a1-victim | 2026-12-13 | Shopify App Review test stores. Renewed automatically |
| receteshop, james-varga, 0nhwb1-zc, g1150c-di, yczkzp-0e, peter-96737, rosekolander | already expired | Cannot be refreshed. Recover only when the merchant opens the app: `authenticate.admin` runs a new token exchange, then `afterAuth` runs install-sync with the new token and expiry |

### Steps after deploy

1. Deploy as usual. PM2 picks up `SHOPIFY_SHELL_INTERNAL_URL` through `pm2 startOrRestart ecosystem.config.cjs --update-env`.
2. On the server, from `/root/retetionai`, report first, then renew:
   ```bash
   node --env-file=packages/api/.env scripts/check-shopify-tokens.mjs
   node --env-file=packages/api/.env scripts/check-shopify-tokens.mjs --refresh
   ```
   `--refresh` renews each active shop through the Shopify app and confirms the token with a `{ shop { name } }` query. Expect `ok` for the four shops with a valid refresh token and `reauth_required` for the other seven. It never prints tokens.
3. Open the app once in `receteshop` (our own store) and check that the next `--refresh` run shows `ok`.
4. For the other six `reauth_required` shops, decide per shop: ask the merchant to open the app, or mark the integration inactive if the store is a test store or no longer uses the app.

## Still to do

- **Keep-alive.** A refresh token that is not used for 90 days expires, which is how seven shops got stuck. A weekly worker job that calls `getShopifyAccessToken` for every active Shopify integration would keep the chains alive. `scripts/check-shopify-tokens.mjs --refresh` does the same by hand.
- **Encryption at rest.** API-owned refresh tokens are stored in `auth_data` in plain text, as access tokens already are. Shopify recommends encrypting them.
- **Deadline.** Public apps must use expiring offline tokens for GraphQL Admin API calls from 2027-01-01. Shell-owned shops already do. API-owned shops do from this change on.
