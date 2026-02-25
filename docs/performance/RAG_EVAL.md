# RAG Evaluation Plan (Baseline)

This document defines the baseline metrics and a step-by-step evaluation flow for the RAG system. The goal is to answer three questions:

- Do we retrieve the right product info?
- Are the final answers accurate and helpful?
- Is latency acceptable under realistic load?

## 1) Metrics (Baseline)

### Retrieval Quality
- **Recall@k (manual proxy)**: Does the correct product appear in the top-k results?
- **Precision@k (manual proxy)**: Of the top-k chunks, how many are actually relevant?
- **Language match**: Do returned chunks match user language when available?

### Answer Quality
- **Answer helpfulness (1-5)**: Is the response correct, actionable, and complete?
- **Faithfulness**: Is the answer fully grounded in retrieved context (no hallucination)?
- **Clarity**: Is it easy to follow? (step-by-step for usage questions)

### Performance
- **RAG query latency p95**: `/api/test/rag` and `/api/test/rag/answer`
- **End-to-end chatbot latency p95**: WhatsApp mock path or real webhook path

## 2) Baseline Test Set (Small)

Create a small set of 20-40 questions. Split into 4 categories:
- Usage (how to apply / frequency)
- Ingredients (INCI, actives)
- Warnings / side effects
- Specs (volume, SPF, etc.)

Store them in `docs/performance/rag_eval_cases.json`.

## 3) Manual Evaluation Flow

### A) Retrieval check (no LLM)
Use `/api/test/rag` with `topK=5` for each query.
Record:
- `has_correct_product` (true/false)
- `relevant_chunks_count` (0..k)
- `notes` (e.g. wrong product, language mismatch)

### B) Answer check (RAG + AI)
Use `/api/test/rag/answer` with the same queries.
Record:
- `helpfulness` (1-5)
- `faithfulness` (yes/no)
- `missing_info` (yes/no)
- `notes`

### C) Latency sample
Run the same 20-40 queries 3 times at low concurrency and record p95.

## 3.1) Semi-Automated Runner (Optional)

You can run a helper script to collect raw RAG + AI outputs into a single JSON file, then fill in manual ratings:

```bash
API_URL=http://localhost:3001 \\
API_TOKEN=YOUR_TOKEN \\
node scripts/rag_eval_runner.mjs
```

Outputs to `docs/performance/rag_eval_results.json`.

## 4) Suggested Acceptance Thresholds (Initial)

- **Recall@5 >= 0.75** for usage and ingredients
- **Precision@5 >= 0.5** (at least 2/5 chunks useful)
- **Helpfulness avg >= 3.8/5**
- **Faithfulness >= 95%** (no hallucination)
- **Latency p95**: RAG <= 2s, RAG+AI <= 5s

## 5) Next Step After Baseline

- Move to automated eval once the manual baseline is stable.
- Use the baseline set as a regression gate for chunking + reranking changes.
