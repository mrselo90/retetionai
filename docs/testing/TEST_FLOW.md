# Test Flow (Pragmatic)

This project uses an API-first test flow with optional UI smoke checks.

## Why this flow

- Most product logic is in API/integration/worker layers.
- These tests are faster, more deterministic, and easier to run in CI.
- Playwright is kept for critical browser-path smoke coverage only.

## Commands

1. Core flow (recommended on every PR)

```bash
pnpm test:flow
```

Runs:
- typecheck (monorepo)
- unit tests
- API integration tests

2. Full flow with UI smoke (before release / major UI changes)

```bash
pnpm test:flow:full
```

Runs:
- everything in `test:flow`
- Playwright smoke (Chromium only):
  - `packages/web/e2e/auth.spec.ts`
  - `packages/web/e2e/dashboard.spec.ts`

3. Shopify super-admin conversation suite (manual high-signal check)

- Open `/admin/testing`
- Select merchant + products + scenarios
- Run Shopify suite and review assertion pass/fail output

## Coverage References

- Full system matrix: `docs/testing/FULL_APPLICATION_TEST_SCENARIOS.md`
- Shopify scenario suite: `docs/testing/SHOPIFY_SUPERADMIN_SCENARIOS.md`
- API route scenario matrix: `docs/testing/API_TEST_SCENARIOS.md`
