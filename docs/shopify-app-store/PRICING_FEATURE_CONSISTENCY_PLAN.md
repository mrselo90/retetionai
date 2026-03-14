# Pricing Feature Consistency Plan

Date: 2026-03-14
Owner: Recete engineering
Scope: Shopify shell + standalone platform

## Goal

Make the live feature behavior match the published Starter / Growth / Pro plan promises and the Shopify billing implementation.

## Findings To Fix

1. Usage overages are billed from `orders/fulfilled` instead of real billable chat sends.
2. Advanced analytics is shown as Pro-only in pricing, but access is not enforced at route level.
3. AI Vision is defined in plan metadata, but the runtime does not enforce or track it consistently.
4. Custom branded WhatsApp is defined as Pro-only, but sender-mode behavior is not enforced server-side.
5. Upsell strategy is defined by plan, but runtime flows do not consistently use the plan capability.
6. Recipe limits are enforced in Shopify mapping only; standalone product creation still bypasses the same cap.

## Execution Plan

### Phase 1: Billing correctness

- [x] Stop metering chat overages from `orders/fulfilled`.
- [x] Add a shell-internal usage endpoint that can increment usage and create Shopify usage records from the offline session.
- [x] Report billable AI chat sends from the real outbound WhatsApp path.
- [x] Add idempotency for usage events so retries do not double-charge.

### Phase 2: Plan enforcement

- [x] Add reusable plan capability checks for analytics, AI vision, WhatsApp mode, and upsell behavior.
- [x] Enforce advanced analytics at route level in the Shopify shell.
- [x] Enforce WhatsApp sender mode server-side.
- [x] Enforce upsell strategy from plan capability, not UI copy only.
- [ ] Complete true AI image-analysis execution for Growth/Pro. Current runtime now distinguishes plan access, but image analysis itself is still not implemented in the inbound processor.

### Phase 3: Product limits

- [x] Enforce recipe/product limits in standalone product creation routes.
- [x] Keep Shopify mapping and standalone product creation on the same limit rules.

### Phase 4: Verification

- [ ] Run Prisma validation/generation.
- [ ] Run typecheck/build for Shopify shell.
- [ ] Run typecheck/build or targeted verification for platform API if affected.
- [ ] Document any remaining runtime gaps that require product or infrastructure decisions.

## Status

- Completed: Phase 1
- Completed with one remaining runtime gap: Phase 2
- Completed: Phase 3
- Verified locally: Prisma generate/validate, API build, Shopify shell typecheck/build
