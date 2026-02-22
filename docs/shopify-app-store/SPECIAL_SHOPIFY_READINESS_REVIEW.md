# Special Shopify Readiness Review

**App:** Recete Retention Agent  
**Document type:** Consolidated reviewer-focused readiness review  
**Last updated:** February 2026

---

## 1. Executive Summary

| Verdict | **Not yet ready** |
|---------|-------------------|
| **Summary** | Technical and policy requirements are met (OAuth, App Bridge, webhooks, billing, GDPR). Listing and media (icon, screenshots, demo video) and a full dev-store test pass with documented credentials are required before submission. Design uses custom components with Polaris-like tokens; reviewers may expect closer Polaris alignment (buttons, fonts, spacing, native Card look, and consistent loading/empty states). |
| **Gaps** | See [Section 7. Gaps and priorities](#7-gaps-and-priorities). |

---

## 2. Policy and Compliance

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Session tokens for authentication | Done | App Bridge + `POST /api/integrations/shopify/verify-session`; no third-party cookies for embedded. |
| Use Shopify checkout | N/A | App does not handle checkout; post-purchase support only. |
| Direct to Theme Store | Done | No theme download. |
| Factual information | Done | No fake reviews or false purchase notifications. |
| Unique app / single-merchant | Done | Single app; per-merchant data. |
| Web-based app | Done | Next.js web app. |
| GDPR: consent, export, deletion | Done | Consent from Shopify; data export/deletion endpoints; `packages/api/src/routes/shopifyGdpr.ts`, GDPR routes. |
| Privacy / Terms / Cookie policy | Done | Hosted and linked in APP_LISTING.md. |

**Conclusion:** Policy and compliance are ready for review.

---

## 3. Technical Readiness

| Area | Requirement | Status | Evidence |
|------|-------------|--------|----------|
| OAuth | Start, callback, HMAC | Done | `packages/api/src/routes/shopify.ts`: oauth/start, callback, HMAC verified. |
| App Bridge | Load + session verify | Done | `ShopifyProvider` loads app-bridge.js (beforeInteractive); verify-session to API. |
| App Bridge version | Current | Done | `@shopify/app-bridge` ^3.7.11, `@shopify/app-bridge-react` ^4.2.8 in `packages/web/package.json`. |
| Webhooks | HMAC, subscribed topics | Done | `packages/api/src/routes/webhooks.ts`; HMAC; normalizeShopifyEvent → processNormalizedEvent. |
| Billing | Recurring, plan changes, add-ons | Done | `packages/api/src/lib/shopifyBilling.ts`, `routes/billing.ts`. |
| Security | TLS, scopes, headers, rate limit | Done | HTTPS (deploy); scopes documented; security headers middleware; rate limiting. |
| GraphQL Admin API | Products/orders via GraphQL | Done | `packages/api/src/lib/shopify.ts`: fetchShopifyProducts uses `admin/api/2024-01/graphql.json`. |

**Conclusion:** Technical readiness is sufficient for submission once listing/media and testing are complete.

---

## 4. Design and UX (Polaris / Reviewer Expectations)

### 4.1 Current State

- **Polaris:** App uses `@shopify/polaris` **AppProvider** and Polaris CSS in [packages/web/components/ShopifyProvider.tsx](packages/web/components/ShopifyProvider.tsx). **No Polaris UI components** (Card, Button, EmptyState, Spinner, etc.) are used on dashboard pages; all layout and controls use **custom components** from `packages/web/components/ui/` (e.g. Card, Button — Radix/shadcn-style).
- **Tokens:** [packages/web/app/globals.css](packages/web/app/globals.css) defines Polaris-aligned tokens (e.g. surface #f6f6f7, border #e1e3e5, card white) so the overall look is “Polaris-like” but not native Polaris components.
- **Reviewer expectation:** Buttons, fonts, and spacing should look like native Shopify; main content in white boxes with subtle borders (Shopify Card style); clear loading and empty states on key flows.

### 4.2 Page-by-Page Audit

| Page | Route | Components | Card usage | Loading state | Empty state |
|------|--------|------------|------------|---------------|-------------|
| Dashboard | `/dashboard` | Custom Card, Button | White cards, border; welcome banner + KPI + recent orders/conversations + quick actions | Skeleton (pulse placeholders for title, KPI blocks, two large blocks) | Recent orders: text only (`recentOrders.empty`). Recent conversations: text only (`recentConversations.empty`). |
| Integrations | `/dashboard/integrations` | Custom Card, Button | White cards with shadow/ring; provider cards + active list | Skeleton (title/subtitle + 4 provider placeholder cards) | Active list: icon + `active.empty.title` in dashed card. |
| Products | `/dashboard/products` | Custom Card, Button | Product grid cards; empty state in dashed card | Skeleton (title + 3 card placeholders) | Icon (Package), title, description, Refresh + Add product buttons. |
| Shopify map | `/dashboard/products/shopify-map` | Custom Card, Button | Table in card; empty in dashed card | Skeleton (title + card with 3 row placeholders) | Icon (Package), title, description, Connect (to Integrations) CTA. |
| Conversations | `/dashboard/conversations` | Custom Card, Button | List in card; empty in dashed card | Skeleton (title + 3 row placeholders) | Icon (MessageSquare), title, description, disabled “Start conversation” button. |
| Settings | `/dashboard/settings` | Custom Card, Button | Multiple section cards (notifications, bot persona, modules, guardrails, API keys, GDPR) | Skeleton (title + 2 block placeholders) | API keys: key icon + “No API keys yet”. Guardrails: text only (`guardrails.empty`). |

### 4.3 Design/UX Gaps

- **Components:** All key pages use **custom** Card and Button, not Polaris `Card`, `Button`, or `EmptyState`. Typography and spacing follow custom/Tailwind, not Polaris component spacing/font tokens.
- **Cards:** Content is in white boxes with borders/shadows; appearance is “Polaris-like” via CSS variables but not Polaris Card component (reviewers may notice subtle differences).
- **Loading:** Every page has a **loading state** implemented as custom skeletons (animate-pulse placeholders). No Polaris `Spinner` or `SkeletonPage`; consistency and look differ slightly by page.
- **Empty states:** Present on Dashboard (recent orders/conversations), Integrations, Products, Shopify map, Conversations, and Settings (API keys, guardrails). Most use icon + title + description + CTA where applicable; none use Polaris `EmptyState`. Conversations empty state uses a **disabled** primary button (no clear CTA).
- **Buttons/fonts/spacing:** Not using Polaris Button or typography; “native Shopify” look is only approximated via globals.css.

**Conclusion:** Design is functional and Polaris-**aligned** (theme, tokens, light background). For stricter reviewer expectations, consider migrating to Polaris components (Card, Button, EmptyState, Spinner/SkeletonPage) and matching Polaris spacing/fonts on key pages.

---

## 5. Listing and Media

| Item | Status | Notes |
|------|--------|-------|
| App name | Done | “Recete Retention Agent” consistent in code and APP_LISTING.md. |
| App icon 1200×1200 | TODO | JPEG or PNG; upload in Partner Dashboard. |
| Screenshots (5+, 1280×720) | TODO | e.g. Dashboard, Integrations, Shopify map, Conversations, Settings. No pricing in images. |
| Demo video (2–3 min) | TODO | Key flows: install, connect WhatsApp, product mapping, conversation. |
| Pricing | Done | In APP_LISTING.md; only in “Pricing details” in listing. |
| Support / legal URLs | Done | Privacy, Terms, Cookie policy hosted and correct. |

---

## 6. Testing and Credentials

- **Dev store test:** Full pass required before submit: install → OAuth → product map → webhook (order fulfilled + consent) → T+0; billing upgrade/downgrade and add-on; no 404/500 on main paths. See [DEV_STORE_TEST_CHECKLIST.md](DEV_STORE_TEST_CHECKLIST.md).
- **Test credentials:** Dev store URL, admin access, test WhatsApp or “test mode” instructions, and short review notes. Use [REVIEW_CREDENTIALS_TEMPLATE.md](REVIEW_CREDENTIALS_TEMPLATE.md).
- **Pre-submit:** App on HTTPS; OAuth redirect and webhooks point to production; App Bridge and session verify working in embedded context; billing create/approve/cancel and plan change verified.

---

## 7. Gaps and Priorities

| ID | Area | Description | Priority | Owner/Notes |
|----|------|-------------|----------|-------------|
| G1 | Listing | App icon 1200×1200 (JPEG or PNG) | P0 | Design; upload in Partner Dashboard |
| G2 | Listing | Screenshots 5+ (min 1280×720) | P0 | Product/Marketing |
| G3 | Listing | Demo video 2–3 min | P0 | Product |
| G4 | Testing | Full dev store test pass | P0 | QA/Dev |
| G5 | Testing | Test credentials + review notes | P0 | Dev; use REVIEW_CREDENTIALS_TEMPLATE |
| G6 | Listing | Partner Dashboard listing (description, tagline, pricing) | P0 | Product |
| D1 | Design | Use Polaris Card/Button/EmptyState on key pages for native look | P1 | Optional; reviewer feedback |
| D2 | Design | Use Polaris Spinner or SkeletonPage for loading | P1 | Optional |
| D3 | Design | Conversations empty state: provide clear CTA (e.g. enable WhatsApp) instead of disabled button | P2 | UX improvement |

**P0:** Must complete before submit. **P1:** Recommended for reviewer expectations. **P2:** Nice to have.

---

## 8. References

**This repo:**

- [memory-bank/SHOPIFY_READINESS_ASSESSMENT.md](../../memory-bank/SHOPIFY_READINESS_ASSESSMENT.md) — BFS gaps and what’s ready
- [SHOPIFY_APP_MARKET_READINESS_REPORT.md](SHOPIFY_APP_MARKET_READINESS_REPORT.md) — Requirements mapping and pre-submit checklist
- [REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md) — Pre-submission checklist
- [DEV_STORE_TEST_CHECKLIST.md](DEV_STORE_TEST_CHECKLIST.md) — Dev store test steps
- [REVIEW_CREDENTIALS_TEMPLATE.md](REVIEW_CREDENTIALS_TEMPLATE.md) — Test credentials and review notes
- [SHOPIFY_SUBMISSION_ACTIONS.md](SHOPIFY_SUBMISSION_ACTIONS.md) — Submission action tracking

**Shopify:**

- [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- [App Store review process](https://shopify.dev/docs/apps/launch/app-store-review/review-process)
- [Submit for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)
- [Polaris](https://polaris.shopify.com/)
- [Built for Shopify achievement criteria](https://shopify.dev/docs/apps/launch/built-for-shopify/achievement-criteria)
