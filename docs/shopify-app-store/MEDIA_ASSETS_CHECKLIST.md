# Shopify App Store — Media Assets Checklist

Required media for App Store listing. Use this before submission.

**Reference:** [Shopify App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements), [App icon size (1200×1200)](https://shopify.dev/changelog/changes-to-the-required-app-icon-size-in-the-partner-dashboard).

---

## 1. App Icon

| Requirement | Spec |
|-------------|------|
| **Dimensions** | **1200×1200 px** (required; do not use 512×512) |
| **Format** | JPEG or PNG |
| **Where** | Partner Dashboard → App setup → App icon; same asset in listing |

**Asset:** `logo_icons/1200x1200_icon.png` (also copied to `packages/web/public/icon.png` for app favicon).

**Checklist:**
- [x] Icon created at 1200×1200 px
- [ ] Uploaded in Partner Dashboard
- [ ] Listing uses same icon (no pricing or misleading graphics in icon)

---

## 2. Screenshots

| Requirement | Spec |
|-------------|------|
| **Count** | Minimum **5** |
| **Dimensions** | Minimum **1280×720 px** |
| **Content** | No pricing in images (pricing only in "Pricing details" in listing) |

**Suggested screens to capture:**
1. **Dashboard** — Main dashboard with KPIs / overview
2. **Integrations** — Integrations page (Shopify + WhatsApp connected)
3. **Shopify map** — Product mapping page (`/dashboard/products/shopify-map`)
4. **Conversations** — Conversations list or conversation detail
5. **Settings** — Settings page (e.g. Bot Persona or Modules section)

**Checklist:**
- [ ] At least 5 screenshots at 1280×720 or larger
- [ ] No pricing text or dollar amounts in images
- [ ] Uploaded in App Store listing

---

## 3. Demo Video

| Requirement | Spec |
|-------------|------|
| **Duration** | **2–3 minutes** |
| **Content** | Key flows so reviewers (and merchants) understand the app |

**Suggested scenes (2–3 min total):**
1. **Install & OAuth** — Click Install, authorize, land in app
2. **Connect WhatsApp** — Integrations → WhatsApp Business → add credentials (or show “connected” state)
3. **Product mapping** — Shopify map: sync products, assign recipe/usage to a product
4. **Conversation flow** — Show Conversations (and optionally a thread) or describe T+0 message
5. **Optional:** Settings (persona or Return Prevention module) or Billing (plan / add-on)

**Checklist:**
- [ ] Video recorded (2–3 min)
- [ ] Covers install, OAuth, WhatsApp, product mapping, conversation (and optionally billing)
- [ ] Uploaded in App Store listing

---

## Quick reference

- **Icon:** 1200×1200 px, JPEG/PNG
- **Screenshots:** 5+, 1280×720 px min, no pricing in images
- **Video:** 2–3 min, main flows shown

Update [SHOPIFY_SUBMISSION_ACTIONS.md](./SHOPIFY_SUBMISSION_ACTIONS.md) when each item is done.
