# Active Context

> Current focus and active development phase

## Current Phase

**Phase: Shopify Perfect Match + Settings UX**  
**Timeline**: Ongoing  
**Priority**: Product→recipe mapping, consent-aware webhooks, T+0 WhatsApp, Settings choices (product instructions scope, WhatsApp sender)  
**Status**: 🚀 Phases 1–4 done; product_instructions_scope + WhatsApp sender mode on Settings; Phase 5 (tests, docs) remaining

## Active Task: Shopify Perfect Match Roadmap

**Roadmap**: `memory-bank/roadmap-shopify-perfect-match.md`  
**Audit**: `memory-bank/audit-shopify-perfect-match.md`  
**Done**: Phase 1 (product_instructions table + migration, GET/PUT/list API, getUsageInstructionsForProductIds in shared). Phase 2 (fetchShopifyProducts + 429 retry, GET /api/integrations/shopify/products, /dashboard/products/shopify-map page). Phase 3 (consent from Shopify in events.ts, gate queue + T+0 on opt_in, orders/updated→order_delivered when fulfilled). Phase 4 (T+0 job with productIds, worker builds message from instructions, sendWhatsAppMessage). Phase 5 partial (429 in shopify.ts, systemPatterns updated).  
**Remaining**: Phase 5 — offline token note, unit/integration tests for consent + ProductInstruction, user docs.

**Shopify App Store submission (Feb 2026):**
- **Readiness report**: `docs/shopify-app-store/SHOPIFY_APP_MARKET_READINESS_REPORT.md` — technical/policy/billing ready; App Bridge + GraphQL confirmed in report §6.
- **Action tracker**: `docs/shopify-app-store/SHOPIFY_SUBMISSION_ACTIONS.md` — 5 must-dos (icon 1200×1200, screenshots, demo video, dev store test pass, test credentials); recommended (App Bridge/GraphQL confirmed, offline token note, user docs).
- **Remaining before submit**: Media (icon, screenshots, video), full dev store test, test credentials doc; then use report §4 Pre-Submit Checklist.

**Settings (Feb 2026):**
- **Ürün talimatları (WhatsApp yanıtları)**: `product_instructions_scope` — order_only | rag_products_too (required).
- **WhatsApp iletişim numarası**: `whatsapp_sender_mode` — merchant_own (mağaza numarası) | corporate (GlowGuide kurumsal numara). Resolved by `getEffectiveWhatsAppCredentials(merchantId)` in API and workers.
- **Guardrails (Güvenlik Kuralları)**: Settings page has system guardrails (read-only: crisis, medical) and custom guardrails (add/edit/delete). Stored in `merchants.guardrail_settings` (migration 008). API: GET/PUT `/api/merchants/me/guardrails`. AI agent uses custom guardrails in `checkUserMessageGuardrails` and `checkAIResponseGuardrails`. Run migration 008 for guardrails to work.
- **Login**: Email-not-confirmed handling (Turkish copy, resend button); Google social login (OAuth via Supabase). OAuth callback at `/auth/callback`; merchant auto-created for first-time OAuth users in auth middleware.

**Integrations & Dashboard (Feb 2026):**
- **WhatsApp Business bağlantısı**: Entegrasyonlar sayfasında "WhatsApp Business" kartı; mağaza sahibi kendi numarasını bağlayabilir (Phone Number ID, Access Token, Verify Token, isteğe bağlı görünen numara). `integrations` tablosunda `provider: 'whatsapp'`, `auth_data`: phone_number_id, access_token, verify_token, phone_number_display. `getWhatsAppCredentials(merchantId)` önce DB'den (integrations, provider=whatsapp) okuyor, yoksa env (kurumsal) kullanıyor.
- **Kurumsal destek numarası**: +905545736900 (varsayılan). API: `GET /api/config/platform-contact` → `whatsapp_number`. Panelde: Entegrasyonlar sayfasında yeşil "Kurumsal destek (GlowGuide)" banner ve dashboard footer'da "Destek: +90 554 573 69 00" (wa.me link). Env: `PLATFORM_WHATSAPP_NUMBER`, `NEXT_PUBLIC_PLATFORM_WHATSAPP_NUMBER`.
- **Entegrasyon kartları "Bağlı" durumu**: WhatsApp, Shopify, Manuel kartları bağlıysa "✓ Bağlı" rozeti ve yeşil/mor çerçeve; buton "Bağlı" veya "Güncelle" gösteriyor.
- **Layout / web view**: Header üstündeki boşluk kaldırıldı: html/body margin-padding 0, viewport-fit cover, dashboard flex layout (flex-col lg:flex-row), main padding azaltıldı, Sidebar shrink-0.

**Kubernetes + New Relic (In progress):**
- **Spec**: `docs/deployment/KUBERNETES_NEWRELIC_SPEC.md`. **Steps**: `docs/deployment/KUBERNETES_NEWRELIC_DEVELOPMENT_STEPS.md`. **Runbook**: `docs/deployment/KUBERNETES_RUNBOOK.md` (deploy order, rollback, scale, logs, secrets, troubleshooting). **Helm + Alerts**: `docs/deployment/NEWRELIC_K8S_HELM_AND_ALERTS.md` (Phase 4 Helm install, Phase 5 NRQL/alerts/dashboard).
- **Done**: Phase 1–2 (New Relic Node agent in api + workers, Dockerfile CMD with `-r newrelic`). Phase 3.1 + 6.1 (secret keys doc, runbook, `scripts/k8s-apply.sh`). Phase 4–5 doc (Helm commands, alert/dashboard suggestions). Optional CI: `.github/workflows/build-images.yml` (build + push api/workers/web on tag to GHCR).
- **Manifests**: `k8s/` — namespace, configmap, secrets example, api/workers/web deployments and services, ingress. **Remaining**: User applies to cluster (3.2–3.5), Helm install (4), alerts/dashboard in NR UI (5), optional CD after image push.

**Docker + Kubernetes + Ingress (Feb 2026 – done for local):**
- **Docker**: Multi-stage Dockerfile (api, workers, web); production stages use builder output + `pnpm prune --prod`; `--no-optional` in api/workers builders (avoids New Relic native/Python); web builder keeps optional deps (lightningcss). New Relic: `agent_enabled` in `newrelic.cjs` when `NEW_RELIC_ENABLED !== 'false'` and license key set.
- **K8s local**: `scripts/k8s-local.sh` (build images, create secret from .env, apply manifests). `scripts/k8s-create-cluster.sh` (kind/minikube). `k8s/redis-deployment.yaml` (in-cluster Redis); configmap `REDIS_URL=redis://redis:6379`; envFrom order: secret then configmap so configmap overrides.
- **Ingress**: NGINX Ingress Controller via `scripts/k8s-ingress-install.sh`. `k8s/ingress.yaml`: two Ingress resources — (1) `/api-backend/(.*)` → api with rewrite `/$1`; (2) `/api`, `/webhooks`, `/health`, `/metrics`, `/` → api or web. Access: `kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80` then **http://localhost**.
- **API fixes for local/ingress**: HTTPS middleware skips redirect when `Host` is localhost/127.0.0.1 (avoids 301 on /api/auth/me). CORS allows any origin containing `localhost` or `127.0.0.1` in production. Health probe: no redirect for `/health` so K8s readiness passes.
- **Web → API**: Web deployment sets `NEXT_PUBLIC_API_URL=http://api:3001` (server-side proxy). **Browser always uses same-origin** (`packages/web/lib/api.ts`): in browser `getApiBaseUrl()` returns `''` so all requests go to `/api-backend/*` (current host); avoids "Could not reach the API" when API URL is api:3001 or localhost:3001 unreachable from browser. API client throws include `status` for 401 → dashboard redirects to login.
- **Dashboard resilience**: Dashboard loads merchant then stats; if stats fail, shows dashboard with default empty stats + toast. If merchant load fails, shows "Tekrar dene" button. Uses `displayStats = stats ?? defaultStats` for render.

---

## Previous Phases (Marketplace Ready)

**Phase 1: Security & Compliance - ✅ COMPLETE**  
**Completed**: SEC-1.1, SEC-1.2, SEC-1.3, SEC-1.4, SEC-1.5, SEC-1.6, SEC-1.7 (7/7 tasks)  
**Phase 2: Testing & Quality - 🚀 IN PROGRESS**  
**Current**: TEST-LOAD-5.2 (Load Test Scenarios)  
**Status**: Unit tests 90% (12 files, ~130+ tests), Integration structure (5 files), E2E setup complete (7 spec files, 29 tests), Load testing setup complete (4 scenarios)  
**Phase 3: Monitoring & Observability - ✅ COMPLETE**  
**Completed**: MON-3.1, MON-3.2, MON-3.3, MON-3.4 (4/4 tasks)  
**Phase 4: Documentation - ✅ COMPLETE**  
**Completed**: DOC-4.1, DOC-4.2, DOC-4.3, DOC-4.4 (4/4 tasks)  
**Phase 5: Billing & Subscription - ✅ COMPLETE**  
**Completed**: BILL-5.1, BILL-5.2, BILL-5.3, BILL-5.4 (4/4 tasks)  
**Phase 6: Shopify App Store Integration - ✅ COMPLETE**  
**Completed**: SHOP-6.1, SHOP-6.2, SHOP-6.3, SHOP-6.4 (4/4 tasks)  
**Phase 7: Infrastructure - ✅ COMPLETE**  
**Completed**: INFRA-7.1, INFRA-7.2, INFRA-7.3 (3/3 tasks)  
**Phase 8: Performance & Scalability - ✅ COMPLETE**  
**Completed**: PERF-8.1, PERF-8.2, PERF-8.3, PERF-8.4 (4/4 tasks)  
**Phase 9: Code Quality & Maintainability - ✅ COMPLETE**  
**Completed**: CODE-9.1, CODE-9.2, CODE-9.3 (3/3 tasks)  
**Phase 10: User Experience Enhancements - ✅ COMPLETE**  
**Completed**: UX-10.1, UX-10.2, UX-10.3 (3/3 tasks)  
**Phase 7: Infrastructure (All Sub-tasks) - ✅ COMPLETE**  
**Completed**: INFRA-7.1, INFRA-7.2, INFRA-7.3, INFRA-7.4, INFRA-7.5 (5/5 tasks)  
**Next**: Shopify Perfect Match development (see `memory-bank/roadmap-shopify-perfect-match.md`)  
**Overall Progress**: 88% (38/43 marketplace tasks completed); Shopify Perfect Match: 0/47 tasks

## Context

### MVP Status: ✅ COMPLETED
- **Completed**: Faz 4 - UI/UX Complete Overhaul (Jan 20, 2026) ✅
  - ✅ Toast notification system (replaced all alert() calls)
  - ✅ Text color problems completely fixed
  - ✅ Modern card-based layouts
  - ✅ Better loading states (skeleton screens)
  - ✅ Smooth animations and transitions
  - ✅ Improved error handling and user feedback
  - ✅ Real-time updates (polling)
  - ✅ Consistent design language
  - ✅ All 5 main pages redesigned

### Marketplace Readiness: ⚠️ 40% READY
**Assessment Date**: January 20, 2026  
**Status**: NOT READY for Shopify Marketplace  
**Critical Gaps Identified**: 43 major tasks across 10 phases

### Critical Gaps (P0 - Must Complete):
1. **Security & Compliance** (10 days)
   - ❌ Rate limiting
   - ❌ CORS configuration
   - ❌ Security headers
   - ❌ GDPR compliance
   - ❌ Error tracking (Sentry)

2. **Testing & Quality** (11 days)
   - ❌ Test infrastructure (0% coverage)
   - ❌ Unit tests
   - ❌ Integration tests
   - ❌ E2E tests

3. **Monitoring & Observability** (4.5 days)
   - ❌ Structured logging
   - ❌ Application metrics
   - ❌ Uptime monitoring

4. **Documentation** (6 days)
   - ❌ API documentation (OpenAPI/Swagger)
   - ❌ User guide
   - ❌ Installation guide

5. **Billing & Subscription** (9 days)
   - ❌ Subscription system
   - ❌ Usage tracking
   - ❌ Plan limits enforcement

6. **Shopify App Store Integration** (9 days)
   - ❌ App Bridge integration
   - ❌ Shopify Billing API
   - ❌ App store listing

### Roadmap Created:
- 📋 **New Task File**: `memory-bank/tasks-marketplace-ready.md`
- 📊 **Assessment Report**: `MARKETPLACE_READINESS_ASSESSMENT.md`
- 🎯 **10 Phases**: Security → Testing → Monitoring → Docs → Billing → Shopify → Infrastructure → Performance → Code Quality → UX

### Completed Tasks (Jan 20, 2026):
1. ✅ **SEC-1.1**: Rate Limiting Implementation
   - Sliding window rate limiter (Redis-based)
   - IP: 100 req/min, API Key: 1000 req/hour, Merchant: 5000 req/hour
   - Rate limit headers added
2. ✅ **SEC-1.2**: CORS Configuration Fix
   - Environment-based CORS (ALLOWED_ORIGINS)
   - .env.example updated
3. ✅ **SEC-1.3**: Security Headers
   - CSP, HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
   - Referrer-Policy, Permissions-Policy
4. ✅ **SEC-1.4**: Input Validation
   - Zod schemas for all endpoints
   - Validation middleware (body, query, params)
   - Type-safe validated data
5. ✅ **SEC-1.5**: GDPR Compliance
   - Data export/deletion endpoints
   - Privacy Policy, Terms of Service, Cookie Policy pages
   - GDPR section in Settings
6. ✅ **SEC-1.6**: Error Tracking (Sentry)
   - Backend Sentry integration
   - Frontend Sentry integration (Next.js)
   - Error capture in API client
   - Sensitive data filtering
7. ✅ **SEC-1.7**: API Key Rotation
   - API key expiration (90 days default)
   - API key rotation with 24h grace period
   - Last used tracking
   - Expiration warnings (7 days before)
   - Auto-expiration cleanup (daily job)
   - Legacy key migration (automatic)

### Testing Plan Created (Jan 21, 2026):
- ✅ **Comprehensive Test Plan**: `memory-bank/tasks-testing.md` created
- ✅ **5 Phases**: Infrastructure → Unit → Integration → E2E → Load Testing
- ✅ **18 Major Tasks**: Detailed breakdown with priorities
- ✅ **150+ Test Files**: Complete test file structure planned
- ✅ **Coverage Goals**: 70%+ overall, 90%+ for critical modules

### Next Steps:
1. **Current Focus**: Shopify Perfect Match (see `memory-bank/roadmap-shopify-perfect-match.md`)
   - **Phase 1**: Data & Schema — ProductInstruction table, migration, GET/PUT API, helper
   - **Phase 2**: Product Mapping UI — Shopify GraphQL products, admin page to map recipes
   - **Phase 3**: Webhook & Consent — Extract consent from Shopify, gate queue, orders/updated → delivered
   - **Phase 4**: Orchestrator — T+0 job, worker with usage instructions + AI/WhatsApp
   - **Phase 5**: Security & Polish — Offline token, rate limits, tests, docs
2. **Optional parallel**: Phase 2 Testing (tasks-testing.md) can continue alongside Shopify Perfect Match

## Blockers

None currently — Ready to begin Shopify Perfect Match Phase 1

## Notes

- MVP is complete and functional
- UI/UX is polished and production-ready
- Core features work well
- **BUT**: Not ready for marketplace due to missing production requirements
- Detailed roadmap created with 43 major tasks
- Estimated 6-8 weeks to marketplace ready
- Focus on P0 tasks first (49.5 days of critical work)
