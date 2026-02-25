# RAG Testing Guide (Current Backend)

This guide covers RAG retrieval quality, RAG+AI answer quality, security smoke checks, and basic performance checks for the current backend routes.

## 1) Prereqs

- API is running (`packages/api`)
- `OPENAI_API_KEY` configured (embeddings + answer generation)
- Test merchant exists with products scraped and embeddings generated
- You have one of the following auth methods:
  - Merchant Bearer token (`Authorization: Bearer <supabase_jwt>`)
  - Internal eval auth for `/api/test/rag` and `/api/test/rag/answer`:
    - `X-Internal-Secret`
    - `X-Internal-Merchant-Id`

## 2) Auth Modes for RAG Test Endpoints

### Option A (Recommended for manual UI/API checks): Bearer token

Use a merchant JWT:

```bash
export API_URL="${API_URL:-http://localhost:3001}"
export API_TOKEN="YOUR_SUPABASE_JWT"
```

### Option B (Server-side eval / scripts): Internal secret (fail-closed)

Current `authMiddleware` allows internal auth on:
- `POST /api/test/rag`
- `POST /api/test/rag/answer`

Required headers:
- `X-Internal-Secret: <INTERNAL_SERVICE_SECRET>`
- `X-Internal-Merchant-Id: <merchant_uuid>`

```bash
export API_URL="${API_URL:-http://localhost:3001}"
export INTERNAL_SECRET="YOUR_INTERNAL_SERVICE_SECRET"
export MERCHANT_ID="YOUR_MERCHANT_UUID"
```

## 3) Baseline Manual Eval (Recommended)

### A) Prepare test cases

- Fill `docs/performance/rag_eval_cases.json` with 20-40 real questions.
- Include:
  - expected product names
  - expected fact hints (usage, ingredients, warnings, etc.)

### B) Generate raw outputs (script)

Current `scripts/rag_eval_runner.mjs` uses Bearer auth (`API_TOKEN`) and calls:
- `POST /api/test/rag`
- `POST /api/test/rag/answer`

```bash
API_URL=http://localhost:3001 \
API_TOKEN=YOUR_SUPABASE_JWT \
TOP_K=5 \
node scripts/rag_eval_runner.mjs
```

Output:
- `docs/performance/rag_eval_results.json`

### C) Manual scoring

For each case in `docs/performance/rag_eval_results.json`, fill:
- `manual.has_correct_product` (`true` / `false`)
- `manual.relevant_chunks_count` (`0..topK`)
- `manual.helpfulness` (`1-5`)
- `manual.faithfulness` (`yes` / `no`)
- `manual.notes`

## 4) Quick Endpoint Checks

### A) Retrieval only (`/api/test/rag`) with Bearer auth

```bash
curl -sS -X POST "$API_URL/api/test/rag" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"Bu urun nasil kullanilir?","topK":5}'
```

### B) Retrieval only (`/api/test/rag`) with internal auth

```bash
curl -sS -X POST "$API_URL/api/test/rag" \
  -H "X-Internal-Secret: $INTERNAL_SECRET" \
  -H "X-Internal-Merchant-Id: $MERCHANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"query":"How do I use this product?","topK":5}'
```

### C) RAG + AI answer (`/api/test/rag/answer`) with Bearer auth

```bash
curl -sS -X POST "$API_URL/api/test/rag/answer" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"Icindekiler neler?","topK":5}'
```

### D) Scoped query by product IDs (recommended for eval quality)

Passing too many products degrades grounding quality. Prefer product-scoped checks:

```bash
curl -sS -X POST "$API_URL/api/test/rag/answer" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"How often should I use it?","topK":5,"productIds":["<product_uuid>"]}'
```

## 5) Security / Isolation Smoke Checks (Required)

### A) Internal eval auth fail-closed

Verify these now fail:
- Missing `X-Internal-Secret` on internal eval call
- Missing `X-Internal-Merchant-Id`
- Wrong `X-Internal-Secret`

Expected:
- `403` for invalid/missing headers
- `500` if server is missing `INTERNAL_SERVICE_SECRET` configuration

### B) Tenant isolation for order-scoped RAG context

`GET /api/rag/order/:orderId/context` is now merchant-scoped. Test with:
- order owned by caller merchant -> success
- order owned by another merchant -> must not return context (expect error)

Example:

```bash
curl -sS "$API_URL/api/rag/order/<order_uuid>/context" \
  -H "Authorization: Bearer $API_TOKEN"
```

## 6) Performance Smoke Test

Use `k6` to measure latency.

There is no dedicated `docs/performance/load-test-rag.js` file in this repo currently.
Use the RAG example patterns in `docs/performance/LOAD_TESTING.md` and adapt URL + auth headers.

Suggested scenarios:
- `POST /api/test/rag` (retrieval only)
- `POST /api/test/rag/answer` (RAG+AI)
- Product-scoped vs unscoped query comparison

## 7) Local Automated Checks (Fast)

Run before manual eval:

```bash
pnpm --filter @recete/api typecheck
pnpm --filter @recete/api test -- src/lib/rag.test.ts
```

Optional (routes touched by tenant isolation changes):

```bash
pnpm --filter @recete/api test -- src/lib/messageScheduler.test.ts
```

## 8) Acceptance Targets (Initial)

- Recall@5 >= 0.75 (usage / ingredients)
- Precision@5 >= 0.50
- Helpfulness avg >= 3.8 / 5
- Faithfulness >= 95%
- Latency p95:
  - RAG <= 2s
  - RAG+AI <= 5s
