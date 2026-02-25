# RAG Superadmin Scenario (10 Product Set)

## Goal

Run a repeatable RAG quality check from the admin/test UI using a **superadmin-authenticated merchant account** and a **10-product scoped set**.

This scenario is designed to avoid auth friction and reduce hallucination risk by testing with **product-scoped queries** instead of all products at once.

## Why This Scenario

- Superadmin user can safely access test tools without merchant-level auth confusion
- Backend auth/authorization still remains the source of truth
- Product scoping improves grounding quality and makes failures easier to debug
- Can be re-run after RAG, chunking, facts-first, or prompt changes

## Preconditions

- Login with a **superadmin** account in the web app
- Go to `Dashboard > Test` (advanced RAG tab)
- The selected merchant (superadmin account's merchant) has:
  - at least 10 products
  - chunk counts available (`chunkCount > 0`)
- API and workers are online
- `OPENAI_API_KEY` is configured (for `/api/test/rag/answer`)

## Product Selection Rules (10 Products)

In `Dashboard > Test > Urun Chatbot Testi`:

1. Enable product loading in the RAG test panel (the page already calls `/api/products` and `/api/products/chunks/batch`).
2. Filter to products with `chunkCount > 0` (RAG-ready products only).
3. Select **exactly 10** products.
4. Prefer a mixed set:
   - 3 products with detailed usage instructions
   - 3 products with strong ingredient/benefit content
   - 2 products with warning/sensitivity language
   - 2 products with clear specs (ml/size/frequency)

If there are more than 10 candidates, select:
- the first 10 RAG-ready products by UI order, or
- a representative 10-product mix (recommended)

## Test Matrix (per selected product)

Run the following query types for each product (40 total cases for 10 products):

1. Usage
- TR: `Bu urunu nasil kullanmaliyim?`
- EN fallback variant (optional): `How should I use this product?`

2. Ingredients / content
- TR: `Icindekiler neler?`

3. Frequency / routine
- TR: `Haftada kac kez kullanmaliyim?`

4. Safety / warning
- TR: `Hassas ciltte kullanilir mi?`

Optional 5th query (if product page includes specs):
- TR: `Kac ml?`

## How to Run (Admin Panel)

### A) Retrieval-only check (`/api/test/rag`)

For each selected product:
- Keep only **1 product** selected in the UI
- Run:
  - `POST /api/test/rag`
- Query examples:
  - `Bu urunu nasil kullanmaliyim?`
  - `Icindekiler neler?`

Expected:
- Returned chunks should belong to the selected product
- `count > 0` for at least usage/ingredients queries on RAG-ready products

### B) RAG + AI answer check (`/api/test/rag/answer`)

For the same product:
- Run:
  - `POST /api/test/rag/answer`
- Check:
  - answer language matches query language
  - answer references the correct product context
  - no fabricated claims
  - if context is missing, answer should say so clearly

### C) Multi-product confusion check (negative test)

Pick 3 selected products together and ask a product-specific question:
- Example: `Bu urunun kullanim sirasi nedir?`

Expected:
- Answer should stay grounded
- If ambiguity exists, it should ask a clarifying question instead of inventing

## Manual Scoring Template

Score each run with these fields:

- `case_id`
- `product_id`
- `product_name`
- `query_type` (`usage`, `ingredients`, `frequency`, `warning`, `specs`)
- `endpoint` (`/api/test/rag` or `/api/test/rag/answer`)
- `has_correct_product` (`true/false`)
- `relevant_chunks_count` (`0..topK`)
- `helpfulness` (`1-5`)
- `faithfulness` (`yes/no`)
- `language_ok` (`yes/no`)
- `notes`

## Pass / Fail Criteria (Practical)

For the 10-product set:

- Product match accuracy >= 85%
- Faithfulness >= 95%
- Average helpfulness >= 3.8/5
- Language correctness >= 95% (TR queries => TR answers)
- Retrieval non-empty rate >= 80% on usage/ingredients queries for RAG-ready products

## Fast Failure Triage

If failures occur:

1. Wrong product retrieved
- Re-run with single product selected
- Check chunk count and product content quality

2. Empty retrieval (`count = 0`)
- Verify product has chunks (`chunkCount > 0`)
- Try broader query wording
- Check scraped content quality / embeddings

3. Hallucinated answer
- Compare `/api/test/rag` chunks vs `/api/test/rag/answer`
- Check if answer should have asked clarification

4. Wrong language
- Verify query language is clear
- Re-test with simpler TR wording

## Security/Isolation Sanity Checks (Recommended during same session)

From the same superadmin session:

1. `GET /api/rag/order/:orderId/context`
- Valid own order -> should return context
- Cross-tenant order -> should fail / not return data

2. `POST /api/events/process`
- Should only work if caller is superadmin (or valid internal secret path)

3. WhatsApp webhook POST
- Invalid `X-Hub-Signature-256` should fail (`401`)

## Notes for Future Admin "Test Runner" Automation

When we implement the selectable backend test suites in admin panel, this scenario should become a predefined suite:

- `suite_id`: `rag_superadmin_10_products_smoke`
- Inputs:
  - `merchant_id` (optional if using current session merchant)
  - `top_k` (default `5`)
  - `question_lang` (default `tr`)
  - `product_selection_mode` (`first_10_ready` / `manual`)
