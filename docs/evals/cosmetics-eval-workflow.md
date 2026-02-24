# Cosmetics RAG Eval Workflow

This project includes a lightweight evaluation pipeline for the cosmetics RAG bot (TR / EN / HU).

## 1. Run the eval cases

Runs the prepared multilingual scenarios against `/api/test/rag/answer` and stores raw responses.

Internal secret mode (recommended for server-side eval; no merchant API key needed):

```bash
EVAL_API_BASE=http://localhost:3002 \
EVAL_INTERNAL_SECRET=<INTERNAL_SERVICE_SECRET> \
EVAL_MERCHANT_ID=<merchant_uuid> \
EVAL_PRODUCT_IDS=<product_uuid_1>,<product_uuid_2> \
node scripts/run-cosmetics-rag-eval.mjs
```

JWT/API key mode (legacy fallback):

```bash
EVAL_API_BASE=http://localhost:3001 \
EVAL_TOKEN=<ACCESS_TOKEN_OR_API_KEY> \
EVAL_PRODUCT_IDS=<product_uuid_1>,<product_uuid_2> \
node scripts/run-cosmetics-rag-eval.mjs
```

Output:
- `tmp/cosmetics-rag-eval-report.json`

## 2. Score proxy metrics (fast, no LLM judge)

Produces aggregate metrics and category/language breakdowns using heuristics and endpoint metadata.

```bash
node scripts/score-cosmetics-rag-eval.mjs \
  --report tmp/cosmetics-rag-eval-report.json
```

Output:
- `tmp/cosmetics-rag-eval-score.json`

Metrics include:
- language match
- style compliance (emoji/length)
- RAG non-empty rate
- abstain proxy correctness
- guardrail proxy compliance
- hallucination proxy rate
- wrong product proxy rate (when `EVAL_PRODUCT_IDS` is provided)

## 3. LLM judge (fact correctness / groundedness)

Uses OpenAI to judge each run against retrieved chunks only (no outside knowledge).

```bash
OPENAI_API_KEY=<KEY> \
EVAL_JUDGE_MODEL=gpt-4o-mini \
node scripts/judge-cosmetics-rag-eval.mjs \
  --report tmp/cosmetics-rag-eval-report.json
```

Optional:
- `EVAL_JUDGE_CONCURRENCY=1` (default)
- `EVAL_JUDGE_MAX_RUNS=20` (sample a subset)

Output:
- `tmp/cosmetics-rag-eval-judge.json`

Judge scores (0-2):
- `fact_correctness`
- `groundedness`
- `abstain_quality`
- `guardrail_behavior`

Judge flags:
- `hallucination`
- `wrong_product`
- `language_mismatch`

## 4. Compare against a baseline

Use the scorer with a baseline raw report:

```bash
node scripts/score-cosmetics-rag-eval.mjs \
  --report tmp/current-report.json \
  --baseline tmp/baseline-report.json
```

This prints deltas for key rates and latency/token changes.

## 5. Build a single decision summary (score + judge)

Merges the proxy score report and the LLM judge report into one decision-oriented summary with gates and recommendations.

```bash
node scripts/summarize-cosmetics-rag-eval.mjs \
  --score tmp/cosmetics-rag-eval-score.json \
  --judge tmp/cosmetics-rag-eval-judge.json
```

Output:
- `tmp/cosmetics-rag-eval-summary.json`

Optional baseline-aware summary:

```bash
node scripts/summarize-cosmetics-rag-eval.mjs \
  --score tmp/current-score.json \
  --judge tmp/current-judge.json \
  --baseline-score tmp/baseline-score.json \
  --baseline-judge tmp/baseline-judge.json
```

The summary includes:
- verdict (`pass` / `needs_improvement` / `risk`)
- gate results (proxy + judge)
- score/judge highlights
- baseline deltas (if provided)
- prioritized recommendations

## Notes

- Proxy metrics are fast but imperfect. Use the LLM judge (and ideally human review for a subset) before making product decisions.
- Best results come after running DB migrations `017_product_facts.sql` and `018_knowledge_chunk_metadata.sql`.
- For stable comparisons, keep the same products and admin presets across runs.
