# Tasks: GlowGuide Retention Agent

> **Source of Truth** for all development tasks. Tasks are organized by phase and priority.

## Current Focus

**Phase**: MVP Complete + UI/UX Overhaul Complete  
**Status**: ✅ **100% MVP Complete!** All critical features implemented, tested, and polished  
**Deployment**: ✅ **Application is RUNNING** - Frontend (port 3000) + API (port 3001)  
**UI/UX**: ✅ **Production-Ready** - All pages modernized with toast notifications, fixed text colors, and improved UX  
**Next**: Production deployment, optimizations, or additional features (WooCommerce, Ticimax, Billing)

### 🎉 Latest Update (Feb 2026)

**Enrichment Features (Migration 009)** — ALL DONE
- ✅ Human Handoff: conversation_status (ai/human/resolved), reply endpoint, frontend reply input + status controls
- ✅ Team Management: merchant_members table, API CRUD + invite, roles (owner/admin/agent/viewer)
- ✅ ROI Dashboard: /api/analytics/roi, colored ROI cards on analytics page
- ✅ Customer 360: /dashboard/customers list + detail with RFM/churn/orders/conversations
- ✅ RFM Segmentation: daily worker, R/F/M scores, segments
- ✅ Smart Send Timing: user_preferences table
- ✅ Review/Feedback: feedback_requests table, WhatsApp review/NPS worker
- ✅ Abandoned Cart Recovery: abandoned_carts table, WhatsApp reminder worker
- ✅ Churn Prediction: weekly worker, logistic-style scoring
- ✅ AI Product Recommendations: product_recommendations table, weekly co-purchase worker
- ✅ White-Label: merchant_branding table (domain, logo, colors)

**Guardrails (Settings)**
- ✅ System guardrails (crisis, medical) read-only; custom guardrails add/edit/delete. Migration 008: `merchants.guardrail_settings`. Run 008 in Supabase for guardrails to work.

**Auth & Login**
- ✅ Email-not-confirmed handling (Turkish copy, resend button).
- ✅ Google social login: “Google ile giriş yap” on login and signup; OAuth redirect to `/auth/callback`; merchant auto-created for first-time OAuth users.

**Docker + Kubernetes + Ingress (local run)**
- **Done**: Dockerfile fixed (builder output, optional deps). K8s: redis in-cluster, configmap REDIS_URL, scripts k8s-local/k8s-apply/k8s-create-cluster. NGINX Ingress via `scripts/k8s-ingress-install.sh`; `k8s/ingress.yaml` for localhost (/api-backend rewrite to API). API: no 301 for localhost, CORS for localhost; web: browser always same-origin (/api-backend), API client `status` on error; dashboard resilient (stats optional, retry on merchant fail). **Access**: http://localhost (port-forward ingress 80:80) or port-forward web 3000, api 3001.

**Kubernetes + New Relic (In progress)**
- **Done**: Phase 1–2 (New Relic agent in api/workers, Docker CMD); Phase 3.1 + 6.1 (runbook, required-secrets doc, `scripts/k8s-apply.sh`); Phase 4–5 doc (`docs/deployment/NEWRELIC_K8S_HELM_AND_ALERTS.md` — Helm install, NRQL, alerts/dashboard); optional CI (`.github/workflows/build-images.yml` — build/push images on tag).
- **Docs**: `KUBERNETES_RUNBOOK.md`, `KUBERNETES_NEWRELIC_SPEC.md`, `KUBERNETES_NEWRELIC_DEVELOPMENT_STEPS.md`, `NEWRELIC_K8S_HELM_AND_ALERTS.md`. **Remaining**: Apply to cluster (3.2–3.5), Helm (4), alerts/dashboard in NR (5). See `memory-bank/tasks-kubernetes-newrelic.md`.

**Shopify App Store submission**
- Readiness report: `docs/shopify-app-store/SHOPIFY_APP_MARKET_READINESS_REPORT.md` — App Bridge + GraphQL confirmed (§6). Action tracker: `docs/shopify-app-store/SHOPIFY_SUBMISSION_ACTIONS.md` — 5 must-dos (icon 1200×1200, screenshots, demo video, dev store test, test credentials); Pre-Submit Checklist in report §4.

**Integrations & Dashboard**
- ✅ WhatsApp Business connection: Entegrasyonlar'da "WhatsApp Business" kartı; mağaza kendi numarasını bağlayabilir (Phone Number ID, Access Token, Verify Token). DB'de `integrations` provider=whatsapp; `getWhatsAppCredentials` önce DB sonra env.
- ✅ Platform WhatsApp numarası (+905545736900): Entegrasyonlar banner + dashboard footer; `GET /api/config/platform-contact`; env: PLATFORM_WHATSAPP_NUMBER, NEXT_PUBLIC_PLATFORM_WHATSAPP_NUMBER.
- ✅ Entegrasyon kartları "Bağlı" durumu: WhatsApp, Shopify, Manuel bağlıysa "✓ Bağlı" rozeti ve farklı buton metni.
- ✅ Layout / web view: Header üstündeki boşluk kaldırıldı (html/body margin-padding 0, viewport-fit cover, flex layout, main padding azaltıldı).

### Previous (Jan 20, 2026)

**UI/UX COMPLETE OVERHAUL** - All pages modernized and production-ready
- ✅ Toast notification system (replaced all alert() calls)
- ✅ Text color problems completely fixed (all text now readable)
- ✅ Modern card-based layouts across all pages
- ✅ Better loading states with skeleton screens
- ✅ Smooth animations and transitions
- ✅ Improved error handling and user feedback
- ✅ Real-time updates (polling) for conversations
- ✅ Consistent design language throughout
- ✅ Better empty states and modals
- ✅ All 5 main pages completely redesigned:
  - Products (list + detail)
  - Dashboard (KPI cards, quick actions)
  - Conversations (list + detail with WhatsApp-style UI)
  - Integrations (Shopify, CSV, Manual)
  - Settings (Persona builder, API keys)

**SUCCESSFULLY RESOLVED**: "EMFILE: too many open files" error and 404 issues
- ✅ Built application in production mode
- ✅ Fixed Suspense boundary errors in auth/callback pages
- ✅ Fixed TypeScript errors in API client
- ✅ Configured Next.js turbopack properly
- ✅ Application is now running and accessible
- ✅ All endpoints verified (Frontend: 200, API: responding, CORS: configured)

**FIXED**: Product scraping errors
- ✅ Fixed column name mismatch (raw_content → raw_text)
- ✅ Enhanced error logging in products API
- ✅ Product scraping now working correctly

See `RUNNING_APP.md` for complete deployment instructions.

---

## Task List

### Faz 0: Proje Altyapısı (Foundation)

#### Backend (BE)
- [x] **BE-0.1** - Monorepo kurulumu (🔴 Kritik) - ✅ COMPLETED
  - Node.js + TypeScript + Hono
  - pnpm workspace (api, workers, shared)
  - Created: package.json, pnpm-workspace.yaml, tsconfig files
  - Packages: @glowguide/api, @glowguide/workers, @glowguide/shared
- [x] **BE-0.2** - Supabase setup (🔴 Kritik) - ✅ COMPLETED
  - PostgreSQL + pgvector ✅
  - RLS policies ✅
  - Environment variables ✅
  - Created: Supabase client in shared package
  - Created: Database schema migrations (11 tables created)
  - Migration verified: All tables exist
  - Added: Health check endpoint with database connection test
- [x] **BE-0.3** - Redis + BullMQ setup (🔴 Kritik) - ✅ COMPLETED
  - Queue infrastructure (scheduled messages, scrape jobs, analytics) ✅
  - Redis connection setup ✅
  - BullMQ queue configuration ✅
  - Worker processes setup ✅
  - Created: 3 queues (scheduled-messages, scrape-jobs, analytics)
  - Created: 3 workers with error handling
  - Created: Queue helpers for API
  - Health check endpoint updated (Redis + Database)
- [✅] **BE-0.4** - Auth altyapısı (🔴 Kritik) - ✅ COMPLETED
  - ✅ Merchant signup/login (Supabase Auth JWT)
  - ✅ API key generation (hash-based, max 5 per merchant)
  - ✅ Auth middleware (JWT + API key support)
  - ✅ Protected routes (authMiddleware, optionalAuthMiddleware)
  - ✅ Created: /api/auth/signup, /login, /me, /api-keys endpoints

#### Frontend (FE)
- [✅] **FE-0.1** - Frontend monorepo (🔴 Kritik) - COMPLETED
  - ✅ Next.js 14 (App Router) + TypeScript + Tailwind
  - ✅ Supabase client setup
  - ✅ API client utilities
  - ✅ Basic project structure
  - ✅ Monorepo integration
- [✅] **FE-0.2** - Auth sayfaları (🔴 Kritik) - COMPLETED
  - ✅ Login page with email/password
  - ✅ Signup page with email/password/name
  - ✅ Forgot Password page
  - ✅ Dashboard page (protected)
  - ✅ Supabase Auth integration
  - ✅ Form validation and error handling
  - ✅ Redirect logic
  - ✅ Email confirmation flow
  - ✅ API key display modal
- [✅] **FE-0.3** - Layout & Navigation (🔴 Kritik) - COMPLETED
  - ✅ Sidebar component with navigation items
  - ✅ Header component with merchant info
  - ✅ DashboardLayout wrapper with auth protection
  - ✅ Responsive design (mobile menu)
  - ✅ Active route highlighting
  - ✅ Toast notification container

---

## Faz 1: Merchant Onboarding & Entegrasyonlar

### Backend
- [x] **BE-1.1** - Merchant CRUD - ✅ COMPLETED
- [x] **BE-1.2** - Integrations tablosu - ✅ COMPLETED
- [x] **BE-1.3** - Shopify OAuth Connector - ✅ COMPLETED
- [x] **BE-1.6** - Webhook ingestion endpoint - ✅ COMPLETED
- [x] **BE-1.9** - Order/User upsert - ✅ COMPLETED
- [x] **BE-1.7** - CSV Import Endpoint - ✅ COMPLETED

### Frontend
- [x] **FE-1.1** - Dashboard overview - ✅ COMPLETED
- [x] **FE-1.2** - Products page - ✅ COMPLETED + UI/UX Overhaul
- [x] **FE-1.3** - Integrations page - ✅ COMPLETED + UI/UX Overhaul
- [x] **FE-1.4** - Settings page - ✅ COMPLETED + UI/UX Overhaul

---

## Faz 2: Integration Flows

- [x] **FE-2.1** - Shopify OAuth callback handling - ✅ COMPLETED
- [x] **FE-2.2** - CSV Import UI - ✅ COMPLETED + UI/UX Overhaul
- [x] **FE-2.3** - Manual Integration Wizard - ✅ COMPLETED + UI/UX Overhaul

---

## Faz 3: Conversations

- [x] **FE-3.1** - Conversations list - ✅ COMPLETED + UI/UX Overhaul
- [x] **FE-3.2** - Chat detail page - ✅ COMPLETED + UI/UX Overhaul

---

## Faz 4: UI/UX Overhaul (Jan 20, 2026)

### Core Improvements
- [x] **FE-4.1** - Toast Notification System - ✅ COMPLETED
  - ✅ Created Toast component with 4 types (success, error, warning, info)
  - ✅ Created toast helper library
  - ✅ Integrated into DashboardLayout
  - ✅ Replaced all alert() calls across all pages
  - ✅ Auto-dismiss with smooth animations

- [x] **FE-4.2** - Text Color Fixes - ✅ COMPLETED
  - ✅ Fixed all text color issues (text-zinc-900, text-zinc-600, etc.)
  - ✅ Ensured proper contrast ratios
  - ✅ Consistent color scheme throughout
  - ✅ All text now readable and accessible

- [x] **FE-4.3** - Products Page Redesign - ✅ COMPLETED
  - ✅ Modern card-based grid layout
  - ✅ Better empty state
  - ✅ Improved modal design
  - ✅ Loading states with progress feedback
  - ✅ Toast notifications for all actions

- [x] **FE-4.4** - Dashboard Page Redesign - ✅ COMPLETED
  - ✅ Modern KPI cards with icons
  - ✅ Quick actions panel
  - ✅ Recent activity cards
  - ✅ Better alert display
  - ✅ Improved visual hierarchy

- [x] **FE-4.5** - Conversations Page Redesign - ✅ COMPLETED
  - ✅ Filter buttons (all, positive, neutral, negative)
  - ✅ Sentiment indicators
  - ✅ Better conversation cards
  - ✅ WhatsApp-style chat UI in detail page
  - ✅ Real-time updates with polling

- [x] **FE-4.6** - Integrations Page Redesign - ✅ COMPLETED
  - ✅ Clean integration option cards
  - ✅ Modal-based setup flows
  - ✅ Better status indicators
  - ✅ Improved CSV import flow

- [x] **FE-4.7** - Settings Page Redesign - ✅ COMPLETED
  - ✅ Visual persona builder
  - ✅ Better API key management
  - ✅ Improved form layouts
  - ✅ Toast notifications for all actions

### Technical Improvements
- [x] **FE-4.8** - Loading States - ✅ COMPLETED
  - ✅ Skeleton screens for all pages
  - ✅ Better loading indicators
  - ✅ Smooth transitions

- [x] **FE-4.9** - Error Handling - ✅ COMPLETED
  - ✅ Consistent error messages
  - ✅ Toast notifications for errors
  - ✅ Better user feedback

- [x] **FE-4.10** - Animations & Transitions - ✅ COMPLETED
  - ✅ Smooth page transitions
  - ✅ Toast slide-in animations
  - ✅ Button hover effects
  - ✅ Modal animations

---

## Additional Features

- [x] **FE-5.1** - Persona Builder UI - ✅ COMPLETED + Enhanced
- [x] **Real-time Updates** - ✅ COMPLETED
- [x] **FE-6.1** - Analytics Dashboard - ✅ COMPLETED
- [x] **FE-8.1** - Test & Development Interface - ✅ COMPLETED

---

## Overall Progress Summary

### Backend: 100% Complete ✅
- Faz 0: Foundation (Monorepo, Supabase, Redis, Auth)
- Faz 1: Integrations (Shopify OAuth, Webhooks, CSV, Event Processing)
- Faz 2: Products & RAG (Scraping, Embeddings, RAG Pipeline)
- Faz 3: WhatsApp & AI (Messaging, AI Agent, Guardrails, Upsell)

### Frontend: 100% Complete ✅
- Faz 0: Foundation (Monorepo, Auth Pages, Layout)
- Faz 1: Core Pages (Dashboard, Products, Integrations, Settings)
- Faz 2: Integration Flows (Shopify OAuth, CSV Import, Manual Setup)
- Faz 3: Conversations (List, Detail)
- Faz 4: UI/UX Overhaul (Toast notifications, modern layouts, text colors, animations)

### UI/UX Improvements (Completed: Jan 20, 2026)
- ✅ Toast notification system (replaced all alert() calls)
- ✅ Text color problems completely fixed
- ✅ Modern card-based layouts
- ✅ Better loading states (skeleton screens)
- ✅ Smooth animations and transitions
- ✅ Improved error handling and user feedback
- ✅ Real-time updates (polling)
- ✅ Consistent design language
- ✅ Better empty states
- ✅ Improved modals and forms
- ✅ All 5 main pages redesigned (Products, Dashboard, Conversations, Integrations, Settings)

---

## Issues & Blockers

None - All issues resolved! ✅

---

## Next Steps

1. **Shopify Perfect Match** — See `memory-bank/roadmap-shopify-perfect-match.md` for full checklist (Phase 1: ProductInstruction schema + API → Phase 3: Consent + webhook → Phase 4: T+0 orchestrator → Phase 2: Mapping UI → Phase 5: Security & tests).
2. Production deployment preparation
3. Performance optimizations
4. Additional integrations (WooCommerce, Ticimax)
5. Billing & Plans (Faz 7)
6. Advanced analytics features
