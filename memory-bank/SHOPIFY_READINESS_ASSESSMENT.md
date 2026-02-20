# Shopify App Store Readiness Assessment

**App**: Recete Retention Agent  
**Last Updated**: February 19, 2026 (Full BFS cross-check)  
**Verdict**: **NOT YET READY — 6 technical gaps identified.**  
**Source**: [Built for Shopify achievement criteria](https://shopify.dev/docs/apps/launch/built-for-shopify/achievement-criteria)

---

## Open Gaps (in execution order)

| Gap | BFS Req | Description | Effort |
|-----|---------|-------------|--------|
| G6 | 5.1–5.4 | **Partner Dashboard listing** — upload icon, write description/tagline, configure pricing plans | 1 day |

**Total**: 1 working day to submit-ready  
**Full plan**: `brain/implementation_plan.md`

---

## Excluded from this plan (by user decision)

- Screenshots (no SSL/domain yet)
- SSL + custom domain (user will handle separately)
- Dev store install (user will set up separately)
- Merchant traction: 50 installs + 5 reviews (post-launch)

---

## What's Already Ready

| Area | Status | Notes |
|------|--------|-------|
| Shopify OAuth + HMAC | ✅ | `routes/shopify.ts`: oauth/start, callback, HMAC verified |
| Token Exchange (provisioning) | ✅ | `verify-session` creates merchant + integration from session token |
| Webhooks | ✅ | `routes/webhooks.ts`: HMAC, normalizeShopifyEvent → processNormalizedEvent |
| GDPR consent gate | ✅ | T+0/T+3/T+14 messages only sent on `opt_in` |
| No Asset API | ✅ | Zero theme file modifications |
| No storefront impact | ✅ | No ScriptTag or theme injection |
| `shopify.app.toml` | ✅ | Managed installation, `embedded = true` |
| App Bridge CDN | ✅ | `app-bridge.js` loaded via `ShopifyProvider` with `beforeInteractive` |
| PolarisProvider | ✅ | `@shopify/polaris` AppProvider wrapping all pages |
| Dashboard light theme | ✅ | `bg-card / bg-surface` not dark — passes BFS 4.1.1 backgroundrule |
| Back buttons | ✅ | conversations/[id], products/[id], customers/[id] |
| Mobile responsive | ✅ | Stacking layouts, mobile menu |
| English + Turkish localization | ✅ | Full `next-intl` — all pages |
| ROI dashboard on homepage | ✅ | Metrics, KPI cards, analytics on `/dashboard` |
| Billing (Shopify Billing API) | ✅ | Subscription + add-ons implemented |
| Multi-tenant data isolation | ✅ | RLS, merchant-scoped queries |
| Feature bullet: no false claims | ✅ | Copy says "reduce returns", not "guarantee 18% uplift" |
| No auto-popups on load | ✅ | No modals/popovers appear automatically |
| G1: Seamless onboarding | ✅ | `verify-session` provisions and returns auth token |
| G2: `s-app-nav` navigation | ✅ | Side-nav hides and registers native app nav when embedded |
| G3: Contextual Save Bar | ✅ | `s-save-bar` implemented on settings forms |
| G4: Error UX | ✅ | Form errors display inline via `InlineError` component |
| G5: Plan-gated features | ✅ | UI greyed out and labeled for un-subscribed plans |

---

## Environment Checklist

| Item | Status |
|------|--------|
| `SHOPIFY_API_KEY` + `SHOPIFY_API_SECRET` | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` (for admin token gen) | ⚠️ Confirm set on server |
| Supabase anon key + URL | ✅ Set |
| Redis, OpenAI, WhatsApp/Twilio | ✅ Set |
| Migrations 000–011 applied | ✅ Done |
| Webhooks in `shopify.app.toml` | ✅ Done |
| Custom domain | ❌ Excluded by user |
| SSL/HTTPS | ❌ Excluded by user |
| Partner Dashboard app listing | ❌ Gap G6 |

---

*Last assessed: February 19, 2026 — based on official BFS achievement criteria.*
