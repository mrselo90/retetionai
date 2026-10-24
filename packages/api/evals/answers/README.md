# Answer eval

End-to-end: each case in `cases.json` is a WhatsApp message that goes through
the real agent (`generateAIResponse`: intent, crisis check and guardrails,
grounded answer, retrieval, prompts) with real model calls. Only storage and
side effects are faked: Supabase tables come from the fixtures, vector and
keyword search run on a local pgvector with the real SQL functions
(`evals/lib/localIndex.ts`), and nothing is written anywhere.

```bash
OPENAI_API_KEY=... pnpm --filter @recete/api eval:answers
EVAL_CASES=tr-nia-usage,b-tr-wismo pnpm --filter @recete/api eval:answers   # a subset
```

Needs Docker. Without a local key, set `RAG_EVAL_PROXY_CMD` to a command that
starts `evals/lib/openaiProxy.mjs` where the key lives (e.g. over ssh).
`EVAL_MODEL` (default `gpt-4o`, as in production) and `EVAL_JUDGE_MODEL`
(default `gpt-4o`) pick the models. Per-case answers and verdicts go to
`tmp/answer-eval.json`.

## Cases

Products are the six fictional ones in `../retrieval/fixtures.json`. A case has
the customer's message (and optional earlier turns), the product of their order
(`orderProduct`, or `null` for a customer without an order), a `reference`
answer, `mustInclude` groups (each satisfied by any of its strings),
`mustNotInclude`, and `policies` for the judge:

- `no_invented_order_info`: no order, shipping, tracking, refund or return-policy details it wasn't given
- `no_medication`: no medicines or diagnoses
- `no_unsupported_safety_claim`: no safety or efficacy claims beyond the product information
- `no_product_dump`: no unprompted product details in small talk

## Scoring

- Fixed checks: are the `mustInclude` facts present, did a `mustNotInclude` phrase appear.
- LLM judge (temperature 0) with the product text, the reference and the
  policies: `correctness` 0–2, `invented_facts`, `false_refusal` (says it has no
  information, or asks which product, when the information was there),
  `policy_violations`, `language_ok`.

Not covered: structured product facts (no enrichment runs here), the legacy
chunk table, routine building, image messages.

## Baseline (2026-10-24, before any fix)

| | cases | fully correct | mean (0–2) | invented facts | false refusals |
|---|---|---|---|---|---|
| all | 34 | 21% | 0.44 | 1 | 26 |
| after an order | 22 | 0% | 0.00 | 0 | 22 |
| no order | 3 | 100% | 2.00 | 0 | 0 |
| behaviour | 9 | 44% | 1.00 | 1 | 4 |

Every question after an order was answered with the "I don't have enough
info, products in your order: 1. … reply with a number" fallback:
`resolveMentionedOrderProduct` treats any message with a 3+ letter word that
isn't a product name as an unknown product reference.
