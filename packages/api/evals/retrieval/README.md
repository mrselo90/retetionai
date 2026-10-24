# Retrieval eval

Measures whether retrieval finds the evidence that answers a customer question,
before any LLM is involved. It runs production code (`queryKnowledgeBaseI18n`,
the rank fusion and rerank, `getCosmeticRagPolicy`, the chunk builder) against a
throwaway Postgres + pgvector with the real SQL functions from
`supabase/migrations`.

```bash
OPENAI_API_KEY=... pnpm --filter @recete/api eval:retrieval
```

Needs Docker. Embeddings (`text-embedding-3-small`, as in production) are cached
in `tmp/rag-eval-embeddings.json`, so reruns are free; set `RAG_EVAL_EMBED_CMD`
to a command that reads a JSON array of texts on stdin and prints a JSON array of
vectors to embed somewhere else (e.g. on the server that holds the key).
`RAG_EVAL_THRESHOLD` overrides the dense similarity floor for the "current" run.

- `fixtures.json`: fictional cosmetics products (TR, EN, HU) and questions. A
  case passes when one of the top-K chunks from the expected product contains
  one of `expect.anyOf`. `scope: "product"` means the product is known
  (post-purchase, order-scoped); `"none"` means retrieval has to find it.
  Cases with `expect: null` are off-catalogue (shipping, returns, ...) and only
  show whether unrelated product text comes back as "evidence".
- Two variants: `baseline` (migrations up to 044, thresholds 0.55-0.65) and
  `current` (every later migration touching the chunk index, the policy as in
  the code). Per-case results go to `tmp/rag-retrieval-eval.json`.

Add a case whenever a real question fails, and rerun before changing
`DENSE_SIMILARITY_FLOOR`, the keyword search, the chunking or the rerank.

Results when the floor and keyword search were fixed (migration 049):

| | baseline | current |
|---|---|---|
| evidence found | 15% (7/46) | 96% (44/46) |
| product known | 6% | 94% |
| no product context | 45% | 100% |
| empty retrievals | 85% | 4% |
| off-catalogue questions with evidence | 0/4 | 0/4 |
