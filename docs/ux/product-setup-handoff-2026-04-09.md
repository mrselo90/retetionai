# Product Setup Handoff

Date: 2026-04-09

## Scope
- Codebase: Recete Shopify embedded app
- Main page: `/app/products`
- Main route file: [app.products._index.tsx](/Users/sboyuk/Desktop/retention-agent-ai/packages/shopify-app/app/routes/app.products._index.tsx)
- Related API files:
  - [config.ts](/Users/sboyuk/Desktop/retention-agent-ai/packages/api/src/lib/multiLangRag/config.ts)
  - [shopSettingsService.ts](/Users/sboyuk/Desktop/retention-agent-ai/packages/api/src/lib/multiLangRag/shopSettingsService.ts)
  - [chunkShadowWriteService.ts](/Users/sboyuk/Desktop/retention-agent-ai/packages/api/src/lib/multiLangRag/chunkShadowWriteService.ts)

## Current Product Decision
- The old 3-step model was too fragile:
  - `Customer info`
  - `AI answers`
  - `Languages`
- This was causing merchants to get stuck in `In progress` because multilingual coverage is asynchronous and dependent on downstream shadow-sync state.
- New model:
  - `Customer info`
  - `AI answers`
  - `Ready`
- Language coverage is no longer a blocking setup step.
- Language coverage is now a secondary capability panel shown after setup is ready.

## Why The Method Changed
- The previous setup completion depended on too many moving parts:
  - UI submit
  - shell action
  - API call
  - embeddings generation
  - multilingual shadow write
  - `product_i18n`
  - `knowledge_chunks_i18n`
  - loader reconciliation
- This made the UX non-deterministic.
- Product setup must be deterministic.
- Multilingual sync is asynchronous and should not block completion.

## Current UX State
- Product detail uses a focused workflow layout.
- Active setup flow is now 2-step only.
- `Languages` no longer appears as an active step.
- After `Ready`, the page can show:
  - language coverage panel
  - AI knowledge panel
  - missing info
  - preview answer
- The language coverage panel is informational/secondary.
- It can still expose a secondary refresh action, but it is no longer the main task.

## Important Production Findings
- Latest embeddings click was verified end-to-end:
  - shell action received `intent=embeddings`
  - `POST /api/products/:id/generate-embeddings` executed
  - response returned success
- The real failure was downstream multilingual readiness, not the button itself.
- For product `b24cb4e9-df8b-4f75-b156-bb268e4a2926` (`Gift Card`):
  - `knowledge_chunks` existed
  - `product_i18n` was initially empty
  - `knowledge_chunks_i18n` was initially empty
- Root causes found:
  - `shop_settings.multi_lang_rag_enabled` had false rows in production
  - multilingual chunk shadow write defaulted to off unless env explicitly enabled it
  - production schema did not have:
    - `products.multilang_specs_json`
    - `products.multilang_faq_json`
  - this caused shadow sync to skip

## Backend Fixes Already Applied
- `multi_lang_rag_enabled` is now forced to behave as true in API settings service.
- stale false `shop_settings` rows were updated to true in production
- chunk shadow write default is now enabled
- `chunkShadowWriteService` no longer selects the missing production columns
- one-off multilingual sync was run successfully for `Gift Card`

## Verified Production Data
- Product: `b24cb4e9-df8b-4f75-b156-bb268e4a2926`
- Merchant: `1ff9fc4b-ffaf-445b-a330-ba38bcfe83cc`
- `product_i18n` now contains:
  - `en`
  - `tr`
- `knowledge_chunks_i18n` now contains:
  - `en`: 3 chunks
  - `tr`: 3 chunks

## Current Deployment State
- Shopify shell changes deployed
- API multilingual fixes deployed
- production processes restarted successfully:
  - `shopify-shell`
  - `api`

## Important Caveat
- After the last deploy, `shopify-shell` is online, but there were recent log lines like:
  - `Connection to API failed for /api/merchants/me: fetch failed`
  - `Connection to API failed for merchant-overview: fetch failed`
- These were seen in a short post-restart log window.
- If the page looks broken in production, first inspect current `shopify-shell` to API connectivity.

## Recommended Next Steps
- Validate the live `/app/products` experience after the new 2-step deploy:
  - confirm `Languages` no longer blocks setup
  - confirm `Ready` appears after guidance + embeddings
  - confirm language coverage appears as secondary information
- If needed, tighten the ready-state panel copy and hierarchy.
- If desired, backfill multilingual shadow sync for all existing products, not just `Gift Card`.
- If production still misbehaves, inspect:
  - `pm2 logs shopify-shell`
  - `pm2 logs api`
  - especially around `/api/merchants/me`, `/api/integrations/shopify/merchant-overview`, and `/api/products/:id/generate-embeddings`

## Suggested Prompt For Another Tool
- “Continue from `docs/ux/product-setup-handoff-2026-04-09.md`. Inspect `/app/products` in the Recete Shopify embedded app. Treat setup as a 2-step deterministic flow (`Customer info`, `AI answers`) and keep language coverage secondary. Validate the current production behavior and refine the UX only if it preserves that model.”
