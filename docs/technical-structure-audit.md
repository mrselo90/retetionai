# Technical structure audit — Retention Agent / Recete

**Scope:** Monorepo (`api`, `web`, `shopify-app`, `workers`, `shared`), Supabase migrations, CI/CD, and cross-cutting concerns.

**Note:** Findings are based on codebase review at audit time. Verify before treating as current state.

---

## Executive summary

The stack is modern (Hono, Next.js, React Router + Shopify, BullMQ, Supabase) with solid patterns in webhooks, logging, and TypeScript strictness. The main weak areas are **database RLS consistency**, **timeouts on outbound HTTP**, **rate limiting vs auth ordering**, **signup scalability**, **worker DLQ semantics**, and **client-only protection** on the standalone web app.

---

## Critical

### 1. GDPR tables without Row Level Security

**Location:** `supabase/migrations/028_gdpr_exports.sql`, `029_gdpr_jobs.sql`

These tables store GDPR export payloads but have no `ENABLE ROW LEVEL SECURITY` or policies. If PostgREST/anon key is ever exposed, GDPR-related data could be queried directly.

### 2. Tables with RLS enabled but zero (or commented-out) policies

**Location:** `supabase/migrations/004_subscription_system.sql`, `009_enrichment_features.sql`, `026_whatsapp_inbox_outbox.sql`

Examples: `usage_tracking`, `subscription_plans`, `merchant_members`, `whatsapp_inbound_events`, `whatsapp_outbound_events` — RLS on with policies missing or commented. Result is deny-by-default for non–service-role clients (may be intentional but is undocumented and easy to misconfigure).

### 3. Tables with no RLS

**Location:** `supabase/migrations/017_product_facts.sql`, `035_delivery_template_events.sql`

`product_facts`, `product_fact_evidence`, `delivery_template_events` — security relies entirely on API-layer auth.

### 4. Migration ordering / duplication (`000` vs `001` / `002`)

**Location:** `supabase/migrations/`

`000_complete_setup.sql` uses `CREATE TABLE IF NOT EXISTS`; `001_initial_schema.sql` uses unconditional `CREATE TABLE` — sequential apply can fail. `000` and `002` can define duplicate RLS policy names.

---

## High

### 5. Rate limiter runs before auth

**Location:** `packages/api/src/index.ts`, `packages/api/src/middleware/rateLimit.ts`

Global `rateLimitMiddleware` runs before route `authMiddleware`. `merchantId` in context is often unset, so limiting falls back to per-IP; merchant-scoped buckets may be ineffective.

### 6. Signup uses unbounded `listUsers()`

**Location:** `packages/api/src/routes/auth.ts`

`serviceClient.auth.admin.listUsers()` without pagination to detect duplicate emails — scalability and abuse concerns.

### 7. No fetch timeouts (workers → API / WhatsApp)

**Location:** `packages/workers/src/workers.ts`, `packages/workers/src/lib/whatsapp.ts`

Many `fetch` calls lack `AbortSignal.timeout` — hung upstream calls can block workers.

### 8. No fetch timeouts (Shopify app → platform API)

**Location:** `packages/shopify-app/app/platform.server.ts`

Platform `fetch` calls have no timeout — can tie up the React Router server.

### 9. Dead-letter queue semantics and coverage

**Location:** `packages/workers/src/queues.ts`

`QueueEvents` `'failed'` may enqueue DLQ on every failure (including retries), causing duplicate DLQ entries. Intelligence queues may lack DLQ wiring entirely.

### 10. Client-only auth for dashboard/admin (web)

**Location:** `packages/web` — `DashboardLayout.tsx`, `AdminLayout.tsx`, `hooks/useDashboardAuth.ts`

Auth gating in `useEffect` — unauthenticated clients can receive shell HTML/JS before redirect (API must remain authoritative).

### 11. XSS hardening: `innerHTML` with Shopify HTML

**Location:** `packages/web/app/[locale]/dashboard/products/shopify-map/page.tsx`

`stripHtmlForRag` uses `div.innerHTML` for third-party HTML — prefer `DOMParser` + `textContent` or server-side stripping.

### 12. Deploy / migrations / rollback

**Location:** `.github/workflows/deploy.yml`

Migrations may be skipped if `psql` / `DATABASE_URL` unavailable. Rollback via git does not revert DB. `prisma db push` without migration history is risky for production.

### 13. CI image build vs Dockerfile

**Location:** `.github/workflows/build-images.yml`

Workflow may reference root `./Dockerfile` while only `packages/shopify-app/Dockerfile` exists — verify before relying on image builds.

### 14. Unmounted test route with sensitive debug payload

**Location:** `packages/api/src/routes/test.ts`

If ever mounted, endpoints could leak prompts/context (verify `index.ts` does not mount for production).

---

## Medium

### 15. Encryption key fallback

**Location:** `packages/api/src/lib/encryption.ts`

Missing/invalid `ENCRYPTION_KEY` can fall back to ephemeral keys — ciphertext not recoverable after restart.

### 16. Validation middleware re-throws

**Location:** `packages/api/src/middleware/validation.ts`

Non-Zod errors re-thrown without a documented global `app.onError` — inconsistent JSON error bodies possible.

### 17. Worker conversation creation race

**Location:** `packages/workers/src/workers.ts` (`getOrCreateConversationForWorker`)

Select-then-insert under concurrency can duplicate conversations for same `(user_id, order_id)`.

### 18. Intelligence workers ignore update errors

**Location:** `packages/workers/src/intelligenceWorkers.ts`

Some Supabase `.update()` results do not check `error`.

### 19. No route-level `error.tsx` / `loading.tsx` (web)

**Location:** `packages/web/app/`

Errors and loading rely on in-component handling only.

### 20. `SECURITY DEFINER` without hardening

**Location:** `supabase/migrations/004_subscription_system.sql`

Functions like `get_merchant_usage` — consider `SET search_path`, narrow `GRANT`, revoke from `PUBLIC`.

### 21. No runtime validation of platform API JSON

**Location:** `packages/shopify-app/app/platform.server.ts`

Heavy use of `as` casts on JSON — consider Zod at boundaries.

### 22. Web app architecture: mostly client components

**Location:** `packages/web/app/`

`use client` + `useEffect` fetching — larger bundles, less RSC/streaming benefit.

### 23. Dead code: `cacheMiddleware`

**Location:** `packages/api/src/index.ts`

Imported but not attached with `app.use()`.

### 24. Sensitive literals in migrations

**Location:** e.g. `supabase/migrations/034_platform_ai_settings_corporate_whatsapp.sql`

Operational phone numbers in SQL history — prefer env-driven or seed scripts.

### 25. RLS model vs `merchant_members`

**Location:** `supabase/migrations/002_rls_policies.sql` vs `009_enrichment_features.sql`

Policies often assume `auth.uid()` aligns with `merchants.id`; staff/multi-user models need explicit design.

### 26. `conversations.merchant_id` vs RLS

**Location:** `025_conversations_escalation.sql` vs older conversation policies

Possible inconsistency between `conversations.merchant_id` and policies keyed via `user_id` → `users.merchant_id`.

### 27. Next.js middleware / i18n (verify)

**Location:** `packages/web/proxy.ts`

Confirm Next.js actually loads this file (framework convention may require `middleware.ts` at app root depending on version).

### 28. Turkish locale vs messages

**Location:** `packages/web/i18n/request.ts`

If only `'en'` is allowed in `getRequestConfig`, `tr` routes may not load `tr.json` as expected.

### 29. CSP scope

**Location:** `packages/web/next.config.mjs`

CSP may only set `frame-ancestors` for Shopify — limited as general XSS defense.

### 30. E2E tests

**Location:** `packages/web/e2e/`, root Playwright config

Hard-coded credentials, weak assertions in places; ensure CI secrets and test isolation.

### 31. Form validation gaps (Shopify shell)

**Location:** e.g. `app.conversations.$conversationId.tsx`

Some form fields cast to union types without validating allowed values.

### 32. `id_token` in query string (platform auth bridge)

**Location:** `packages/shopify-app/app/platform.server.ts`

Convenience for document requests — be aware of referrer/log leakage; prefer header-based auth where possible.

---

## Low

### 33. Token prefix in client debug logs

**Location:** `packages/shopify-app/app/lib/sessionToken.client.ts`

### 34. Parallel `idToken()` without coalescing

**Location:** `packages/shopify-app/app/lib/sessionToken.client.ts`

### 35. Misleading `getMerchantSupabaseClient`

**Location:** `packages/shared/src/supabase.ts`

Parameter ignored; returns same client as anon path.

### 36. Husky `prepare` script

**Location:** Root `package.json`

New clones may not install hooks without documented `husky` init.

### 37. ESLint `no-explicit-any` off

**Location:** `eslint.config.js`

### 38. Wide OpenAI semver range

**Location:** `packages/api/package.json`

### 39. External `<img>` vs `next/image` + `remotePatterns`

**Location:** `packages/web` (e.g. Shopify product images)

### 40. Widespread `any` in API routes and workers

**Location:** `packages/api/src/routes/*`, `packages/workers/src/intelligenceWorkers.ts`

### 41. Request logger timing vs auth

**Location:** `packages/api/src/middleware/logger.ts`

`merchantId` may be empty on “request started” if auth runs later in the stack.

### 42. `adminAuth` uses `console.error`

**Location:** `packages/api/src/middleware/adminAuth.ts`

### 43. Deprecated `X-XSS-Protection` header

**Location:** `packages/web/next.config.mjs`

### 44. CORS in development

**Location:** `packages/api/src/index.ts`

Reflecting origin in dev — ensure `NODE_ENV` is never wrong in shared/staging.

### 45. Internal path allowlists

**Location:** `packages/api/src/middleware/auth.ts`

Large regex/string lists — maintenance and typo risk.

### 46. Polar typing escapes

**Location:** `packages/shopify-app/app/routes/*`

e.g. `icon={... as never}`

---

## Strengths (what’s working well)

| Area | Notes |
|------|--------|
| Shopify webhooks | HMAC verification via official library |
| Logging | Structured Pino usage |
| BullMQ | Retries, backoff, retention defaults |
| TypeScript | `strict: true` across packages |
| Supabase clients | Singleton, server role without session persistence |
| Redis | Retry/reconnect and shutdown alignment |
| Scraper | `AbortSignal.timeout` on page fetch |
| Auth API | JWT + Shopify session token + internal secret patterns |
| Env docs | `.env.example`, `.env.production.example` |

---

## Suggested priority fixes (top 5)

1. **RLS** — Add explicit policies (or document service-role-only) for GDPR, delivery templates, and any table exposed to PostgREST.
2. **HTTP timeouts** — `AbortSignal.timeout` on worker and shopify-app outbound `fetch`.
3. **Rate limiting** — Run merchant-aware limits after auth (or derive identity from token early).
4. **Signup** — Replace full `listUsers()` with targeted lookup (e.g. admin get user by email if available).
5. **API errors** — Global `onError` + consistent JSON shape; avoid silent catches in hot paths.

---

## Package-level index

| Package | Main weak points |
|---------|------------------|
| **api** | Rate limit order, signup `listUsers`, validation throws, `any`, test route risk, internal allowlists |
| **web** | Client-only auth, RSC underuse, no `error.tsx`/`loading.tsx`, `innerHTML`, i18n/middleware naming |
| **shopify-app** | No platform fetch timeouts, cast-heavy JSON, webhook ordering/idempotency edge cases, token in query |
| **workers** | No timeouts, DLQ semantics, race on conversation create, ignored DB errors, `any` |
| **shared** | Misleading merchant client helper, log context `any` |
| **supabase** | Migration conflicts, RLS gaps, DEFINER hardening, literals in SQL |
| **CI/CD** | Dockerfile path, conditional migrations, `pnpm install` without frozen lockfile |

---

*Generated as a consolidated technical audit. Update this document after major refactors.*
