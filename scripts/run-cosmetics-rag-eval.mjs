#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const templatesPath = path.join(root, 'packages/api/evals/cosmetics/scenario-templates.json');

const API_BASE = process.env.EVAL_API_BASE || 'http://localhost:3001';
const TOKEN = process.env.EVAL_TOKEN || '';
const OUTPUT = process.env.EVAL_OUTPUT || path.join(root, 'tmp/cosmetics-rag-eval-report.json');
const PRODUCT_IDS = process.env.EVAL_PRODUCT_IDS
  ? process.env.EVAL_PRODUCT_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : undefined;

const ADMIN_PRESETS = [
  { id: 'formal_short_noemoji', note: 'Set in admin panel before run', expected: { response_length: 'short', emoji: false } },
  { id: 'friendly_medium_emoji', note: 'Set in admin panel before run', expected: { response_length: 'medium', emoji: true } },
];

function authHeaders() {
  if (!TOKEN) return { 'Content-Type': 'application/json' };
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  };
}

function scoreHeuristics(caseRun) {
  const answer = caseRun.response?.answer || '';
  const meta = caseRun.response?.meta || {};
  const queryLang = caseRun.lang;
  const answerLang = meta.answerLanguage || null;
  const count = caseRun.response?.count ?? 0;

  return {
    languageMatch: answerLang === queryLang,
    ragNonEmpty: count > 0,
    styleCompliant: meta.styleCompliance?.compliant ?? null,
    guarded: Boolean(caseRun.response?.guardrailBlocked) || /doctor|orvos|doktor|112|emergency|acil/i.test(answer),
  };
}

async function runCase(query, lang, presetId, conversationHistory) {
  const startedAt = Date.now();
  const res = await fetch(`${API_BASE}/api/test/rag/answer`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      query,
      ...(Array.isArray(conversationHistory) && conversationHistory.length
        ? { conversationHistory }
        : {}),
      ...(PRODUCT_IDS?.length ? { productIds: PRODUCT_IDS } : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  return {
    status: res.status,
    latencyMs: Date.now() - startedAt,
    presetId,
    requestProductIds: PRODUCT_IDS || null,
    response: json,
  };
}

async function main() {
  const templates = JSON.parse(await fs.readFile(templatesPath, 'utf8'));
  const runs = [];

  for (const preset of ADMIN_PRESETS) {
    for (const tpl of templates) {
      for (const lang of ['tr', 'en', 'hu']) {
        const query = tpl.queries?.[lang];
        if (!query) continue;
        const conversationHistory = Array.isArray(tpl.history?.[lang]) ? tpl.history[lang] : undefined;
        const run = await runCase(query, lang, preset.id, conversationHistory);
        runs.push({
          scenarioId: tpl.id,
          category: tpl.category,
          lang,
          expected: tpl.expected,
          adminPreset: preset,
          conversationHistory: conversationHistory || null,
          query,
          ...run,
          heuristic: scoreHeuristics({ lang, response: run.response }),
        });
      }
    }
  }

  const summary = {
    totalRuns: runs.length,
    languageMatchRate:
      runs.filter((r) => r.heuristic.languageMatch).length / Math.max(1, runs.length),
    ragNonEmptyRate:
      runs.filter((r) => r.heuristic.ragNonEmpty).length / Math.max(1, runs.length),
    styleCompliantRate:
      runs.filter((r) => r.heuristic.styleCompliant === true).length /
      Math.max(1, runs.filter((r) => r.heuristic.styleCompliant !== null).length),
    p95LatencyMs: percentile(runs.map((r) => r.latencyMs), 95),
  };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), summary, runs }, null, 2));
  console.log(`Wrote eval report to ${OUTPUT}`);
  console.log(summary);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
