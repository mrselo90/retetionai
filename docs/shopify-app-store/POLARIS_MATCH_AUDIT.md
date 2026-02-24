# Polaris alignment audit — match percentage

**Date:** February 2025  
**Scope:** `packages/web` (Next.js app) vs Shopify Polaris design system and embedded app expectations.

---

## Overall Polaris match: **~87%**

---

## 1. Foundation (95%)

| Item | Status | Notes |
|------|--------|--------|
| AppProvider | ✅ | `ShopifyProvider` wraps app with `AppProvider` from `@shopify/polaris` |
| Polaris CSS | ✅ | `@shopify/polaris/build/esm/styles.css` imported in `ShopifyProvider` |
| Design tokens | ✅ | `globals.css`: `--polaris-heading-*`, `--polaris-body-*`, `--polaris-space-4/5/6/8` |
| Body / base typography | ✅ | Body uses `--polaris-body-md`; h1–h6 use Polaris heading scale |

**Gap:** Theme overrides (`.shopify-dashboard-theme`) apply brand colors and flatten gradients; app does not use default Polaris theme everywhere.

---

## 2. Polaris components usage (88%)

| Area | Status | Notes |
|------|--------|--------|
| Page | ✅ | All dashboard pages use Polaris `<Page title={} subtitle={} fullWidth>` |
| Layout | ✅ | Polaris `<Layout>`, `<Layout.Section>` used for content structure |
| Card | ✅ | Polaris `<Card>` (as PolarisCard) used on dashboard home, products, conversations, customers, analytics, settings, integrations, shopify-map |
| Button | ✅ | Polaris `<Button>` used for primary/secondary actions, navigation |
| Badge | ✅ | Polaris `<Badge tone={}>` for status, counts, segments |
| Banner | ✅ | Polaris `<Banner>` for alerts and notices |
| Text | ✅ | Polaris `<Text>` for body and labels |
| SkeletonPage | ✅ | Loading states use `<SkeletonPage>` |
| TextField | ✅ | Used in settings/bot-info and forms where needed |

**Gaps:**
- **Modals:** Integrations, Settings, Products use custom **Radix Dialog** (`@/components/ui/dialog`) instead of Polaris `Modal`.
- **Empty states:** Products page uses custom `EmptyState` (Polaris-aligned tokens); dashboard home uses Polaris Card + custom `ListEmpty` or inline content. Polaris has `<EmptyState>`.
- **Input/Label:** Some forms use custom `Input` and `Label` (Polaris token-aligned) alongside Polaris `TextField` where applicable.

---

## 3. Embedded app & App Bridge (88%)

| Item | Status | Notes |
|------|--------|--------|
| App Bridge script | ✅ | Loaded in `ShopifyProvider` when `NEXT_PUBLIC_SHOPIFY_API_KEY` is set |
| Session token / verify | ✅ | `getShopifySessionToken`, `/api/integrations/shopify/verify-session` |
| Embedded nav | ✅ | When embedded, `DashboardLayout` renders `<s-app-nav>` + `<s-app-nav-item>` (App Bridge web components) |
| Standalone layout | ⚠️ | Custom sidebar (not Polaris `Frame`/`Navigation`); correct for non-embedded usage |

**Gap:** In standalone mode the app uses a custom sidebar; Polaris would use `Frame` + `Navigation`. For embedded mode, using `s-app-nav` is correct.

---

## 4. Layout & Admin UX (78%)

| Item | Status | Notes |
|------|--------|--------|
| Page title / subtitle | ✅ | Polaris `Page` with title and subtitle on all dashboard pages |
| Content padding | ✅ | `p-4 sm:p-6 lg:p-8`, `max-w-6xl` (documented in POLARIS_ALIGNMENT.md) |
| Loading skeletons | ✅ | SkeletonPage and skeleton content where used |
| Custom sidebar (standalone) | ⚠️ | Custom `DashboardLayout` with own nav; not Polaris Frame |

**Gap:** Main chrome is custom when not embedded; only the inner content (Page, Layout, Card, etc.) follows Polaris patterns.

---

## 5. Typography & spacing (92%)

| Item | Status | Notes |
|------|--------|--------|
| Heading scale | ✅ | globals.css + `.page-title` use Polaris heading sizes |
| Body text | ✅ | `--polaris-body-md` / `--polaris-body-sm`; `.page-description`, form helpers |
| Spacing variables | ✅ | `--polaris-space-4/5/6/8` defined; cards use `p-5`, layout uses Tailwind spacing |
| Custom components | ✅ | Button, Card, Input, Label, EmptyState use `var(--polaris-heading-*)` / `var(--polaris-body-md)` where relevant |

**Gap:** Minor mix of Polaris component defaults and custom token usage; no major inconsistency.

---

## 6. Landing vs app separation (100%)

- **Landing** (`/[locale]`): Custom branded UI (Recete green/cream); no Polaris. Correct for marketing.
- **Dashboard** (`/[locale]/dashboard/*`): Polaris-backed (Page, Layout, Card, Button, etc.). Correct.

---

## Summary by category

| Category | Score | Main gap |
|----------|--------|----------|
| Foundation | 95% | Theme overrides (brand) |
| Components | 88% | Custom Dialog instead of Polaris Modal; some custom EmptyState |
| App Bridge / embedded | 88% | Custom standalone nav (Polaris Frame not used) |
| Layout / Admin UX | 78% | Custom sidebar in standalone mode |
| Typography & spacing | 92% | Small mix of custom + Polaris |
| Landing vs app | 100% | — |

**Weighted overall:** Emphasizing foundation and in-app components: **~87%** Polaris match.

---

## Recommendations to move toward 95%+

1. **Modals:** Use Polaris `Modal` (and `Modal.Section`) for Integrations, Settings, and Products flows where a modal is required; keep custom Dialog only where Polaris Modal is insufficient.
2. **Empty states:** Prefer Polaris `<EmptyState>` on dashboard/list views where possible; keep custom `EmptyState` only if you need behavior Polaris doesn’t cover.
3. **Standalone nav:** Optional: use Polaris `Frame` + `Navigation` when not embedded so the shell matches Polaris layout; current custom sidebar is acceptable if you prefer brand consistency.
4. **Theme:** Optional: reduce `.shopify-dashboard-theme` overrides to a minimal set so more of the default Polaris look remains, or document that the app intentionally uses a “Polaris-aligned, brand-themed” variant.

---

## References

- [Polaris design system](https://polaris.shopify.com/)
- [Polaris typography](https://polaris.shopify.com/design/typography)
- Project: `docs/shopify-app-store/POLARIS_ALIGNMENT.md`
- Project: `frontend_skills.md` (Polaris STRICT adherence)
