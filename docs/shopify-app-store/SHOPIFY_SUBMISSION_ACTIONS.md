eve # Shopify App Store — Submission Actions

Track actions required before submitting GlowGuide for App Store review. Full context: [SHOPIFY_APP_MARKET_READINESS_REPORT.md](./SHOPIFY_APP_MARKET_READINESS_REPORT.md). Final gate: [Section 4 Pre-Submit Checklist](./SHOPIFY_APP_MARKET_READINESS_REPORT.md#4-submission-checklist-pre-submit) in the report.

---

## Must complete before submission

| # | Action | Owner | Status | Notes |
|---|--------|--------|--------|-------|
| 1 | **App icon 1200×1200** | Design | ⬜ | JPEG or PNG; upload in Partner Dashboard → App setup; use same in listing. |
| 2 | **Screenshots (5+)** | Product/Marketing | ⬜ | Min 1280×720 px. Suggested: Dashboard, Integrations, Shopify map, Conversations, Settings. No pricing in images. |
| 3 | **Demo video (2–3 min)** | Product | ⬜ | Key flows: install → OAuth, connect WhatsApp, product mapping, conversation. |
| 4 | **Full test on dev store** | QA/Dev | ⬜ | Install → OAuth → product map → webhook (order fulfilled + consent) → T+0 message; billing upgrade/downgrade; no 404/500 on main paths. |
| 5 | **Test credentials for review** | Dev | ⬜ | Dev store URL, test WhatsApp (or instructions), admin access; document for review form. |

---

## Recommended (before or soon after submit)

| # | Action | Status | Notes |
|---|--------|--------|-------|
| 6 | Confirm App Bridge version | ✅ | Confirmed in readiness report: @shopify/app-bridge ^3.7.11, app-bridge-react ^4.2.8. |
| 7 | Confirm GraphQL-only for new features | ✅ | Confirmed: products via GraphQL Admin API (2024-01); see report §6. |
| 8 | Offline access token note | ⬜ | Optional: document OAuth offline access for background jobs in submission notes. |
| 9 | User/install docs | ⬜ | Short doc or in-app steps for recipe mapping and WhatsApp connection. |

---

## Quick links

- **Readiness report**: [SHOPIFY_APP_MARKET_READINESS_REPORT.md](./SHOPIFY_APP_MARKET_READINESS_REPORT.md)
- **Pre-submit checklist**: Report [Section 4](./SHOPIFY_APP_MARKET_READINESS_REPORT.md#4-submission-checklist-pre-submit)
- **Listing copy**: [APP_LISTING.md](./APP_LISTING.md)
- **Review checklist**: [REVIEW_CHECKLIST.md](./REVIEW_CHECKLIST.md)
- **Shopify**: [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) · [Submit for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)

---

*Update the Status column (⬜ → ✅) as items are completed.*
