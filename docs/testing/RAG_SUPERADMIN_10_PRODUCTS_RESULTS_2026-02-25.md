# RAG Superadmin 10-Product Scenario - Run Results (2026-02-25)

## What Was Requested

Prepare a RAG test scenario that can be run from the admin/test panel using a superadmin account, scoped to 10 products for the superadmin merchant, and provide results in a markdown file.

## What Was Delivered

### 1) Scenario Document (ready for admin panel execution)

Created:
- `docs/testing/RAG_SUPERADMIN_10_PRODUCTS_SCENARIO.md`

This scenario is:
- superadmin-friendly
- product-scoped (10 products)
- compatible with current test UI (`/dashboard/test`, advanced RAG tab)
- aligned with current backend endpoints:
  - `POST /api/test/rag`
  - `POST /api/test/rag/answer`

### 2) Supporting Guide Revision

Updated:
- `docs/testing/RAG_TESTING.md`

Revisions include:
- current auth modes (Bearer + internal-secret eval flow)
- fail-closed internal auth notes
- tenant isolation smoke checks
- corrected performance-script notes

## What Was Executed (Local Validation)

These checks were run successfully to validate the updated flow and related backend changes:

### Typecheck

```bash
pnpm --filter @recete/api typecheck
```

Result: PASS

### RAG unit tests

```bash
pnpm --filter @recete/api test -- src/lib/rag.test.ts
```

Result: PASS (`6/6`)

### Message scheduler tests (affected by tenant isolation changes)

```bash
pnpm --filter @recete/api test -- src/lib/messageScheduler.test.ts
```

Result: PASS (`12/12`)

Note:
- One expected stderr log appears in the partial-failure test path (mocked DB failure), but the test suite passes.

### API build

```bash
pnpm --filter @recete/api build
```

Result: PASS

## What Could Not Be Executed in This Run (Live Data Constraints)

I attempted to fetch the real superadmin merchant and its 10 products from the production database over SSH to pre-fill the scenario with exact product IDs/names.

Blocked by:
- the production server resolving Supabase DB host to IPv6 only
- remote `psql` connection failing with `Network is unreachable` to the IPv6 address

Because of that, I prepared a **dynamic 10-product selection scenario** instead of hardcoding product IDs.

This is still suitable for your intended workflow:
- You log in as superadmin
- Open admin/test page
- Select 10 RAG-ready products in UI
- Run the predefined scenario steps

## Recommended Next Step (You run from panel)

From your superadmin account in the panel:

1. Open `Dashboard > Test`
2. Go to `Urun Chatbot Testi`
3. Filter/select 10 products with chunk counts > 0
4. Run the query matrix from:
   - `docs/testing/RAG_SUPERADMIN_10_PRODUCTS_SCENARIO.md`
5. Save outcomes (manual score sheet or screenshot/export)

## Optional Follow-up (I can implement next)

I can implement a backend/admin "predefined test suite runner" for:
- `rag_superadmin_10_products_smoke`

So you can simply choose a suite in the admin panel and click `Run`.
