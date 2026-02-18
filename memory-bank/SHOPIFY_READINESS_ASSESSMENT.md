# Shopify Readiness Assessment

**Scope**: Recete Retention Agent (WhatsApp bot: documents, RAG, product recipes)  
**Date**: February 2026  
**Verdict**: **Ready for Shopify** — full stack present; install → map products → consent-aware webhooks → T+0 beauty consultant flow implemented. Remaining: Phase 5 (tests, docs, offline token note).

---

## Executive Summary

**Is this application ready to run in Shopify?**  
**Yes.** The app is a **WhatsApp bot** that helps customers with **documents, RAG (retrieval), and product recipes**. The codebase includes:

- **Backend**: `packages/api` — Shopify OAuth, webhooks, product instructions, consent, T+0 welcome, GraphQL products (429 retry), session verify, billing.
- **Workers**: `packages/workers` — T+0 job builds message from `product_instructions`, sends via WhatsApp.
- **Shared**: `packages/shared` — `getUsageInstructionsForProductIds`, queue types with `productIds`.
- **Frontend**: `packages/web` — Dashboard, **Shopify product → recipe mapping** (`/dashboard/products/shopify-map`), App Bridge verify-session, integrations.

With **env, DB migrations 000–007, and Shopify app config** in place, you can run and test on a dev store.

---

## What Was Verified (Code + Memory Bank)

### 1. Memory Bank & Roadmap

- **activeContext.md** — Phase: Shopify Perfect Match; Phases 1–4 done; Phase 5 (tests, docs, offline token) remaining.
- **roadmap-shopify-perfect-match.md** — Phases 1–4 checked off; Phase 5 tasks listed.
- **audit-shopify-perfect-match.md** — Aligned with current schema and flows.

### 2. Backend (API)

| Area | Status | Location / Notes |
|------|--------|------------------|
| Shopify OAuth | ✅ | `routes/shopify.ts`: oauth/start, oauth/callback, HMAC, token exchange, scopes (orders, fulfillments, products, customers) |
| Webhooks | ✅ | `routes/webhooks.ts`: POST /webhooks/commerce/shopify, HMAC, normalizeShopifyEvent → processNormalizedEvent |
| Session (App Bridge) | ✅ | `lib/shopifySession.ts`; POST /api/integrations/shopify/verify-session |
| Billing | ✅ | `lib/shopifyBilling.ts`; used in `routes/billing.ts` |
| Shopify products (GraphQL) | ✅ | `lib/shopify.ts`: fetchShopifyProducts with **429 retry** (Retry-After or 5s); GET /api/integrations/shopify/products |
| Product instructions | ✅ | Table 006; GET/PUT /api/products/:id/instruction, GET /api/products/instructions/list; Zod + auth |
| Consent (GDPR) | ✅ | `lib/events.ts`: email_marketing_consent / sms_marketing_consent → consent_status (opt_in/opt_out/pending) |
| orders/updated → delivered | ✅ | `lib/events.ts`: when fulfillment_status === 'fulfilled' or fulfillments success → event_type order_delivered |
| Consent gate | ✅ | `lib/orderProcessor.ts`: scheduleOrderMessages and T+0 job only when user.consent_status === 'opt_in' |
| T+0 job enqueue | ✅ | `lib/orderProcessor.ts`: productIds from event.items[].external_product_id; scheduleMessage({ type: 'welcome', productIds, ... }) |
| Migrations | ✅ | 000–007 (product_instructions, merchant_bot_info) |

### 3. Workers

| Area | Status | Location / Notes |
|------|--------|------------------|
| T+0 welcome | ✅ | `workers.ts`: type === 'welcome' && productIds → getUsageInstructionsForProductIds → build message from usage_instructions/recipe_summary → sendWhatsAppMessage |
| T+3 / T+14 | ✅ | scheduleOrderMessages unchanged; consent gate applies |

### 4. Shared

| Area | Status | Location / Notes |
|------|--------|------------------|
| getUsageInstructionsForProductIds | ✅ | `shared/productInstructions.ts`: lookup by external_id (Shopify product ID) → products then product_instructions |
| ScheduledMessageJobData.productIds | ✅ | `shared/queues.ts`: productIds?: string[] |

### 5. Frontend (Web)

| Area | Status | Location / Notes |
|------|--------|------------------|
| Dashboard | ✅ | DashboardLayout, Sidebar, Header, Toast |
| Auth | ✅ | Login, callback; authCheck, supabase |
| Integrations | ✅ | /dashboard/integrations, Shopify callback |
| **Shopify map** | ✅ | /dashboard/products/shopify-map — fetch Shopify products, create local product (external_id) if needed, PUT instruction, toasts |
| Settings / Bot info | ✅ | /dashboard/settings, /dashboard/settings/bot-info |
| App Bridge | ✅ | ShopifyProvider, lib/shopifyAppBridge → verify-session → API /api/integrations/shopify/verify-session |
| API client | ✅ | lib/api.ts (NEXT_PUBLIC_API_URL), authenticatedRequest |

### 6. RAG & AI

- **aiAgent.ts** — RAG context uses knowledge_chunks + product_instructions; customer Q&A can include recipe/usage context.

---

## Shopify “Perfect Match” Checklist (This Repo)

- **Install → OAuth**: Frontend redirects to API oauth/start; callback saves integration (shop, access_token, scope).
- **Map products to recipes**: Shopify map page fetches Shopify products, creates/links local product by external_id, saves usage_instructions via PUT /api/products/:id/instruction.
- **Webhooks + consent**: Backend normalizes events (consent from Shopify); gates T+3/T+14 and T+0 on opt_in; orders/updated → order_delivered when fulfilled.
- **T+0**: On delivered + consented, T+0 job is queued with productIds from event.items; worker loads instructions and sends WhatsApp beauty-consultant message.
- **Session token**: Frontend can call POST /api/integrations/shopify/verify-session for embedded app auth.

---

## Remaining (Phase 5 — Non-Blocking for Run)

| Item | Status | Notes |
|------|--------|-------|
| Offline token | ⬜ | Confirm OAuth requests offline access; document in techContext |
| Unit tests: consent + orders/updated | ⬜ | normalizeShopifyEvent, orderProcessor consent gate |
| Unit/integration: ProductInstruction | ⬜ | CRUD, getUsageInstructionsForProductIds |
| Integration: webhook → job enqueued | ⬜ | Mock webhook body, assert T+0 job |
| User/install docs | ⬜ | Recipe mapping & consent in merchant-setup or integrations doc |

---

## What You Need to Run in Shopify

1. **Environment**
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Supabase service role
   - `NEXT_PUBLIC_API_URL`, `API_URL`, `FRONTEND_URL` (production)
   - Redis, OpenAI, WhatsApp/Twilio as per existing setup

2. **Database**
   - Run migrations 000–007 (e.g. Supabase SQL or `supabase db push`).

3. **Shopify app**
   - Create app in Partner Dashboard; set redirect and webhook URLs to your API.
   - Scopes: read_orders, read_fulfillments, read_products, read_customers (and billing if used).
   - Webhooks: orders/create, orders/fulfilled, orders/updated → `API_URL/webhooks/commerce/shopify`.

4. **Run & test**
   - `pnpm dev` (API) and `pnpm --filter @glowguide/web dev` (Web; use `--webpack` if needed for pnpm).
   - Install on a dev store; test OAuth, product mapping (shopify-map), and webhooks (order fulfilled + consent).

---

## Verdict Summary

| Question | Answer |
|----------|--------|
| Is the **backend** ready for Shopify? | **Yes** |
| Is the **frontend** present? | **Yes** — packages/web with dashboard, Shopify map, App Bridge. |
| Are **documents, RAG, and recipes** supported? | **Yes** — RAG (knowledge_chunks + product_instructions), recipes via product_instructions and T+0 message. |
| Is this application ready to run in Shopify? | **Yes** — once env, migrations, and Shopify app config are set and tested on a dev store. |

*Assessment based on memory-bank docs and code read on February 2026.*
