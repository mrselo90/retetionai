# Roadmap: Shopify Perfect Match

> Full checklist to align Recete with the native Shopify App flow: product → recipe mapping, consent-aware webhooks, T+0 beauty consultant, and best practices.

**Created**: February 7, 2026  
**Status**: 🚀 In progress — Phase 1–4 implemented; Phase 5 partial  
**Goal**: Perfect match with Shopify: install → map products to recipes → on delivery (with consent) → WhatsApp AI consultant  

**Audit**: Roadmap was checked against the live project (database, API, workers, events). See `memory-bank/audit-shopify-perfect-match.md` for what exists vs what this roadmap adds.

---

## Overview

| Phase | Focus | Tasks | Est. |
|-------|--------|-------|------|
| **1** | Data & schema | ProductInstruction model, API, migrations | 1–2 days |
| **2** | Product mapping UI | Shopify GraphQL products, admin UI to map recipes | 2–3 days |
| **3** | Webhook & consent | Consent from Shopify, gate queue, orders/updated → delivered | 1–2 days |
| **4** | Orchestrator | T+0 job, worker, usage instructions + AI/WhatsApp | 2–3 days |
| **5** | Security & polish | Offline token, rate limits, tests, docs | 1–2 days |

**Total (estimate)**: ~8–12 days of focused work.

---

## Phase 1: Data & Schema — ProductInstruction

**Goal**: Store “Cosmetic Recipe & Usage Instructions” per Shopify product (or per local product linked to Shopify).

### 1.1 Database schema

- [ ] **SHOP-PM-1.1.1** — Add `product_instructions` table (or equivalent)
  - Columns: `id`, `merchant_id`, `product_id` (FK to `products`), `shopify_product_id` (optional, for direct Shopify ID), `usage_instructions` (TEXT), `recipe_summary` (optional), `created_at`, `updated_at`
  - Unique: `(merchant_id, product_id)` or `(merchant_id, shopify_product_id)` if keying by Shopify ID
  - Indexes: `merchant_id`, `product_id`, `shopify_product_id`
- [ ] **SHOP-PM-1.1.2** — Create migration in `supabase/migrations/` (e.g. `006_product_instructions.sql`)
- [ ] **SHOP-PM-1.1.3** — Document schema in `memory-bank/systemPatterns.md` (and techContext if needed)

### 1.2 API for ProductInstruction

- [ ] **SHOP-PM-1.2.1** — `GET /api/merchants/me/products/:productId/instruction` — get instruction for a product
- [ ] **SHOP-PM-1.2.2** — `PUT /api/merchants/me/products/:productId/instruction` — create or update instruction (body: `usage_instructions`, optional `recipe_summary`)
- [ ] **SHOP-PM-1.2.3** — `GET /api/merchants/me/product-instructions` — list by merchant (optional, for UI)
- [ ] **SHOP-PM-1.2.4** — Add Zod schema for request body; use auth middleware (merchant_id from session/API key)
- [ ] **SHOP-PM-1.2.5** — Internal helper: `getUsageInstructionsForProductIds(merchantId, productIds)` for worker

---

## Phase 2: Product Mapping UI (Admin Dashboard)

**Goal**: Merchant can see Shopify products and set/edit “Cosmetic Recipe & Usage Instructions” per product; save to `product_instructions`.

### 2.1 Backend: Shopify Admin API (GraphQL)

- [ ] **SHOP-PM-2.1.1** — Add GraphQL helper (or extend `shopify.ts`) to fetch products: `products(first: N, query: "...")` with fields: `id`, `title`, `handle`, `status`
  - Use integration’s `access_token` + shop from `auth_data`; support pagination if needed
- [ ] **SHOP-PM-2.1.2** — Route: `GET /api/integrations/shopify/products` — returns Shopify products for the merchant’s active Shopify integration (calls GraphQL)
  - Require auth; resolve merchant → Shopify integration → shop + token
  - Handle rate limits (429) with retry/backoff
- [ ] **SHOP-PM-2.1.3** — Optional: sync or map Shopify product ID to local `products` (e.g. by `external_id`) so `product_instructions` can reference existing `products.id` or store `shopify_product_id` only

### 2.2 Frontend: Product mapping page

- [ ] **SHOP-PM-2.2.1** — New page (e.g. `/dashboard/products/shopify-map` or under Integrations) for “Shopify product → recipe mapping”
- [ ] **SHOP-PM-2.2.2** — Fetch Shopify products via `GET /api/integrations/shopify/products`; show list (table or card list)
- [ ] **SHOP-PM-2.2.3** — For each product: show name, handle; allow input/edit of “Cosmetic Recipe & Usage Instructions” (textarea or rich text)
- [ ] **SHOP-PM-2.2.4** — Save via `PUT /api/merchants/me/products/:productId/instruction` (or by `shopify_product_id` if API supports it)
  - If using local `products`: ensure product exists (create from Shopify product or link by `external_id`) then save instruction
- [ ] **SHOP-PM-2.2.5** — Loading states, error handling, success toasts; optional: Polaris-like components if desired (current stack is Next.js + Tailwind — keep consistent)

### 2.3 Optional enhancements

- [ ] **SHOP-PM-2.3.1** — Bulk load instructions for multiple products in one view
- [ ] **SHOP-PM-2.3.2** — Search/filter Shopify products by name

---

## Phase 3: Webhook & Consent (Trigger)

**Goal**: On “order delivered”, only queue messages when customer has marketing consent; treat `orders/updated` as delivered when fulfilled.

### 3.1 Consent from Shopify

- [ ] **SHOP-PM-3.1.1** — In `normalizeShopifyEvent` (`events.ts`): read Shopify customer consent
  - Map from order payload: e.g. `order.customer?.email_marketing_consent?.state`, `order.sms_marketing_consent`, or equivalent (Shopify API version–specific)
  - Set `consent_status` on normalized event (e.g. `opt_in` / `opt_out` / `pending`)
- [ ] **SHOP-PM-3.1.2** — When creating/updating user in `orderProcessor`, set `users.consent_status` from `event.consent_status` (with safe default e.g. `pending` if missing)
- [ ] **SHOP-PM-3.1.3** — Document which Shopify fields are used in `memory-bank/systemPatterns.md` or `docs/`

### 3.2 Gate queue on consent

- [ ] **SHOP-PM-3.2.1** — Before calling `scheduleOrderMessages` in `orderProcessor`: load user’s `consent_status` (or use event’s consent)
  - If not `opt_in` (or equivalent), do **not** call `scheduleOrderMessages`; optionally log “skipped – no consent”
- [ ] **SHOP-PM-3.2.2** — Apply same check before adding T+0 “delivery” job (Phase 4): only enqueue when consented

### 3.3 orders/updated → delivered

- [ ] **SHOP-PM-3.3.1** — In `normalizeShopifyEvent`, for topic `orders/updated`:
  - If payload indicates fulfilled/delivered (e.g. `fulfillment_status === 'fulfilled'` or fulfillments present and success), set `event_type: 'order_delivered'` and set `delivered_at` from fulfillments
- [ ] **SHOP-PM-3.3.2** — Ensure `orderProcessor` and downstream logic treat this the same as `orders/fulfilled` (already does when `event_type === 'order_delivered'`)

### 3.4 Webhook subscription (optional)

- [ ] **SHOP-PM-3.4.1** — If not already subscribed: add `fulfillments/update` or rely on `orders/updated`; confirm in `routes/shopify.ts` webhook list

---

## Phase 4: Orchestrator (T+0 + AI/WhatsApp)

**Goal**: On delivered + consented, enqueue T+0 job; worker loads usage instructions, builds beauty-consultant prompt, calls AI/WhatsApp.

### 4.1 T+0 job and queue

- [ ] **SHOP-PM-4.1.1** — Define job payload: `{ merchantId, orderId, customerPhone, productIds }` (and optionally shopId if needed)
- [ ] **SHOP-PM-4.1.2** — Add queue (or reuse existing): e.g. `delivery-messages` or `t0-welcome`; add to `queues.ts` and shared types
- [ ] **SHOP-PM-4.1.3** — In `orderProcessor`, after consent check and when status is delivered: push T+0 job with order’s user phone and line-item product IDs
  - **Important**: There is no `order_items` table; line items exist only in the normalized event. Pass product IDs from **event.items[].external_product_id** (Shopify product ID) into the job payload at webhook time. Worker will resolve to local product/instructions via `product_instructions` keyed by merchant + external_id (or shopify_product_id).

### 4.2 Worker: load instructions and build prompt

- [ ] **SHOP-PM-4.2.1** — Worker that processes T+0 job:
  - Load usage instructions from DB for given product IDs (use `getUsageInstructionsForProductIds` or equivalent; support both local product_id and shopify_product_id)
  - Build system prompt: e.g. “You are a beauty consultant. The user bought [Product Name]. Here is the usage recipe: [Insert Recipe]. Ask them if they know how to apply it.”
  - Support multiple products (e.g. concatenate recipes or list products)
- [ ] **SHOP-PM-4.2.2** — Call `sendToWhatsAppAgent(phone, systemPrompt)` — implement as wrapper around existing WhatsApp + AI agent (or mock that returns success)
- [ ] **SHOP-PM-4.2.3** — On failure: retry (BullMQ), log, optional dead-letter; do not block order processing

### 4.3 Optional: T+0 in scheduled_tasks

- [ ] **SHOP-PM-4.3.1** — Optionally create a `scheduled_tasks` row for T+0 (execute_at = now or delivery time) for audit/UI; or keep queue-only

### 4.4 Keep T+3 / T+14

- [ ] **SHOP-PM-4.4.1** — Ensure `scheduleOrderMessages` still runs for T+3 and T+14 (already does); consent gate applies to all (done in Phase 3)

---

## Phase 5: Security & Best Practices

**Goal**: Offline token for background work, Shopify API rate limits, tests, and docs.

### 5.1 Offline access token

- [ ] **SHOP-PM-5.1.1** — Confirm OAuth flow requests offline access (Shopify often returns offline by default for custom apps)
- [ ] **SHOP-PM-5.1.2** — Document in `memory-bank/techContext.md` or `docs/`: “Background jobs use integration’s access_token (offline)”

### 5.2 Shopify API rate limits

- [ ] **SHOP-PM-5.2.1** — For any Shopify Admin API calls (REST or GraphQL): on 429 response, retry with backoff (e.g. exponential)
- [ ] **SHOP-PM-5.2.2** — Centralize Shopify request helper (e.g. in `shopify.ts`) so all callers get rate-limit handling

### 5.3 Tests

- [ ] **SHOP-PM-5.3.1** — Unit: `normalizeShopifyEvent` with consent fields and `orders/updated` → delivered
- [ ] **SHOP-PM-5.3.2** — Unit: `orderProcessor` skips scheduling when consent is opt_out
- [ ] **SHOP-PM-5.3.3** — Unit or integration: ProductInstruction CRUD and `getUsageInstructionsForProductIds`
- [ ] **SHOP-PM-5.3.4** — Integration: webhook handler with mock body (delivered + consent) and assert job enqueued

### 5.4 Documentation

- [ ] **SHOP-PM-5.4.1** — Update `memory-bank/systemPatterns.md`: ProductInstruction table, consent flow, T+0 job payload
- [ ] **SHOP-PM-5.4.2** — Update `memory-bank/techContext.md` if new env vars or APIs
- [ ] **SHOP-PM-5.4.3** — Short “Shopify Perfect Match” section in `docs/installation/merchant-setup.md` or `docs/user-guide/integrations.md`: map products to recipes, consent behavior

---

## Full Task List (Checklist)

Use this as the single list to tick off as you develop.

### Phase 1: Data & Schema
- [x] SHOP-PM-1.1.1 — Add `product_instructions` table
- [x] SHOP-PM-1.1.2 — Migration file (006_product_instructions.sql)
- [x] SHOP-PM-1.1.3 — Document schema (systemPatterns.md)
- [x] SHOP-PM-1.2.1 — GET instruction API
- [x] SHOP-PM-1.2.2 — PUT instruction API
- [x] SHOP-PM-1.2.3 — List instructions API (GET /api/products/instructions/list)
- [x] SHOP-PM-1.2.4 — Zod + auth
- [x] SHOP-PM-1.2.5 — Helper getUsageInstructionsForProductIds (shared/productInstructions.ts)

### Phase 2: Product Mapping UI
- [x] SHOP-PM-2.1.1 — GraphQL products helper (fetchShopifyProducts, 429 retry)
- [x] SHOP-PM-2.1.2 — GET /api/integrations/shopify/products
- [x] SHOP-PM-2.1.3 — Optional: map Shopify product to local product (UI creates product with external_id)
- [x] SHOP-PM-2.2.1 — New mapping page (/dashboard/products/shopify-map)
- [x] SHOP-PM-2.2.2 — Fetch & show Shopify products
- [x] SHOP-PM-2.2.3 — Input/edit recipe per product
- [x] SHOP-PM-2.2.4 — Save instruction (PUT /api/products/:id/instruction)
- [x] SHOP-PM-2.2.5 — Loading, errors, toasts
- [ ] SHOP-PM-2.3.1 — (Optional) Bulk load
- [ ] SHOP-PM-2.3.2 — (Optional) Search/filter

### Phase 3: Webhook & Consent
- [x] SHOP-PM-3.1.1 — Extract consent in normalizeShopifyEvent (email/sms_marketing_consent.state)
- [x] SHOP-PM-3.1.2 — Set user consent_status from event (create + update existing user)
- [x] SHOP-PM-3.1.3 — Document Shopify consent fields (systemPatterns.md)
- [x] SHOP-PM-3.2.1 — Gate scheduleOrderMessages on consent (opt_in only)
- [x] SHOP-PM-3.2.2 — Gate T+0 job on consent (same block)
- [x] SHOP-PM-3.3.1 — orders/updated → order_delivered when fulfilled
- [x] SHOP-PM-3.3.2 — Same processing as orders/fulfilled
- [ ] SHOP-PM-3.4.1 — (Optional) fulfillments/update subscription

### Phase 4: Orchestrator
- [x] SHOP-PM-4.1.1 — Define T+0 job payload (productIds on ScheduledMessageJobData)
- [x] SHOP-PM-4.1.2 — Add queue + types (reuse scheduled-messages, productIds optional)
- [x] SHOP-PM-4.1.3 — Push T+0 job from orderProcessor (event.items → productIds)
- [x] SHOP-PM-4.2.1 — Worker: load instructions, build prompt (getUsageInstructionsForProductIds)
- [x] SHOP-PM-4.2.2 — sendToWhatsAppAgent (send via sendWhatsAppMessage with built message)
- [x] SHOP-PM-4.2.3 — Retry and error handling (BullMQ default)
- [ ] SHOP-PM-4.3.1 — (Optional) scheduled_tasks for T+0
- [x] SHOP-PM-4.4.1 — Keep T+3/T+14 with consent gate

### Phase 5: Security & Polish
- [ ] SHOP-PM-5.1.1 — Confirm offline token
- [ ] SHOP-PM-5.1.2 — Document offline usage
- [x] SHOP-PM-5.2.1 — 429 retry with backoff (fetchShopifyProducts)
- [x] SHOP-PM-5.2.2 — Central Shopify request helper (shopify.ts GraphQL)
- [ ] SHOP-PM-5.3.1 — Test consent + orders/updated
- [ ] SHOP-PM-5.3.2 — Test consent gate in orderProcessor
- [ ] SHOP-PM-5.3.3 — Test ProductInstruction APIs/helper
- [ ] SHOP-PM-5.3.4 — Test webhook → job enqueue
- [x] SHOP-PM-5.4.1 — Update systemPatterns
- [ ] SHOP-PM-5.4.2 — Update techContext if needed
- [ ] SHOP-PM-5.4.3 — User/install docs for recipe mapping & consent

---

## Dependencies

- **Phase 2** depends on **Phase 1** (schema + API).
- **Phase 3** can be done in parallel with Phase 1/2 (events + orderProcessor).
- **Phase 4** depends on **Phase 1** (instructions in DB) and **Phase 3** (consent gate + delivered).
- **Phase 5** can be done alongside or after 1–4.

**Suggested order**: 1 → 3 (consent + delivered) → 4 → 2 (UI) → 5.

---

## Memory Bank Cross-References

- **activeContext.md** — Current phase set to “Shopify Perfect Match roadmap ready; start Phase 1”.
- **progress.md** — New section “Shopify Perfect Match” with link to this roadmap.
- **systemPatterns.md** — To be updated with ProductInstruction, consent flow, T+0 payload (Phase 1 & 5).
- **techContext.md** — To be updated with offline token, rate limits (Phase 5).

---

*Last updated: February 7, 2026 — Phases 1–4 complete; Phase 5 (tests, docs, offline token) remaining.*
