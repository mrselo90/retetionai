import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.API_TOKEN;
const TOP_K = Number(process.env.TOP_K || 5);
const INPUT_PATH = process.env.RAG_EVAL_CASES || path.resolve('docs/performance/rag_eval_cases.json');
const OUTPUT_PATH = process.env.RAG_EVAL_OUTPUT || path.resolve('docs/performance/rag_eval_results.json');

if (!API_TOKEN) {
  console.error('Missing API_TOKEN env var.');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_TOKEN}`,
};

const payloadFor = (question) => ({ query: question, topK: TOP_K });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const inputRaw = await fs.readFile(INPUT_PATH, 'utf-8');
const input = JSON.parse(inputRaw);

const results = [];

for (const c of input.cases || []) {
  const startedAt = Date.now();
  const ragRes = await fetch(`${API_URL}/api/test/rag`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payloadFor(c.question)),
  }).then((r) => r.json());

  await sleep(150);

  const answerRes = await fetch(`${API_URL}/api/test/rag/answer`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payloadFor(c.question)),
  }).then((r) => r.json());

  results.push({
    id: c.id,
    question: c.question,
    lang: c.lang,
    expected_product_names: c.expected_product_names || [],
    expected_fact_hints: c.expected_fact_hints || [],
    rag: ragRes,
    answer: answerRes,
    manual: {
      has_correct_product: null,
      relevant_chunks_count: null,
      helpfulness: null,
      faithfulness: null,
      notes: '',
    },
    latency_ms: Date.now() - startedAt,
  });
}

const output = {
  version: input.version || '1.0',
  generated_at: new Date().toISOString(),
  api_url: API_URL,
  top_k: TOP_K,
  results,
};

await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
console.log(`Saved: ${OUTPUT_PATH}`);
