# Active Context

> Current focus and active development phase

## Current Phase

**Phase: ✅ Deployed & Live + Enrichment Features + Enhanced UX/UI**  
**Server**: 209.97.134.215 (DigitalOcean)  
**URL**: http://209.97.134.215  
**Date**: February 17, 2026  
**Last Deploy**: cd873a2 (Recete rebrand: name, logo R, docs, memory-bank)

## Enrichment Roadmap (Feb 2026 - implemented)

All features from the Recete Enrichment Roadmap have been implemented:

### Phase 1: Revenue Activation
- **Human Handoff (1.2)**: Conversation status (`ai`/`human`/`resolved`), merchant reply via WhatsApp, status toggle in UI, reply input in conversation detail. WhatsApp webhook skips AI when status=`human`. Migration 009.
- **Team Management (1.3)**: `merchant_members` table with roles (owner/admin/agent/viewer). API: list, invite, update role, remove. Route: `/api/merchants/me/members`.
- **ROI Dashboard (1.4)**: `GET /api/analytics/roi` — saved returns (complaint→positive), repeat purchases, resolved conversations, messages total. ROI cards on analytics page.

### Phase 2: Intelligence & Engagement
- **Customer 360 (2.1)**: `/dashboard/customers` page with list + detail. Backend: `GET /api/customers` (pagination, search, segment filter), `GET /api/customers/:id` (orders, conversations, feedback, RFM, churn). Sidebar nav added.
- **RFM Segmentation (2.2)**: Daily worker scores Recency/Frequency/Monetary (1–5 each), assigns segment (champions/loyal/promising/at_risk/lost/new). Columns on `users` table. Queue: `rfm-analysis`, cron `0 2 * * *`.
- **Smart Send Timing (2.3)**: `user_preferences` table (optimal_send_hour, timezone, avg_response_time). Infrastructure ready for WhatsApp read receipt tracking.
- **Review/Feedback (2.4)**: `feedback_requests` table (review/NPS). Worker sends WhatsApp review request or NPS survey. Queue: `feedback-request`.

### Phase 3: Growth
- **Abandoned Cart (3.1)**: `abandoned_carts` table. Worker sends WhatsApp reminder with product names + recovery URL. Queue: `abandoned-cart`. Infrastructure for Shopify `checkouts/create` webhook.
- **Churn Prediction (3.2)**: Weekly worker scores churn probability (0–1) based on RFM + engagement. Columns: `users.churn_probability`, `churn_scored_at`. Queue: `churn-prediction`, cron `0 3 * * 1`.
- **AI Recommendations (3.3)**: `product_recommendations` table with co-purchase scoring. Weekly worker builds recommendations. Queue: `product-recommendations`, cron `0 4 * * 2`.

### Phase 4: Platform Maturity
- **White-Label (4.1)**: `merchant_branding` table (domain, logo_url, primary_color, secondary_color). Migration 009.

### Migration 009
All schema changes in `supabase/migrations/009_enrichment_features.sql`:
- `conversations`: + conversation_status, assigned_to, escalated_at
- `users`: + email, rfm_score, segment, churn_probability, churn_scored_at
- New tables: merchant_members, user_preferences, feedback_requests, abandoned_carts, product_recommendations, merchant_branding

### New Files
- `packages/api/src/routes/customers.ts` — Customer 360 API
- `packages/api/src/routes/members.ts` — Team management API
- `packages/workers/src/intelligenceWorkers.ts` — RFM, Churn, Recommendations, Abandoned Cart, Feedback workers
- `packages/web/app/[locale]/dashboard/customers/page.tsx` — Customer list
- `packages/web/app/[locale]/dashboard/customers/[id]/page.tsx` — Customer detail

## Deployment Status

| Service | Status | PM2 Name | Port | Updated |
|---------|--------|----------|------|---------|
| API (Hono) | ✅ Online | api | 3002 | Feb 19, 2026 |
| Frontend (Next.js) | ✅ Online | web | 3001 | Feb 19, 2026 |
| Workers (BullMQ) | ✅ Online | workers | - | Feb 19, 2026 |
| Redis | ✅ Connected | system | 6379 | Active |
| Supabase DB | ✅ Connected | cloud | - | Active |

**Latest Build**: Next.js 16 (Turbopack) - 3.5s compile time (Polaris + App Bridge v4)
**Build Status**: ✓ Compiled successfully - 0 errors, 0 warnings  
**Routes Generated**: 25 routes (all optimized)

### Recent Updates (Feb 19, 2026)
- ✅ **Shopify Compliance & Quality**:
  - **Embedded App**: Validated `frame-ancestors` CSP for Shopify Admin embedding.
  - **App Bridge v4**: Upgraded to latest CDN-based App Bridge with `next/script`.
  - **Design Guidelines**: Integrated `@shopify/polaris` (PolarisProvider) for consistent UI/UX.
  - **No Asset API**: Confirmed zero usage; scaffolded `theme-app-extension` for future storefront features.
  - **Session Tokens**: Confirmed secure Token Exchange auth flow.
- ✅ **Shopify Best Practices Migration**:
  - **Token Exchange**: Replaced manual OAuth redirects with seamless Token Exchange logic in `/verify-session`.
  - **Managed Installation**: Created `shopify.app.toml` to let Shopify manage scopes and webhooks.
  - **Frontend "Magic Fix"**: Monkey-patched Supabase client to inject Shopify Session Tokens automatically when in embedded mode.
  - **Dependencies**: Fixed `@recete/shared` resolution and removed Sentry profiling binary to unblock deployment.
- ✅ **Recete rebrand**: Application name Recete → Recete everywhere (web layout, messages en/tr, Sidebar, DashboardLayout, terms, privacy, API title/bot/scraper, workers, shared). Logo letter G → R in sidebar, mobile header, landing. Docs and memory-bank updated. Pushed (cd873a2), deployed to 209.97.134.215; api, web, workers online.
- ✅ **App icon fix**: Deleted stale `app/favicon.ico` which was overriding the new icon. Moved `icon.png` to `app/` directory for correct Next.js metadata generation. Browser logo issue resolved.
- ✅ **Brand Colors**: Updated `globals.css` to match Recete brand guidelines. Primary: `#4FD1C5` (Electric Blue), Dark Background: `#1A202C` (Dark Slate Blue).
- ✅ **Deep Cleanup**: Performed comprehensive search and removal of all "GlowGuide"/"glowguide" references. Validated that remaining "glow" matches are only CSS animations (`animate-glow`) or test data.
- ✅ **Git push + server deploy**: Latest push 85abb4a; server pull, build, PM2 reload successful (api, web, workers online).
- ✅ Complete UX/UI overhaul deployed (32/36 tasks - 89%)
- ✅ Enhanced design system with semantic colors
- ✅ 10+ new animations (shimmer, glow, shake, float)
- ✅ 4 new components (IconWrapper, EmptyState, Spinner, KeyboardShortcuts)
- ✅ All pages redesigned (Products, Conversations, Settings, Integrations, Analytics)
- ✅ Full accessibility support (WCAG AA compliant)
- ✅ **NEW:** Shopify Map page fully enhanced with new design system
  - Replaced all inline SVGs with Lucide React icons
  - Integrated Card, Button, Badge components with enhanced variants
  - Added staggered animations and micro-interactions
  - Enhanced loading states with gradient skeletons
  - Full ARIA labels and accessibility support
  - Success highlight animation on save
- ✅ Production build successful with zero errors (53s server compile)

## Configuration Notes

- `NODE_ENV=development` — HTTPS redirect disabled (no SSL certificate yet)
- `ALLOWED_ORIGINS=http://209.97.134.215,http://localhost:3000` (api). Web: `INTERNAL_API_URL=http://127.0.0.1:3002` so "Could not reach the API" is avoided.
- Supabase keys validated and working
- Nginx: `/` and `/api-backend/*` → port 3001 (web); `/api/*` and `/health` → port 3002 (api). Web must set INTERNAL_API_URL=http://127.0.0.1:3002 (see docs/deployment/PORTS_AND_ROUTING.md).

## What's Working

- ✅ User signup/login (Supabase Auth)
- ✅ API health check with DB + Redis status
- ✅ Frontend served via Nginx
- ✅ API routes (auth, integrations, analytics, webhooks)
- ✅ Background workers (BullMQ)
- ✅ PM2 auto-restart on crash
- ✅ PM2 auto-start on server reboot
- ✅ CORS configured

## Remaining TODO

1. **SSL/HTTPS**: Set up Let's Encrypt for HTTPS (then change NODE_ENV back to production)
2. **Custom Domain**: Point a domain name to 209.97.134.215
3. **Shopify App Store**: Complete submission (media assets, dev store test)

## Return Prevention Module (Feb 2026 — Implemented)

Optional paid add-on module. Detects return intent in customer messages via AI, serves product-specific usage guides/videos to prevent returns.

### Components Implemented
- **Migration 011**: `merchant_addons` table, `return_prevention_attempts` table, extended `product_instructions` with `video_url` and `prevention_tips`
- **Add-on Billing**: Separate `RecurringApplicationCharge` per add-on (independent from main subscription). Routes: `GET /api/billing/addons`, `POST /subscribe`, `POST /cancel`, `GET /confirm`
- **AI Agent**: New `return_intent` intent type. Prevention flow: check addon active → detect repeat intent → fetch product content (video_url, tips, RAG) → build prevention prompt → log attempt → escalate if insisting
- **Product Instructions**: Extended with `video_url` and `prevention_tips` fields (schema, API, frontend form)
- **Analytics**: `GET /api/analytics/return-prevention` endpoint. ROI `savedReturns` now uses structured `return_prevention_attempts` data instead of keyword matching
- **Settings UI**: Modules section with toggle, pricing note, confirmation dialog, plan gate
- **Conversation Detail**: Return prevention badge with outcome (Prevented/Returned/Escalated/Pending)
- **Translations**: Full `ReturnPrevention` namespace in `en.json` and `tr.json`

## Current Phase: Localization & Refinement
**Focus:** Internationalization (English/Turkish), Deployment, SSL Setup.

### Recent Accomplishments
-   [x] **Refactored structure** for i18n (moved to `app/[locale]`).
-   [x] **Implemented `next-intl`** middleware and configuration.
-   [x] **Localized** Landing, Login, Signup, and Dashboard Home pages.
-   [x] Created English (`en`) and Turkish (`tr`) locales.
-   [x] Verified build success locally.
-   [x] **Full dashboard localization** (Feb 17, 2026): Application is localized for **English (default)** and **Turkish**. All user-visible strings use `useTranslations()` and `t()` from `next-intl`. Translation namespaces added/used: **ShopifyMap**, **Conversations**, **Analytics** (ROI), **Customers**, **CustomerDetail**, **ConversationDetail**, **BotInfo**, **ProductDetail**, **Test**, **Sidebar**, **ShopifyCallback**, **Integrations** (createdLabel). Pages updated: shopify-map, conversations (list + detail), analytics, integrations, sidebar, customers (list + detail), settings/bot-info, products/[id], dashboard/test, integrations/shopify/callback. Build passes with zero errors.

### Active Tasks
-   [x] **Deploy changes** to DigitalOcean.
-   [x] **Fix Build Errors**: Resolved invalid JSON in translation files and TypeScript error in Settings page.
-   [x] **Localize remaining dashboard pages** — Products, Conversations, Analytics, Customers, Integrations, Shopify callback, Bot Info, Test page; all use `en`/`tr` keys.
-   [ ] **Setup SSL** (Blocked: waiting for custom domain).

## Completed Phases (Historical)

### MVP: ✅ COMPLETE
- All 4 phases done: Backend, Frontend, Integration, UI/UX Overhaul

### Shopify Optimization: 🚀 In Progress
- **Storefront Performance**:
  - **Requirement**: "Built for Shopify" requires minimal impact on LCP/CLS.
  - **Strategy**: Use **App Embed Blocks** (load scripts only on specific pages) instead of global ScriptTags.
  - **Assets**: Host assets in the extension's `assets/` folder to leverage Shopify CDN (HTTP/2 + caching).
  - **Next Step**: Once the app is listed, we will migrate any remaining storefront scripts to App Embeds.

### Marketplace Readiness: ✅ 88% COMPLETE (38/43 tasks)
- Phase 1: Security & Compliance ✅
- Phase 2: Testing & Quality 🚀 (90% unit tests, E2E setup)
- Phase 3: Monitoring & Observability ✅
- Phase 4: Documentation ✅
- Phase 5: Billing & Subscription ✅
- Phase 6: Shopify App Store Integration ✅
- Phase 7: Infrastructure ✅
- Phase 8: Performance & Scalability ✅
- Phase 9: Code Quality ✅
- Phase 10: UX Enhancements ✅

### Shopify Perfect Match: ✅ Phases 1-4 COMPLETE
- Phase 1: Data & Schema (product_instructions table)
- Phase 2: Product Mapping UI (Shopify GraphQL)
- Phase 3: Webhook & Consent (GDPR/KVKK)
- Phase 4: Orchestrator (T+0 welcome message)
- Phase 5: Security & Polish (partially done)

## Blockers

- **Supabase email rate limit** — wait ~1 hour after testing or adjust in Supabase dashboard
- **No SSL** — HTTPS redirect disabled; need Let's Encrypt for production NODE_ENV

## Server Access

```bash
ssh root@209.97.134.215
cd /root/retetionai
pm2 list          # check services
pm2 logs          # view logs
pm2 restart all   # restart everything
```
