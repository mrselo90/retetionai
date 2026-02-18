# Shopify App Store — Development Store Test Checklist

Run through this checklist on a **development store** before submitting for review. Ensures no 404/500 on main paths and core flows work.

**Prerequisites:** App running on **HTTPS**; OAuth redirect and webhook URLs in Partner Dashboard point to production (HTTPS) URL.

---

## 1. Install and OAuth

- [ ] From Partner Dashboard or App Store listing, install app on dev store
- [ ] OAuth consent screen appears; authorize required scopes
- [ ] Redirect to app UI (embedded in Shopify Admin or standalone) succeeds
- [ ] No redirect URI mismatch or 404 on callback

---

## 2. Product Mapping (Shopify Map)

- [ ] Open **Products** → **Shopify map** (or equivalent)
- [ ] Shopify products load (GraphQL)
- [ ] Select a product and add/save **usage instructions** (recipe)
- [ ] Save succeeds; no 500 or validation errors

---

## 3. Webhooks and T+0 Flow

- [ ] Create a test order in dev store (or use existing)
- [ ] Fulfill the order (mark as delivered) and ensure customer has **marketing consent** (opt-in) where applicable
- [ ] Webhook `orders/fulfilled` or `orders/updated` is received (check logs or webhook delivery in Partner Dashboard)
- [ ] T+0 welcome job is queued and runs (check workers); WhatsApp message sent if credentials configured (or test mode)

---

## 4. Billing

- [ ] Open **Settings** (or Billing) and view current plan
- [ ] Start **upgrade** (e.g. Starter/Pro); Shopify billing confirmation page appears
- [ ] Approve charge; redirect back to app; plan updates
- [ ] **Cancel** or **downgrade** (if applicable); charge cancelled and UI reflects status

---

## 5. Add-on (Return Prevention)

- [ ] In Settings, open **Modules** (or Add-ons)
- [ ] Enable **Return Prevention**; confirmation dialog appears
- [ ] Confirm → redirect to Shopify to approve **separate** RecurringApplicationCharge
- [ ] After approval, module shows Active
- [ ] Disable module; cancel add-on charge; module shows Inactive

---

## 6. Embedded Experience and Session

- [ ] Open app from Shopify Admin (embedded); App Bridge loads
- [ ] Session verification (`POST /api/integrations/shopify/verify-session`) succeeds; no auth errors
- [ ] Navigate: Dashboard, Integrations, Products, Conversations, Analytics, Settings — no 404 or 500

---

## 7. Error and Edge Cases

- [ ] No critical or minor errors in browser console on main flows
- [ ] Rate limiting: trigger limit (if easy to do); expect 429 or friendly message, not 500
- [ ] Invalid or missing data: validation errors shown, not unhandled exceptions

---

## Sign-off

- [ ] All items above checked (or explicitly skipped with reason)
- [ ] Test store URL and admin access documented for reviewers (see [REVIEW_CREDENTIALS_TEMPLATE.md](./REVIEW_CREDENTIALS_TEMPLATE.md))

**Date completed:** _______________  
**Tester:** _______________  
**Environment (URL):** _______________
