# RAG Testing Run Results (2026-02-25)

## Scope

This run validates the updated RAG testing workflow documentation against the current backend code and executes the fast automated checks that are available locally.

Updated guide:
- `docs/testing/RAG_TESTING.md`

## What Was Revised in the Guide

- Added current auth modes for RAG test endpoints:
  - Bearer JWT (`Authorization`)
  - Internal eval auth (`X-Internal-Secret` + `X-Internal-Merchant-Id`)
- Documented fail-closed internal auth behavior for `/api/test/rag` and `/api/test/rag/answer`
- Added tenant-isolation smoke check for `GET /api/rag/order/:orderId/context`
- Corrected performance section (no `docs/performance/load-test-rag.js` file exists)
- Added local automated checks section (`typecheck`, `rag.test.ts`, `messageScheduler.test.ts`)

## Commands Executed

### 1) Typecheck

```bash
pnpm --filter @recete/api typecheck
```

Result:
- Exit code: `0`
- Status: PASS

### 2) RAG Unit Tests

```bash
pnpm --filter @recete/api test -- src/lib/rag.test.ts
```

Result:
- Exit code: `0`
- Status: PASS

Observed output (summary):
- `src/lib/rag.test.ts` passed
- `6/6` tests passed

### 3) Message Scheduler Tests (related to tenant isolation changes)

```bash
pnpm --filter @recete/api test -- src/lib/messageScheduler.test.ts
```

Result:
- Exit code: `0`
- Status: PASS

Observed output (summary):
- `src/lib/messageScheduler.test.ts` passed
- `12/12` tests passed
- One expected stderr log appears in the "partial failures gracefully" test scenario (simulated DB failure path)

### 4) API Build

```bash
pnpm --filter @recete/api build
```

Result:
- Exit code: `0`
- Status: PASS

## Not Executed (Requires Runtime Credentials / Live Data)

The following guide sections were not executed in this local run because they require a running API instance with merchant data and valid auth credentials:

- `scripts/rag_eval_runner.mjs` end-to-end eval (`API_TOKEN`, merchant data, embeddings required)
- Manual endpoint checks for `/api/test/rag` and `/api/test/rag/answer`
- Tenant-isolation smoke check on `/api/rag/order/:orderId/context` with real cross-tenant orders
- k6 performance smoke tests

## Overall Status

- Documentation updated to match current backend auth/security behavior
- Local automated checks passed (`typecheck`, RAG tests, related scheduler tests, API build)
- Manual/live RAG quality and performance eval remains pending on a provisioned test merchant
