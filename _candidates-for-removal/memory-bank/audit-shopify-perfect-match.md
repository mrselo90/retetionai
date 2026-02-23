# Audit: Project vs Shopify Perfect Match Roadmap

> Verification that the roadmap was aligned with the actual codebase, database, and architecture.  
> **Date**: February 7, 2026

---

## What Was Checked

- **Database**: All migrations in `supabase/migrations/` (000–005), current schema (tables, columns, indexes).
- **API**: `packages/api/src/index.ts` (routes), `routes/shopify.ts`, `routes/webhooks.ts`, `lib/shopify.ts`, `lib/events.ts`, `lib/orderProcessor.ts`, `lib/messageScheduler.ts`, `queues.ts`.
- **Workers**: `packages/workers/src/workers.ts`, `packages/workers/src/queues.ts`.
- **Shared**: `packages/shared/src/queues.ts` (job types), `packages/shared/src/types.ts`, Supabase client.
- **Frontend**: `packages/web/` structure (Next.js, no Remix/Polaris; ShopifyProvider, shopifyAppBridge).

---

## Current Database Schema (Verified)

**Migrations**: `000_complete_setup.sql`, `001_initial_schema.sql`, `002_rls_policies.sql`, `003_api_key_rotation.sql`, `004_subscription_system.sql`, `005_performance_indexes.sql`.

| Table | Exists | Notes |
|-------|--------|--------|
| merchants | ✅ | name, api_keys, webhook_secret, persona_settings; 004 adds subscription_plan, subscription_status, billing_provider, etc. |
| integrations | ✅ | merchant_id, provider, status, auth_type, auth_data (JSONB: shop, access_token for Shopify) |
| products | ✅ | merchant_id, external_id, name, url, raw_text, vector_id — **no** usage_instructions / recipe column |
| users | ✅ | merchant_id, phone, name, **consent_status** ('pending','opt_in','opt_out') |
| orders | ✅ | merchant_id, user_id, external_order_id, status, delivery_date — **no** order_items / line items stored |
| knowledge_chunks | ✅ | product_id, chunk_text, embedding (vector 1536) |
| conversations | ✅ | user_id, order_id, history (JSONB), current_state |
| analytics_events | ✅ | merchant_id, event_type, value, sentiment_score |
| sync_jobs | ✅ | merchant_id, integration_id, job_type, status, meta |
| external_events | ✅ | merchant_id, integration_id, source, event_type, **payload** (JSONB), idempotency_key |
| scheduled_tasks | ✅ | user_id, order_id, task_type ('welcome','checkin_t3','checkin_t14','upsell'), execute_at, status |
| subscription_plans | ✅ | 004: id, name, price_monthly, features (JSONB), etc. |
| usage_tracking | ✅ | 004: merchant_id, period_start/end, messages_sent, api_calls, storage_bytes |
| **product_instructions** | ❌ | **Not present** — roadmap Phase 1 adds this |

**Important**: There is **no** `order_items` table. Line items exist only in the **normalized event payload** (`event.items[]` with `external_product_id`, `name`, `url`) when the webhook is processed. So for the T+0 job, **product IDs must be taken from `event.items` at webhook time** and passed in the job payload; they cannot be looked up later from the DB unless we add an order_items table (roadmap does not add it; we pass from event).

---

## Current API & Architecture (Verified)

| Area | Status | Details |
|------|--------|--------|
| Shopify OAuth | ✅ | `routes/shopify.ts`: oauth/start, oauth/callback, webhooks/subscribe, verify-session |
| Shopify webhooks | ✅ | `routes/webhooks.ts`: POST /webhooks/commerce/shopify, HMAC, normalizeShopifyEvent, processNormalizedEvent |
| Event normalization | ✅ | `lib/events.ts`: orders/fulfilled → order_delivered; **no** consent from Shopify; **orders/updated** → order_updated only (not mapped to delivered when fulfilled) |
| Order processor | ✅ | `lib/orderProcessor.ts`: upsert user (consent_status from event, default 'pending'), upsert order; on delivered calls **scheduleOrderMessages** — **no** consent check before scheduling |
| Message scheduler | ✅ | `lib/messageScheduler.ts`: scheduleOrderMessages only **T+3** and **T+14** — **no T+0** welcome on delivery |
| Queues | ✅ | scheduled-messages, scrape-jobs, analytics. **ScheduledMessageJobData**: type, userId, orderId?, merchantId, to, message?, scheduledFor — **no productIds** |
| Workers | ✅ | scheduledMessagesWorker uses generic templates; **no** loading of usage instructions or beauty-consultant prompt |
| Product CRUD | ✅ | `routes/products.ts`: list, create, get, update, delete, scrape, embeddings — **no** product_instructions API |
| Shopify GraphQL products | ❌ | **Not implemented** — no route that fetches Shopify Admin API products |
| Product mapping UI | ❌ | **Not implemented** — no page to map Shopify products to recipes |

---

## Alignment With Roadmap

- **Phase 1 (Data & Schema)**: Correct — `product_instructions` table and API do not exist; products have no recipe/usage_instructions column.
- **Phase 2 (Product Mapping UI)**: Correct — no GET Shopify products endpoint, no mapping page.
- **Phase 3 (Webhook & Consent)**: Correct — consent not read from Shopify; no gate before scheduleOrderMessages; orders/updated not treated as delivered when fulfilled.
- **Phase 4 (Orchestrator)**: Correct — no T+0 job; no worker that loads usage instructions or calls sendToWhatsAppAgent with product recipe. **Implementation note**: T+0 job must receive **productIds** (or full `items`) from **event** in `orderProcessor` (event.items[].external_product_id), since there is no order_items table.
- **Phase 5 (Security & Polish)**: Correct — offline token and 429 handling not explicitly verified in code; tests and docs for new behavior not present.

---

## Summary

The roadmap was cross-checked against the real project. The database has no `product_instructions` or `order_items`; the API has no product-instruction endpoints or Shopify GraphQL products; the webhook path does not enforce consent or map orders/updated→delivered; and there is no T+0 worker with usage instructions. One critical detail for implementation: **product IDs for the T+0 job must be taken from the normalized event (`event.items`) when processing the webhook and passed in the job payload**, because order line items are not stored in the DB.
