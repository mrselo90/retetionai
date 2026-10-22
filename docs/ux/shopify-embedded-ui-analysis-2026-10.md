# Embedded Shopify app: new UI/UX capabilities and what to adopt (2026-10)

Scope: `packages/shopify-app` (the iframe App Home app at shop.recete.co.uk). Sources: shopify.dev App Home v1.0 reference (Polaris web components, App Bridge APIs, patterns) and "Migrate from Polaris React", fetched 2026-10-22.

## 1. Where we are

| | Today |
| --- | --- |
| UI kit | Polaris React `@shopify/polaris` 13.9.5: 31 components in 18 files. `AppProvider` + `Frame` in `app.tsx`; styles from `@shopify/polaris/build/esm/styles.css` |
| App Bridge | CDN `app-bridge.js` (latest). From `@shopify/app-bridge-react` 4.2 we use `NavMenu`, `SaveBar` (Settings, messaging wizard) and `idToken` |
| Our own wrappers | `components/shell-ui.tsx`: `ShellPage`, `SectionCard`, `MetricCard`, `ActionCard`, `EmptyCard`, `InfoListCard`; `SetupStepCard` on Home |
| Feedback | 12 `Banner tone="success"` used as save/action confirmations; no toasts |
| Loading | Route spinners and skeletons per page; nothing in the admin's loading bar |
| Lists | Products: catalog fetched with `first: 100`, filtered client side, **no pagination** (shops with >100 products cannot see the rest). Conversations: `ResourceList`, no filters or pagination |
| Title bar | Polaris `Page` `primaryAction`/`backAction` on 5 routes. Inside the iframe these render as in-page header content, not in the admin title bar |
| Admin surface | iframe only; no admin UI extensions (`extensions/` is empty) |

## 2. What Shopify offers now

**Polaris web components** (`s-*`, CDN `polaris.js`, stable 1.x) are now the documented way to build App Home. Shopify publishes a migration guide from Polaris React with a per-component mapping, and the AI Toolkit validates `s-*` code. Both kits can render in the same app during migration. React apps use them as JSX tags with no import; types come from `@shopify/polaris-types` and `@shopify/app-bridge-types`.

Key differences for us:

- `s-page` puts its heading, breadcrumb (`slot="breadcrumb-actions"`), primary action and secondary actions **in the Shopify admin title bar**. Polaris React `Page` cannot do this inside the iframe.
- There is no `s-card`: `s-section` and the compositions below replace it. `Frame`, `TopBar`, `Toast`, `Loading` and `ContextualSaveBar` are replaced by App Bridge.
- New form controls we do not have today: `s-switch`, `s-money-field`, `s-number-field`, `s-url-field`, `s-email-field`, `s-date-field`/`s-date-picker`, `s-drop-zone`, `s-color-field`, `s-choice-list`, `s-chip`, `s-menu`, `s-popover`, `s-tooltip`, `s-table` (with `listSlot` mobile layout), `s-query-container`.

**App Bridge APIs** (unversioned, already loaded through our CDN script):

| API | What it gives | Relevance |
| --- | --- | --- |
| Toast `shopify.toast.show` | Native, non-blocking confirmation (with action/undo) | High: replaces the 12 success banners |
| Loading `shopify.loading(bool)` | Admin header progress bar | High: wire to router navigation and fetchers |
| Save Bar / `data-save-bar` on a native `<form>` | Native unsaved-changes bar with navigation protection | Already used via React `SaveBar`; the `data-save-bar` form is simpler after migration |
| Intents `shopify.intents.invoke('edit:shopify/Product', { value: gid })` | Opens Shopify's own product editor and returns when saved | High: "Edit in Shopify" on product detail without leaving the app |
| Resource Picker `shopify.resourcePicker({ type: 'product', multiple })` | Native product search and selection | High: "choose products to set up", bulk actions; removes the 100-product ceiling for selection |
| Reviews `shopify.reviews.request()` | App Store review modal, rate-limited by Shopify | Medium: after a success moment (first answered customer, setup complete) |
| Scopes `shopify.scopes.query/request/revoke` | Optional scopes at runtime | Low today (read-only scopes); useful if we add write features |
| Web Vitals | Report LCP/CLS/INP from the admin | Medium: Built for Shopify performance criteria |
| Navigation `s-app-nav` | Replaces `NavMenu` | Part of migration |
| Picker, Scanner, Print, Share, POS, Support | App-specific pickers, barcode scan on mobile, etc. | Low for Recete |

**App Home patterns** (official compositions that "feel native" and map to Built for Shopify guidelines):

- **Templates:** Homepage, Index, Details, Settings.
- **Compositions:** Setup guide, Metrics card, Index table (search, filter tabs, sort, bulk actions, pagination), Resource list, Empty state, Account connection, Callout card, Media card, App card, Footer help, Interstitial nav.

**Beyond the iframe:**

- **Admin UI extensions:** for example a block on the product details or order details page. These are deployed with `shopify app deploy`.
- **App Home UI extensions** (`admin.app.home.render`): Shopify-hosted, Preact. Not for us; we have a backend and an iframe app.

## 3. Mapping to our screens

| Screen (route) | Today | Target pattern / API | Value |
| --- | --- | --- | --- |
| Home `app._index` (585) | Custom `SetupStepCard`s, `ProgressBar`, success banners | Homepage template + **Setup guide** (checklist with progress, collapsible steps) + Callout card for "Send a test message" + Footer help | Native onboarding, BFS alignment |
| Dashboard `app.dashboard` (296) / Analytics (494) / Customers (449) | Custom `MetricCard`/`SectionCard` | **Metrics card** composition, `s-grid`; page actions in the title bar | Consistent KPIs; less custom code |
| Products `app.products._index` (2795) | One very large route: list + detail + wizards, client search, first 100 only | **Index table** (search, filter tabs Needs setup / Needs AI answers / Ready, bulk "Draft with AI" / "Prepare knowledge", pagination) + Details template for one product; **Resource Picker** to add products; **Intents** "Edit in Shopify" | Biggest UX gain; fixes >100 products; splits the 2.8k-line route |
| Conversations `_index` / `$id` | `ResourceList` + metric cards | Index table with status filter (AI / Human / Resolved), Details template with title-bar back action | Scannable inbox |
| Settings `app.settings` (1336) | Polaris form + React `SaveBar`, 16 banners | Settings template, native `<form data-save-bar>`, `s-switch` for toggles, toast on save | Native save flow |
| Messaging wizard `app.setup.messaging` | `SaveBar` + `backAction` | `s-page` with breadcrumb, `data-save-bar` | Title-bar back |
| Integrations / WhatsApp card | Custom card, Polaris `Modal` | **Account connection** composition + `s-modal` | Native connect/disconnect |
| Billing | Cards + badges | Settings/Details template; keep Managed Pricing redirect | Consistency |
| App shell `app.tsx` | `AppProvider` + `Frame`, `NavMenu` | `s-app-nav`, no Frame; `shopify.loading` tied to `useNavigation()` | Removes chrome we don't need |

## 4. Recommended plan

**Phase 1: quick wins.** This runs alongside Polaris React and does not need a full migration. About 1–2 days.

1. Foundation: load `polaris.js` next to `app-bridge.js` in `root.tsx`; add `@shopify/polaris-types` ^1.1 and `@shopify/app-bridge-types` to `tsconfig` types; check CSP.
2. **Toast:** replace the success banners with `shopify.toast.show(...)`. Keep error banners where the error needs to stay on screen.
3. **Loading:** one hook in `app.tsx` that drives `shopify.loading()` from `useNavigation()` and fetcher states.
4. **Title bar:** move page heading, primary/secondary actions and back links to `s-page` slots on the 5 routes that use `primaryAction`/`backAction`.
5. **Intents:** "Edit in Shopify" on the product detail (`edit:shopify/Product`), and refresh our data when it returns `ok`.
6. **Reviews:** `shopify.reviews.request()` once after setup completes or after the first AI answer is delivered. Fire and forget; never on a click.

**Phase 2: patterns, route by route.** One PR per route, roughly 1–2 weeks in total.

7. Home → Setup guide + Homepage template.
8. Products → Index table + Details template + Resource Picker, with server-side pagination (`first`/`after` already supported by the API's `/api/integrations/shopify/products`). Split the route into list, detail and wizard modules.
9. Conversations → Index table + Details.
10. Settings and messaging wizard → Settings template, `data-save-bar`.
11. Dashboard, Analytics, Customers → Metrics card.
12. Integrations → Account connection.
13. Shell → `s-app-nav`. Remove `Frame`/`AppProvider` and then `@shopify/polaris` once no route imports it.

**Phase 3: admin surface (optional).**

14. Admin UI extension blocks: product details ("Recete answers: ready / needs setup", with a link into the app) and order details (post-purchase WhatsApp status for the order). Needs an `extensions/` app extension and `shopify app deploy` from a Partner-authenticated CLI.
15. Web Vitals reporting toward Built for Shopify.

## 5. Risks and notes

- Testing: the embedded UI can only be checked inside the Shopify admin (dev store, e.g. blackeagletest). Earlier reviews used Claude in Chrome at 100% zoom. Typing into the iframe was unreliable then.
- Web components in React 18: events are DOM events (`onClick` works; for custom events use refs/`addEventListener`). Booleans and string props follow the rules in the Polaris web components guide.
- `s-page` requires a single primary action with `variant="primary"`; there is no title metadata slot.
- Keep `polaris.js` and `@shopify/polaris-types` versions aligned. The stable channel `polaris-1.js` is recommended.
- The CI `shopify-app` lint job already fails on 14 existing errors. Fixing those during Phase 2 would make the job meaningful again.
