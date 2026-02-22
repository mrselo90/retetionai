eu01xx67bb44793d88e5ff11596b5abaFFFFNRAL# Shopify App Market Readiness Report

**App**: Recete Retention Agent  
**Report Date**: February 2026  
**Scope**: Readiness for Shopify App Store distribution

---

## Executive Summary

| Aspect | Verdict | Notes |
|--------|---------|--------|
| **Technical readiness** | ✅ **Ready** | OAuth, webhooks, App Bridge, Billing API, session tokens, product mapping, consent-aware flows implemented. |
| **Policy & security** | ✅ **Ready** | Session tokens, Shopify checkout (N/A—no checkout), factual listing, TLS, scopes, GDPR. |
| **Billing** | ✅ **Ready** | Shopify Billing API used; plan changes supported. |
| **Listing & media** | ⚠️ **Action required** | Copy and structure ready; **app icon (1200×1200)**, **screenshots**, **demo video** still needed. |
| **Testing & review** | ⚠️ **Action required** | Full run-through on dev store and documented test credentials needed before submit. |

**Overall verdict**: **Ready for submission** once media assets are created and a full dev-store test pass is completed. No blocking technical gaps.

---

## 1. Shopify App Store Requirements Mapping

### 1.1 Policy (Build and operate within Shopify’s platform)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **1.1.1 Session tokens for authentication** | ✅ | App Bridge + `POST /api/integrations/shopify/verify-session`; session token auth; no reliance on third-party cookies for embedded experience. |
| **1.1.2 Use Shopify checkout** | ✅ N/A | App does not handle checkout or payments; post-purchase support only. |
| **1.1.3 Direct to Theme Store** | ✅ | No theme download; themes only via Theme Store. |
| **1.1.4 Factual information** | ✅ | No fake reviews or false purchase notifications; listing and in-app copy factual. |
| **1.1.5 Unique app** | ✅ | Single app; not a duplicate of another listing. |
| **1.1.6 Single-merchant storefronts** | ✅ | Per-merchant data; not a marketplace. |
| **1.1.7–1.1.16** (Payments, POS, consent, shipping, extensions, etc.) | ✅ N/A or met | No payment gateway, no POS, no cart/checkout changes, web-based only, no refund/lending. |
| **1.1.12 Web-based app** | ✅ | Next.js web app; no desktop app required. |

### 1.2 Billing (Shopify Billing API or Managed Pricing)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **1.2.1 Use Billing API or Managed Pricing** | ✅ | `packages/api/src/lib/shopifyBilling.ts`, `routes/billing.ts`; recurring charges via Shopify Billing API. |
| **1.2.2 Implement correctly** | ✅ | Create/cancel recurring charge; approval flow; reinstall/approval handling. |
| **1.2.3 Plan changes** | ✅ | Upgrade/downgrade via API; no “contact support to change plan” requirement. |

### 2. Functionality

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **2.1.1–2.1.2 No critical/minor errors** | ⚠️ Verify | No known 404/500 on core flows; full test pass on dev store recommended. |
| **2.1.3 UI merchants can use** | ✅ | Dashboard, Integrations, Products, Shopify map, Settings, Conversations, Analytics, Test. |
| **2.1.4 Data sync** | ✅ | Orders, fulfillments, products, customers via webhooks + GraphQL; consent and delivery status aligned. |
| **2.2.1 Use Shopify APIs** | ✅ | Admin API (GraphQL): products, orders, fulfillments, customers; OAuth; webhooks. |
| **2.2.2 Embedded experience** | ✅ | App Bridge; embedded in Shopify Admin. |
| **2.2.3 Latest App Bridge** | ✅ Confirmed | `@shopify/app-bridge` ^3.7.11, `@shopify/app-bridge-react` ^4.2.8 in `packages/web/package.json`; `ShopifyProvider` and verify-session in use. |
| **2.2.4 GraphQL Admin API** | ✅ Confirmed | Products via GraphQL only: `fetchShopifyProducts` in `packages/api/src/lib/shopify.ts` uses `admin/api/2024-01/graphql.json`; no REST for products/orders. |
| **2.3.1 Install from Shopify surface** | ✅ | Install from App Store; OAuth flow; no manual myshopify.com entry during install. |
| **2.3.2–2.3.4 OAuth before UI / redirect / reinstall** | ✅ | OAuth first; redirect to app UI; reinstall triggers OAuth again. |

### 3. Security

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **3.1.1 Valid TLS/SSL** | ✅ | Production must use HTTPS with valid certificate (deployment responsibility). |
| **3.2.x Scopes** | ✅ | Scopes: read_orders, read_fulfillments, read_products, read_customers (and billing); no sensitive optional scopes without justification. |

Additional security in place: HMAC webhook verification, rate limiting, security headers, input validation (Zod), GDPR (export/deletion), no exposure of tokens in list/GET integration responses.

### 4. App Store Listing

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **4.1.1 App name consistent** | ✅ | “Recete Retention Agent” in codebase and `docs/shopify-app-store/APP_LISTING.md`. |
| **4.1.2 App icon** | ❌ **TODO** | **Icon must be 1200×1200 px** (JPEG or PNG) per current Shopify requirements. Upload in Partner Dashboard and match in listing. |
| **4.2.x Pricing** | ✅ | Pricing in APP_LISTING.md; must be only in “Pricing details” in listing; not in icon or screenshots. |
| **4.3.x Accurate listing** | ✅ | Listing copy in APP_LISTING.md; indicate if Online Store required; no unsubstantiated stats/guarantees. |

---

## 2. Current Implementation Summary

### 2.1 Backend (API)

- **Shopify OAuth**: start, callback, HMAC, token exchange, scopes (orders, fulfillments, products, customers).
- **Webhooks**: `POST /webhooks/commerce/shopify`; HMAC; `normalizeShopifyEvent` → `processNormalizedEvent`; consent from Shopify; `orders/updated` → `order_delivered` when fulfilled.
- **Session**: `shopifySession.ts`; `POST /api/integrations/shopify/verify-session` for App Bridge.
- **Billing**: `shopifyBilling.ts` + `routes/billing.ts`; recurring charges, plan changes, usage/limits.
- **Products**: `fetchShopifyProducts` (GraphQL, 429 retry); `GET /api/integrations/shopify/products`.
- **Product instructions**: Table `product_instructions`; GET/PUT instruction, list; used for T+0 and RAG.
- **Consent**: From Shopify marketing consent; `consent_status` (opt_in/opt_out/pending); T+0 and scheduled messages only when `opt_in`.
- **WhatsApp**: Per-merchant or corporate; `getWhatsAppCredentials` from DB (integrations provider=whatsapp) or env; platform number via `GET /api/config/platform-contact`.

### 2.2 Workers

- T+0 welcome: job type `welcome` with `productIds`; `getUsageInstructionsForProductIds`; message from instructions; send via WhatsApp.
- T+3/T+14: unchanged; gated by consent.

### 2.3 Frontend (Web)

- Dashboard, Integrations (Shopify, CSV, Manual, **WhatsApp Business**), Products, **Shopify map** (`/dashboard/products/shopify-map`), Settings (persona, **WhatsApp sender mode**, bot info), Conversations, Analytics, Test.
- App Bridge: `ShopifyProvider`, verify-session to API.
- **Integrations**: “Bağlı” state for WhatsApp, Shopify, Manual; platform support number banner and footer.

### 2.4 Legal & Compliance

- Privacy Policy, Terms of Service, Cookie Policy (hosted, linked in APP_LISTING.md).
- GDPR: data export/deletion endpoints; consent handling.

---

## 3. Gaps and Action Items

### 3.1 Must complete before submission

| # | Item | Owner | Notes |
|---|------|--------|-------|
| 1 | **App icon 1200×1200** | Design | JPEG or PNG; upload in Partner Dashboard; match in listing. |
| 2 | **Screenshots (5+)** | Product/Marketing | Min 1280×720 px; e.g. Dashboard, Integrations, Shopify map, Conversations, Settings. No pricing in images. |
| 3 | **Demo video (2–3 min)** | Product | Key flows: install, connect WhatsApp, product mapping, conversation. |
| 4 | **Full test on dev store** | QA/Dev | Install → OAuth → product map → webhook (order fulfilled + consent) → T+0 message; billing upgrade/downgrade; no 404/500 on main paths. |
| 5 | **Test credentials for review** | Dev | Dev store URL, test WhatsApp (or instructions), API keys, admin access as required by review form. |

### 3.2 Recommended before or soon after submit

| # | Item | Notes |
|---|------|--------|
| 6 | **Confirm App Bridge version** | Ensure latest App Bridge and script tag per Shopify docs. |
| 7 | **Confirm GraphQL-only for new features** | As of April 2025, new public apps must use GraphQL Admin API; confirm no new REST usage. |
| 8 | **Offline access token** | Document that OAuth requests offline access for background jobs; optional note in submission. |
| 9 | **User/install docs** | Short doc or in-app steps for recipe mapping and WhatsApp connection (Integrations + Settings). |

### 3.3 Already done (no action)

- OAuth, webhooks, session, billing, scopes, security, GDPR, listing copy, legal pages, API docs, error handling, rate limiting.

---

## 4. Submission Checklist (Pre-Submit)

Use this as a final gate before “Submit for review”.

### Technical

- [ ] App runs on production URL with valid TLS (HTTPS).
- [ ] OAuth redirect URI matches Partner Dashboard (exact).
- [ ] Webhooks subscribed and pointing to production (`orders/create`, `orders/fulfilled`, `orders/updated`, billing if used).
- [ ] No critical or minor errors during full flow (install → config → usage).
- [ ] App Bridge loads and session verification works in embedded context.
- [ ] Billing: create/approve/cancel charge and plan change work.

### Listing

- [ ] App name matches between Partner Dashboard and listing.
- [ ] App icon 1200×1200 uploaded and consistent.
- [ ] Screenshots (5+) uploaded; no pricing in images.
- [ ] Demo video (2–3 min) uploaded.
- [ ] Pricing only in Pricing details; accurate and complete.
- [ ] Support email and docs URL correct.
- [ ] Privacy Policy, Terms, Cookie Policy URLs live and correct.

### Review package

- [ ] Test store URL and admin access for reviewers.
- [ ] Test WhatsApp or clear “test mode” instructions.
- [ ] Review notes: short description of flows to test (install, map products, fulfill order with consent, check T+0).

---

## 5. Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|--------|
| **Media (icon, screenshots, video)** | 3–5 days | Design + capture + edit. |
| **Dev store test pass** | 1–2 days | Full flow + billing + edge cases. |
| **Prepare test credentials & notes** | 0.5 day | Document for review form. |
| **Submit** | — | Submit in Partner Dashboard. |
| **Shopify review** | 5–7 business days | Initial review. |
| **Re-review if needed** | 3–5 business days | After fixes. |

**Rough total to “Submitted”**: ~1–2 weeks including media and testing.  
**To “Published”**: +1–2 weeks depending on review and any changes.

---

## 6. Verification (Feb 2026)

- **App Bridge**: `packages/web/package.json` — `@shopify/app-bridge` ^3.7.11, `@shopify/app-bridge-react` ^4.2.8. Embedded app uses `ShopifyProvider` and session verification via `POST /api/integrations/shopify/verify-session`.
- **GraphQL Admin API**: `packages/api/src/lib/shopify.ts` — `fetchShopifyProducts` uses `https://{shop}/admin/api/2024-01/graphql.json` for products; no REST for products or new features. OAuth and webhooks use required Shopify endpoints.

---

## 7. References

- **This repo**: `memory-bank/SHOPIFY_READINESS_ASSESSMENT.md`, `docs/shopify-app-store/REVIEW_CHECKLIST.md`, `docs/shopify-app-store/APP_LISTING.md`, `docs/shopify-app-store/SHOPIFY_SUBMISSION_ACTIONS.md`. For a consolidated reviewer-focused review (policy, technical, design/UX, listing, testing, gaps), see [SPECIAL_SHOPIFY_READINESS_REVIEW.md](./SPECIAL_SHOPIFY_READINESS_REVIEW.md).
- **Shopify**: [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements), [App Store review](https://shopify.dev/docs/apps/launch/app-store-review/review-process), [Submit for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review).

---

*Report generated for Recete Retention Agent. Update this document when completing action items or after submission/review.*
