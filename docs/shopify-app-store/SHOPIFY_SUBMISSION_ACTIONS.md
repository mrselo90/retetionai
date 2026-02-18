eve # Shopify App Store — Submission Actions

Track actions required before submitting GlowGuide for App Store review. Full context: [SHOPIFY_APP_MARKET_READINESS_REPORT.md](./SHOPIFY_APP_MARKET_READINESS_REPORT.md). Final gate: [Section 4 Pre-Submit Checklist](./SHOPIFY_APP_MARKET_READINESS_REPORT.md#4-submission-checklist-pre-submit) in the report.

---

## Must complete before submission

| # | Action | Owner | Status | Notes |
|---|--------|--------|--------|-------|
| 0 | **HTTPS in production** | Dev/Ops | ⬜ | App URL and OAuth/webhook URLs must use valid TLS. See [SSL_TLS.md](../deployment/SSL_TLS.md). |
| 1 | **App icon 1200×1200** | Design | ⬜ | JPEG or PNG; upload in Partner Dashboard → App setup; use same in listing. See [MEDIA_ASSETS_CHECKLIST.md](./MEDIA_ASSETS_CHECKLIST.md). |
| 2 | **Screenshots (5+)** | Product/Marketing | ⬜ | Min 1280×720 px. Suggested: Dashboard, Integrations, Shopify map, Conversations, Settings. No pricing in images. See [MEDIA_ASSETS_CHECKLIST.md](./MEDIA_ASSETS_CHECKLIST.md). |
| 3 | **Demo video (2–3 min)** | Product | ⬜ | Key flows: install → OAuth, connect WhatsApp, product mapping, conversation. See [MEDIA_ASSETS_CHECKLIST.md](./MEDIA_ASSETS_CHECKLIST.md). |
| 4 | **Full test on dev store** | QA/Dev | ⬜ | Use [DEV_STORE_TEST_CHECKLIST.md](./DEV_STORE_TEST_CHECKLIST.md). |
| 5 | **Test credentials for review** | Dev | ⬜ | Use [REVIEW_CREDENTIALS_TEMPLATE.md](./REVIEW_CREDENTIALS_TEMPLATE.md); document for review form. |

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
- **Media assets (icon, screenshots, video)**: [MEDIA_ASSETS_CHECKLIST.md](./MEDIA_ASSETS_CHECKLIST.md)
- **Dev store test steps**: [DEV_STORE_TEST_CHECKLIST.md](./DEV_STORE_TEST_CHECKLIST.md)
- **Review credentials template**: [REVIEW_CREDENTIALS_TEMPLATE.md](./REVIEW_CREDENTIALS_TEMPLATE.md)
- **HTTPS setup**: [SSL_TLS.md](../deployment/SSL_TLS.md)
- **Shopify**: [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) · [Submit for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)

---

*Update the Status column (⬜ → ✅) as items are completed.*
