# Full Application List — Recete Retention Agent

Single reference inventory of the entire application. Generated from source read.

---

## 1. Product overview

- **Name:** recete-retention-agent
- **Version:** 0.1.0
- **Description:** White-label SaaS platform for post-purchase AI assistance via WhatsApp
- **Repo layout:** pnpm monorepo; packages: api, web, workers, shared
- **Node:** >=18.0.0 | **pnpm:** >=8.0.0

---

## 2. Packages

| Package | Path | Description |
|--------|------|-------------|
| **api** | `packages/api` | Hono REST API: auth, merchants, products, integrations, Shopify, billing, webhooks, RAG, WhatsApp, messages, conversations, analytics, GDPR, customers, members, admin, events |
| **web** | `packages/web` | Next.js app: dashboard, auth, admin, landing, i18n (en/tr), Shopify embedded support |
| **workers** | `packages/workers` | BullMQ workers: scheduled messages, scrape jobs, analytics, intelligence (RFM, churn, recommendations, abandoned cart, feedback), API key expiration |
| **shared** | `packages/shared` | Shared code: Supabase client, Redis, queue types, auth helpers, product instructions, logger, test setup |

---

## 3. API surface

**Entry:** `packages/api/src/index.ts`  
**Server:** Hono on Node (e.g. port 3001/3002). Middleware: logger, HTTPS (prod), security headers, CORS, rate limit, cache, metrics.

### Route groups (mount points)

| Mount path | Route module | Responsibility |
|------------|--------------|----------------|
| `/api/auth` | auth.ts | Signup, login, /me, API keys CRUD, rotate, revoke |
| `/api/merchants` | merchants.ts | Merchant profile, dashboard stats, API keys (me), bot info |
| `/api/integrations/shopify` | shopify.ts | OAuth auth/callback, products, verify-session, webhooks/subscribe |
| `/api/integrations` | integrations.ts | Integrations CRUD (list, get, create, update, delete) |
| `/api/integrations` | csv.ts | CSV import (by integrationId), template |
| `/api/products` | products.ts | Products CRUD, scrape, scrape-async, scrape-batch, instructions, enrich, generate-embeddings, generate-embeddings-batch |
| `/api/rag` | rag.ts | RAG query, product context for AI |
| `/api/whatsapp` | whatsapp.ts | Send message, test |
| `/api/messages` | messages.ts | Message scheduling (list, create, cancel) |
| `/api/conversations` | conversations.ts | Conversations list/detail, reply, status |
| `/api/analytics` | analytics.ts | Dashboard analytics, ROI |
| `/api/test` | test.ts | Test/debug endpoints (RAG, auth, users, etc.) |
| `/api/gdpr` | gdpr.ts | Data export, delete (user/merchant) |
| `/api/customers` | customers.ts | Customer 360 list/detail, search, segments |
| `/api/merchants/me/members` | members.ts | Team members CRUD, invite |
| `/api/admin` | admin.ts | Super-admin: merchants list, system |
| `/api/events` | events.ts | Event ingestion (e.g. order events) |
| `/webhooks` | webhooks.ts | Shopify commerce webhook, generic event webhook, WhatsApp (if at root) |
| `/api/billing` | billing.ts | Subscription, usage, plans, subscribe/cancel, add-ons, Shopify billing webhook (module imported in index; ensure mounted if used) |

**Other API endpoints (no auth group):**

- `GET /api/docs` — Swagger UI
- `GET /api/docs/openapi.json` — OpenAPI JSON
- `GET /api/config/platform-contact` — Platform WhatsApp number (public)
- `GET /health` — Health check

### API libraries (`packages/api/src/lib/`)

| Module | Purpose |
|--------|---------|
| aiAgent.ts | AI response generation, RAG, guardrails, return prevention |
| rag.ts | RAG search (embeddings, knowledge chunks) |
| embeddings.ts | OpenAI embeddings (single + batch), chunk text |
| knowledgeBase.ts | processProductForRAG, batchProcessProducts, getProductChunkCount |
| llm/enrichProduct.ts | LLM enrichment of raw product text for RAG |
| openaiClient.ts | OpenAI client init |
| scraper.ts | Product page scraping |
| guardrails.ts | System/custom guardrails, crisis/medical |
| notifications.ts | Escalation notifications (WhatsApp) |
| conversation.ts | Conversation helpers |
| messageScheduler.ts | Schedule/cancel messages, queue to BullMQ |
| orderProcessor.ts | Order event normalization, queue jobs |
| events.ts | Shopify event normalization, order mapping |
| whatsapp.ts | WhatsApp API (send, etc.) |
| shopify.ts | Shopify OAuth, HMAC, token exchange, GraphQL products |
| shopifySession.ts | Verify Shopify session token (embedded app) |
| shopifyBilling.ts | Recurring charges, webhooks |
| billing.ts | Subscription, plan limits, add-ons |
| addons.ts | Add-on definitions (e.g. return prevention), activate/deactivate |
| planLimits.ts | Storage/usage limits, enforceStorageLimit |
| usageTracking.ts | Usage tracking for billing |
| cache.ts | Product cache (get/set/invalidate) |
| botInfo.ts | Merchant bot info (key-value) |
| apiKeyManager.ts | API key create, hash, rotate, expire |
| apiKeyExpirationScheduler.ts | Schedule API key expiration job |
| dataExport.ts | GDPR data export |
| dataDeletion.ts | GDPR data deletion |
| encryption.ts | Encryption helpers |
| csvParser.ts | CSV parsing for import |
| sentry.ts | Sentry init, capture, context |
| metrics.ts | Metrics (Prometheus-style) |
| upsell.ts | Upsell logic |

(Test files under lib: *.test.ts — same names as above.)

### API middleware (`packages/api/src/middleware/`)

| File | Purpose |
|------|---------|
| auth.ts | JWT (Supabase), API key, Shopify session token; internal paths (enrich, generate-embeddings) allowed without auth |
| adminAuth.ts | Super-admin auth |
| validation.ts | Body/query/params validation (Zod) |
| rateLimit.ts | Redis-based rate limiting |
| securityHeaders.ts | CSP, HSTS, X-Frame-Options, etc. |
| logger.ts | Request logging |
| https.ts | HTTPS redirect (prod) |
| cacheMiddleware.ts | Cache middleware |
| metricsMiddleware.ts | Metrics middleware |

### API schemas (`packages/api/src/schemas/`)

- auth.ts — signup, login, API key create/revoke
- products.ts — create, update, productId, product instruction
- integrations.ts — integration provider/auth types

### API types (`packages/api/src/types/`)

- hono.d.ts — ContextVariableMap (merchantId, authMethod, internalCall, validatedBody/Query/Params, logger)

---

## 4. Web app

**Framework:** Next.js (App Router), locale: `[locale]` (e.g. en, tr).

### Pages (`packages/web/app/[locale]/`)

| Path | Purpose |
|------|---------|
| page.tsx | Landing page |
| login/page.tsx | Login |
| signup/page.tsx | Signup |
| auth/callback/page.tsx | OAuth / magic link callback |
| forgot-password/page.tsx | Forgot password |
| reset-password/page.tsx | Reset password |
| dashboard/page.tsx | Dashboard home |
| dashboard/layout.tsx | Dashboard layout |
| dashboard/analytics/page.tsx | Analytics (ROI, charts) |
| dashboard/conversations/page.tsx | Conversations list |
| dashboard/conversations/[id]/page.tsx | Conversation detail |
| dashboard/customers/page.tsx | Customers list |
| dashboard/customers/[id]/page.tsx | Customer 360 detail |
| dashboard/integrations/page.tsx | Integrations (WhatsApp, Shopify, CSV, Manual) |
| dashboard/integrations/shopify/callback/page.tsx | Shopify OAuth callback UI |
| dashboard/products/page.tsx | Products list |
| dashboard/products/[id]/page.tsx | Product detail (raw text, embeddings) |
| dashboard/products/shopify-map/page.tsx | Shopify product mapping (recipe/instructions) |
| dashboard/settings/page.tsx | Settings (bot, guardrails, API keys, GDPR) |
| dashboard/settings/bot-info/page.tsx | Bot persona / bot info |
| dashboard/test/page.tsx | Test page |
| admin/page.tsx | Admin home |
| admin/layout.tsx | Admin layout |
| admin/merchants/page.tsx | Admin: merchants list |
| admin/system/page.tsx | Admin: system |
| privacy-policy/page.tsx | Privacy policy |
| terms-of-service/page.tsx | Terms of service |
| cookie-policy/page.tsx | Cookie policy |

### Components (`packages/web/components/`)

| Category | Files |
|----------|--------|
| layout | DashboardLayout.tsx, Sidebar.tsx, Header.tsx, AdminLayout.tsx |
| ui | button, card, input, badge, dialog, avatar, Toast, spinner, empty-state, icon-wrapper, keyboard-shortcuts, PlanGatedFeature, InlineError, ShopifySaveBar |
| landing-page | Hero, Features, HowItWorks, Stats, CTA, Footer |
| other | ShopifyProvider.tsx, BackendHealthBanner.tsx |

### Lib (`packages/web/lib/`)

- api.ts — getApiUrl, getApiBaseUrl, authenticatedRequest, error handling
- supabase.ts — Supabase client
- authCheck.ts — Auth guard
- toast.ts — Toast notifications
- sentry.ts — Sentry (client)
- shopifyEmbedded.ts — isShopifyEmbedded, getShopifySessionToken, getShopifyShop
- shopifyAppBridge.ts — App Bridge / session
- utils.ts — Utilities

### i18n

- **Config:** `packages/web/i18n/request.ts`, `routing.ts`
- **Messages:** `packages/web/messages/en.json`, `packages/web/messages/tr.json` (namespaced keys for all UI)

### E2E (`packages/web/e2e/`)

- setup.ts
- auth.spec.ts
- dashboard.spec.ts
- products.spec.ts
- integrations.spec.ts
- conversations.spec.ts
- settings.spec.ts

---

## 5. Workers and queues

**Queue connection:** Redis (BullMQ). Queue and worker definitions: `packages/workers/src/queues.ts`, `workers.ts`, `intelligenceWorkers.ts`, `apiKeyExpirationWorker.ts`.

### Queues (QUEUE_NAMES in shared)

| Queue name | Purpose |
|------------|---------|
| scheduled-messages | T+0 welcome, T+3/T+14/T+25 check-in, upsell |
| scrape-jobs | Product URL scrape → enrich → save → generate-embeddings |
| analytics | Analytics event processing |
| rfm-analysis | RFM scoring (daily cron) |
| churn-prediction | Churn prediction (weekly cron) |
| product-recommendations | Product recommendations (weekly cron) |
| abandoned-cart | Abandoned cart reminders |
| feedback-request | Review/NPS feedback requests |

### Workers

| Worker | File | Purpose |
|--------|------|---------|
| scheduledMessagesWorker | workers.ts | Send scheduled WhatsApp messages (welcome, check-in, upsell) |
| scrapeJobsWorker | workers.ts | Scrape URL → call API enrich → update product (raw_text, enriched_text) → call API generate-embeddings |
| analyticsWorker | workers.ts | Process analytics events |
| rfmWorker | intelligenceWorkers.ts | RFM analysis job |
| churnWorker | intelligenceWorkers.ts | Churn prediction job |
| recommendationsWorker | intelligenceWorkers.ts | Product recommendations job |
| abandonedCartWorker | intelligenceWorkers.ts | Abandoned cart job |
| feedbackWorker | intelligenceWorkers.ts | Feedback request job |
| apiKeyExpirationWorker | apiKeyExpirationWorker.ts | Clean up expired API keys |

### Worker lib (`packages/workers/src/lib/`)

- scraper.ts — Product page scraping
- whatsapp.ts — WhatsApp send
- knowledgeBase.ts — Chunk + embeddings (legacy/simpler variant)
- embeddings.ts — Embedding generation
- apiKeyManager.ts — API key hash/validate

---

## 6. Shared (`packages/shared/src/`)

| Module | Purpose |
|--------|---------|
| index.ts | Re-exports public API |
| supabase.ts | Supabase client (service role) |
| redis.ts | Redis connection (ioredis) |
| auth.ts | generateApiKey, hashApiKey, isValidApiKeyFormat |
| queues.ts | QUEUE_NAMES, job types (ScheduledMessageJobData, ScrapeJobData, AnalyticsJobData, etc.) |
| types.ts | Shared types |
| productInstructions.ts | getUsageInstructionsForProductIds, product instructions helpers |
| logger.ts | Pino logger |
| test-setup.ts | Test setup (e.g. Vitest) |

---

## 7. Database (Supabase migrations)

**Path:** `supabase/migrations/`

| File | Purpose |
|------|---------|
| 000_complete_setup.sql | Full schema (vector, tables, indexes) |
| 001_initial_schema.sql | Core schema (merchants, products, users, orders, knowledge_chunks, etc.) |
| 002_rls_policies.sql | RLS policies |
| 003_api_key_rotation.sql | API key rotation support |
| 004_subscription_system.sql | Subscription system |
| 005_performance_indexes.sql | Performance indexes |
| 006_product_instructions.sql | product_instructions table |
| 007_merchant_bot_info.sql | Merchant bot info (key-value) |
| 008_merchant_guardrails.sql | Merchant guardrails |
| 009_enrichment_features.sql | Enrichment features (conversations status, team, ROI, etc.) |
| 010_performance_indexes.sql | Additional performance indexes |
| 011_return_prevention.sql | Return prevention (add-on) |
| 012_fix_delete_cascades.sql | Delete cascade fixes |
| 013_notification_phone.sql | notification_phone |
| 013_product_enriched_text.sql | products.enriched_text column |
| 014_add_super_admin_flag.sql | Super admin flag |

---

## 8. Scripts and docs

### Scripts (`scripts/`)

- check-columns.js
- check-integration.js
- check-migration.ts
- check-tables.js
- create-env.sh — Env var collection for deployment
- ssh-setup-server.sh — SSH key copy to server
- test-ai-bot.sh
- test-shopify-integration.sh
- test-shopify-oauth.sh
- update-nginx-port.sh
- validate-env.sh

**Root-level:** deploy.sh, ecosystem.config.cjs (PM2), playwright.config.ts, vitest.config.ts, eslint.config.js, shopify.app.toml.

### Docs (`docs/`)

| Folder | Purpose |
|--------|---------|
| api | API documentation |
| deployment | Deployment, K8s, runbook, PORTS_AND_ROUTING, NGINX, SSL |
| developer | Architecture, BOT_FLOW |
| installation | Installation, Shopify partner setup, troubleshooting |
| performance | Optimization, CDN |
| setup | Setup guides |
| shopify-app-store | Submission, readiness, checklists |
| sql | SQL snippets (e.g. product_enrichment_columns.sql) |
| testing | Testing, Shopify integration test |
| user-guide | User guide (products, analytics, FAQ) |
| ux | UX docs |
| monitoring | Monitoring |
| guides | Guides |

---

## 9. Memory-bank

**Path:** `memory-bank/`

| File | Purpose |
|------|---------|
| tasks.md | Active task tracking, checklists |
| progress.md | Implementation status, recent changes |
| activeContext.md | Current focus, last action, next steps |
| projectbrief.md | Project brief |
| productContext.md | Product context |
| techContext.md | Tech stack, env vars, ports |
| systemPatterns.md | System patterns, DB tables, queues |
| style-guide.md | Style guide (if present) |
| CURRENT_STATUS.md | Current status snapshot |
| SHOPIFY_READINESS_ASSESSMENT.md | Shopify readiness |
| audit-shopify-perfect-match.md | Audit |
| roadmap-shopify-perfect-match.md | Roadmap |
| roadmap-to-marketplace.md | Marketplace roadmap |
| tasks-kubernetes-newrelic.md | K8s/New Relic tasks |
| tasks-marketplace-ready.md | Marketplace tasks |
| tasks-testing.md | Testing tasks |
| ux-ui-complete-summary.md | UX/UI summary |
| ux-ui-improvements.md | UX/UI improvements |
| archive/ | Archived task docs |
| creative/ | Creative phase docs |
| reflection/ | Reflection docs |

---

*End of Full Application List. One-line descriptions are indicative; see source for exact behavior.*
