# Shopify Submission Readiness

**App**: Recete  
**Date**: March 14, 2026  
**Purpose**: Submission-focused readiness check for Shopify App Store review, based on the current codebase and current Shopify review expectations.

---

## Executive Summary

| Area | Status | Notes |
|---|---|---|
| Embedded app architecture | `Verify` | Shopify shell exists and embedded auth is in place, but reviewer flow must stay inside the shell. |
| OAuth and session tokens | `Pass` | Official Shopify shell, App Bridge flow, session-token forwarding, and install sync are implemented. |
| Billing compliance | `Pass` for implementation, `Verify` for submission copy | Shopify-managed billing exists, live tier pricing is implemented, and usage billing now meters from real AI chat events. Listing/reviewer notes must still match actual base plans, add-ons, and usage charges. |
| GDPR compliance webhooks | `Pass` | Compliance topics, forwarding, HMAC validation, job persistence, and processors exist. |
| Protected customer data readiness | `Verify` | App uses `read_customers` and exposes customer personal data; Partner Dashboard approval must be confirmed. |
| Public-facing app surface | `Pass` | Shopify shell root now presents a Shopify-specific entry page and separates standalone Recete customers onto `recete.co.uk`. |
| Listing/media/reviewer package | `Missing` | Needs final reviewer instructions, media assets, and test-store package confirmation. |

**Current recommendation**: Do **not** submit until protected customer data approval is confirmed, billing disclosure is aligned, and the reviewer path is documented end-to-end inside the Shopify shell.

---

## Scope

This document is based on:

- Shopify app configuration in `packages/shopify-app`
- Shopify-related API and webhook handling in `packages/api`
- embedded and legacy dashboard surfaces in `packages/web`
- existing internal Shopify review docs under `docs/shopify-app-store`
- current Shopify developer guidance for app review, protected customer data, GDPR webhooks, and App Store requirements

This is a submission-readiness document, not a generic Shopify checklist.

---

## Findings

### 1. Public app root now presents a Shopify-specific entry

**Status**: `Pass`  
**Severity**: Closed

**Evidence**

- `packages/shopify-app/shopify.app.toml`
  - `application_url = "https://shop.recete.co.uk/"`
- `packages/shopify-app/app/routes/_index/route.tsx`
  - Shopify-specific `Recete for Shopify` landing copy
  - explicit Shopify-store connection flow
  - explicit separation for standalone non-Shopify customers via `https://recete.co.uk`

**What changed**

- Removed all scaffold and placeholder content from the Shopify shell root.
- Clarified the two-customer split:
  - `shop.recete.co.uk` is the Shopify shell
  - `recete.co.uk` is the standalone product for non-Shopify customers

**Why this is now acceptable**

- A Shopify reviewer landing on the root can immediately understand the audience and path.
- The page no longer looks like scaffold output.
- The Shopify surface is no longer mixed with the standalone product story.

---

### 2. Protected customer data approval must be confirmed

**Status**: `Verify`  
**Severity**: High

**Evidence**

- `packages/shopify-app/shopify.app.toml`
  - scopes include `read_customers`
- Customer data is used and surfaced in:
  - `packages/api/src/routes/customers.ts`
  - `packages/api/src/routes/shopify.ts`
  - `packages/web/app/[locale]/dashboard/customers/[id]/page.tsx`

**Observed data types**

- customer name
- customer phone
- customer email
- order-linked customer context

**Why this matters**

- Shopify requires explicit approval for protected customer data access.
- Even if code is correct, review can be blocked if the Partner Dashboard approval is missing or mismatched to the real use case.

**Required action**

- Confirm that protected customer data access is approved in Shopify Partner Dashboard.
- Confirm that the approved justification matches the real product behavior:
  - post-purchase customer support
  - customer communication workflows
  - analytics and retention context
  - GDPR export and deletion handling

---

### 3. Billing implementation is now aligned, but disclosure must match actual behavior

**Status**: `Pass` for implementation, `Verify` for submission copy  
**Severity**: Medium

**Evidence**

- Shopify shell billing source of truth:
  - `packages/shopify-app/app/shopify.server.ts`
  - `packages/shopify-app/app/services/billingUsage.server.ts`
- Shell billing UI:
  - `packages/shopify-app/app/routes/app.billing.tsx`
- Runtime chat metering path:
  - `packages/api/src/lib/whatsappOutbox.ts`
  - `packages/shopify-app/app/routes/internal.billing.usage.tsx`
- Platform billing compatibility layer:
  - `packages/api/src/lib/shopifyBilling.ts`
  - `packages/api/src/routes/billing.ts`

**Observed billing behavior**

- fixed base subscription plans
- monthly and yearly options
- Starter: `$29 / month` or `$290 / year`
- Growth: `$69 / month` or `$690 / year`
- Pro: `$199 / month` or `$1990 / year`
- included monthly AI chat allowances
- usage overages billed after included chat limits
- add-on billing
- usage-based line items / capped usage in Shopify billing

**Observed usage-billing behavior**

- usage billing is now tied to real outbound AI chat events
- usage is no longer metered from `orders/fulfilled`
- Shopify usage records are created through the shell using offline session access
- capped usage is configured to protect platform cost exposure

**Why this matters**

- Reviewers compare in-app billing behavior with listing and review notes.
- If the listing describes only fixed subscriptions while the app can also create usage charges or add-on charges, that creates avoidable policy friction.

**Required action**

- Align App Store pricing text with the real implementation.
- Explicitly disclose:
  - Starter monthly/yearly pricing
  - Growth monthly/yearly pricing
  - Pro monthly/yearly pricing
  - included monthly AI chat limits
  - overage pricing for chats beyond the included monthly limit
  - add-on charges, if enabled during review
  - usage-based charges or capped usage terms, if applicable

**Submission note recommendation**

- If add-ons or usage charges are not intended for review, disable them or explain clearly in reviewer notes.

---

### 4. Reviewer flow must stay inside the embedded Shopify shell

**Status**: `Verify`  
**Severity**: Medium

**Evidence**

- Shopify shell exists:
  - `packages/shopify-app/app/shopify.server.ts`
  - `packages/shopify-app/app/platform.server.ts`
- Legacy non-shell surfaces still exist:
  - `packages/web/...`
- Migration note:
  - `packages/shopify-app/README.md`

**Why this matters**

- Shopify review favors a clean embedded merchant experience.
- If the reviewer is pushed into older standalone routes or mixed auth flows, the app can look incomplete even when features work.

**Required action**

- Prepare reviewer steps that keep the reviewer entirely in the embedded shell on `shop.recete.co.uk`.
- Explicitly state that `recete.co.uk` is the standalone non-Shopify product surface and is not the primary Shopify review path.
- Confirm billing, settings, integrations, and core flows are reachable from the shell.
- Avoid any unnecessary jump to the standalone dashboard during review.

---

### 5. GDPR implementation looks structurally correct, but runtime must be verified

**Status**: `Pass` for implementation, `Verify` for runtime  
**Severity**: Medium

**Evidence**

- Compliance webhook declaration:
  - `packages/shopify-app/shopify.app.toml`
- Compliance forwarding:
  - `packages/shopify-app/app/routes/webhooks.compliance.tsx`
- HMAC validation:
  - `packages/api/src/middleware/shopifyGdprHmac.ts`
- GDPR route handling:
  - `packages/api/src/routes/shopifyGdpr.ts`
- GDPR processing:
  - `packages/api/src/lib/shopifyGdprJobs.ts`
- Background worker execution:
  - `packages/workers/src/workers.ts`

**Why this matters**

- Shopify requires compliance webhooks to function in practice, not only exist in config.
- Current design returns `200 OK` quickly and processes jobs asynchronously. That is fine only if the workers are actually running.

**Required action**

- Verify the review environment has workers active.
- Run and document end-to-end tests for:
  - `customers/data_request`
  - `customers/redact`
  - `shop/redact`

---

### 6. OAuth, embedded auth, and install sync look good

**Status**: `Pass`

**Evidence**

- `packages/shopify-app/app/shopify.server.ts`
- `packages/shopify-app/app/platform.server.ts`
- `packages/web/lib/shopifyEmbedded.ts`
- `packages/web/hooks/useDashboardAuth.ts`
- `packages/api/src/routes/shopify.ts`

**Observed**

- official Shopify shell setup
- embedded app configuration
- session-token handling
- platform forwarding with bearer token propagation
- shop install sync after auth

**Note**

- This area looks materially ready, assuming production env vars and Partner Dashboard config match the deployed values.

---

### 7. Admin API direction looks acceptable for current review expectations

**Status**: `Pass`

**Evidence**

- `packages/api/src/lib/shopifyBilling.ts`
- `packages/api/src/lib/shopify.ts`

**Observed**

- key billing flows use GraphQL Admin API
- product fetching uses GraphQL Admin API `2026-01`

**Note**

- I did not find a current blocker here for submission.
- Continue to avoid introducing new REST Admin dependencies for public-app functionality.

---

### 8. Legal pages exist and are publicly linkable

**Status**: `Pass`

**Evidence**

- `packages/web/app/[locale]/privacy-policy/page.tsx`
- `packages/web/app/[locale]/terms-of-service/page.tsx`
- `packages/web/app/[locale]/cookie-policy/page.tsx`
- `packages/web/app/[locale]/data-processing-addendum/page.tsx`
- `packages/web/app/[locale]/security/page.tsx`
- `packages/web/components/landing-page/Footer.tsx`

**Note**

- Legal page presence is good.
- Submission still requires confirming that listing URLs point to the live production pages and that content matches actual data handling.

---

## Submission Gate

### Must resolve before submission

| Item | Status | Owner | Evidence / Notes |
|---|---|---|---|
| Replace Shopify root placeholder page | `Done` | Product / Frontend | Shopify shell root now uses Shopify-specific copy and points standalone customers to `recete.co.uk`. |
| Confirm protected customer data approval | `Open` | Shopify Partner admin | Must be checked in Partner Dashboard, not just code. |
| Align billing disclosure with actual charges | `Open` | Product / Billing | Starter, Growth, Pro, included chats, overage terms, add-ons, and capped usage language must match listing and review notes. |
| Lock reviewer path to embedded shell | `Open` | Product / QA | Review steps should not depend on legacy standalone surfaces. |
| Verify GDPR workers in review environment | `Open` | DevOps / Backend | Async compliance handling must actually run. |

### Strongly recommended before submission

| Item | Status | Owner | Notes |
|---|---|---|---|
| Full dev-store install test | `Open` | QA | Test install, auth, billing, products, settings, webhook behavior, uninstall. |
| Screenshots and video package | `Open` | Product / Design | Required for a polished submission package. |
| Review credentials package | `Open` | Product / QA | Test store, staff account, test path, review notes. |
| Support and escalation contact confirmation | `Open` | Ops | Ensure listing and review contacts are current. |

---

## Reviewer Package Checklist

Use this when preparing the Partner Dashboard submission.

### Listing

- [ ] App name is final and consistent everywhere
- [ ] Tagline and description match real functionality
- [ ] Pricing section matches actual charges
- [ ] Pricing section includes Starter, Growth, and Pro
- [ ] Pricing section describes included chats and overage billing clearly
- [ ] Privacy Policy URL is live
- [ ] Terms of Service URL is live
- [ ] Support email is correct
- [ ] App icon is uploaded
- [ ] Screenshots are current
- [ ] Demo video is current

### Technical

- [ ] App installs from a dev store without manual intervention
- [ ] Embedded auth works on first open
- [ ] Core navigation works from within Shopify Admin
- [ ] Billing approval flow works in embedded context
- [ ] Webhooks are active in the review environment
- [ ] Uninstall flow works cleanly

### Compliance

- [ ] Protected customer data approval is confirmed
- [ ] GDPR compliance webhooks are configured
- [ ] GDPR workers are running
- [ ] Privacy policy accurately describes customer data processing

### Reviewer Instructions

- [ ] Provide exact install and login steps
- [ ] Provide exact test-store details
- [ ] Explain what features to test first
- [ ] State that Shopify review should remain on `shop.recete.co.uk`
- [ ] State that `recete.co.uk` is the standalone non-Shopify surface
- [ ] Explain any expected sample/demo data
- [ ] Explain any feature intentionally disabled during review

---

## Recommended Reviewer Notes Draft

Use this as a starting point in the submission form.

> Recete is an embedded Shopify app for post-purchase customer support and retention workflows.  
> Reviewers should install the app in the provided development store and remain inside the embedded Shopify app at `shop.recete.co.uk`.  
> The standalone Recete product at `recete.co.uk` is for non-Shopify customers and is not the primary Shopify review surface.  
> The app uses Shopify-managed billing approval within the embedded app.  
> Billing includes Starter, Growth, and Pro tiers with monthly and annual options, plus capped usage-based billing for outbound AI chats beyond the included monthly allowance.  
> The app requests customer and order-related data only to support merchant-requested post-purchase communication, support context, analytics, and GDPR-compliant data operations.  
> GDPR compliance webhooks are implemented for customer data requests, customer redaction, and shop redaction.  
> Any test-store credentials, sample data, or limited review-mode instructions should be listed below this note.

---

## Concrete Next Steps

1. Confirm protected customer data approval in Shopify Partner Dashboard.
2. Review App Store pricing copy against `packages/shopify-app/app/shopify.server.ts`, `packages/shopify-app/app/routes/app.billing.tsx`, and `packages/shopify-app/app/services/billingUsage.server.ts`.
3. Write final reviewer instructions around the embedded shell only, with explicit separation from `recete.co.uk`.
4. Run an end-to-end review-environment test covering install, billing, and GDPR compliance processing.

---

## Evidence Map

### Shopify shell and config

- `packages/shopify-app/shopify.app.toml`
- `packages/shopify-app/shopify.web.toml`
- `packages/shopify-app/app/shopify.server.ts`

### Embedded routes and public-facing routes

- `packages/shopify-app/app/routes/_index/route.tsx`
- `packages/shopify-app/app/routes/auth.login/route.tsx`
- `packages/shopify-app/app/routes/app.billing.tsx`
- `packages/shopify-app/app/routes/app.settings.tsx`

### Platform forwarding and embedded auth

- `packages/shopify-app/app/platform.server.ts`
- `packages/web/lib/shopifyEmbedded.ts`
- `packages/web/hooks/useDashboardAuth.ts`

### Shopify API and billing

- `packages/shopify-app/app/shopify.server.ts`
- `packages/shopify-app/app/services/billingUsage.server.ts`
- `packages/shopify-app/app/routes/internal.billing.usage.tsx`
- `packages/api/src/lib/shopify.ts`
- `packages/api/src/lib/shopifyBilling.ts`
- `packages/api/src/lib/whatsappOutbox.ts`
- `packages/api/src/routes/billing.ts`
- `packages/api/src/routes/shopify.ts`

### GDPR and compliance

- `packages/shopify-app/app/routes/webhooks.compliance.tsx`
- `packages/api/src/middleware/shopifyGdprHmac.ts`
- `packages/api/src/routes/shopifyGdpr.ts`
- `packages/api/src/lib/shopifyGdprJobs.ts`
- `packages/workers/src/workers.ts`

### Legal and public policy pages

- `packages/web/app/[locale]/privacy-policy/page.tsx`
- `packages/web/app/[locale]/terms-of-service/page.tsx`
- `packages/web/app/[locale]/cookie-policy/page.tsx`
- `packages/web/app/[locale]/data-processing-addendum/page.tsx`
- `packages/web/app/[locale]/security/page.tsx`

---

## External References

- Shopify App Store requirements  
  https://shopify.dev/docs/apps/launch/app-requirements-checklist

- Pass app review  
  https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review

- Protected customer data  
  https://shopify.dev/docs/apps/launch/protected-customer-data

- GDPR webhooks  
  https://shopify.dev/docs/apps/store/security/gdpr-webhooks

- Shopify Admin API guidance  
  https://shopify.dev/docs/api

---

## Notes

- This document is intentionally stricter than some older readiness docs in this repository.
- If this document conflicts with older checklist files, use this document as the submission source of truth for the current submission cycle.
