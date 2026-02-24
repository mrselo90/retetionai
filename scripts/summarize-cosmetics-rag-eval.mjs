#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));

const scorePath = args.score || process.env.EVAL_SCORE_REPORT || path.join(root, 'tmp/cosmetics-rag-eval-score.json');
const judgePath = args.judge || process.env.EVAL_JUDGE_REPORT || path.join(root, 'tmp/cosmetics-rag-eval-judge.json');
const baselineScorePath = args.baselineScore || process.env.EVAL_BASELINE_SCORE_REPORT || '';
const baselineJudgePath = args.baselineJudge || process.env.EVAL_BASELINE_JUDGE_REPORT || '';
const outputPath = args.output || process.env.EVAL_SUMMARY_OUTPUT || path.join(root, 'tmp/cosmetics-rag-eval-summary.json');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--score') out.score = argv[++i];
    else if (a === '--judge') out.judge = argv[++i];
    else if (a === '--baseline-score') out.baselineScore = argv[++i];
    else if (a === '--baseline-judge') out.baselineJudge = argv[++i];
    else if (a === '--output') out.output = argv[++i];
  }
  return out;
}

async function readJsonOrNull(filePath) {
  try {
    const txt = await fs.readFile(filePath, 'utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function metric(value, target, comparator = '>=') {
  if (typeof value !== 'number') {
    return { value: value ?? null, target, comparator, pass: null };
  }
  const pass = comparator === '>=' ? value >= target : value <= target;
  return { value, target, comparator, pass };
}

function buildGates(score, judge) {
  const s = score?.summary?.overall || {};
  const j = judge?.summary || {};
  return {
    proxy: {
      languageMatchRate: metric(s.languageMatchRate, 0.98, '>='),
      styleComplianceRate: metric(s.styleComplianceRate, 0.95, '>='),
      guardrailProxyComplianceRate: metric(s.guardrailProxyComplianceRate, 0.95, '>='),
      hallucinationProxyRate: metric(s.hallucinationProxyRate, 0.05, '<='),
      wrongProductProxyRate: metric(s.wrongProductProxyRate, 0.02, '<='),
    },
    judge: {
      factCorrectnessAvg: metric(j.fact_correctness_avg, 1.5, '>='),
      groundednessAvg: metric(j.groundedness_avg, 1.5, '>='),
      abstainQualityAvg: metric(j.abstain_quality_avg, 1.4, '>='),
      guardrailBehaviorAvg: metric(j.guardrail_behavior_avg, 1.7, '>='),
      hallucinationFlagRate: metric(j.hallucinationFlagRate, 0.05, '<='),
      wrongProductFlagRate: metric(j.wrongProductFlagRate, 0.02, '<='),
      languageMismatchFlagRate: metric(j.languageMismatchFlagRate, 0.02, '<='),
    },
  };
}

function maybeDelta(current, baseline) {
  return typeof current === 'number' && typeof baseline === 'number' ? current - baseline : null;
}

function buildBaselineComparison(currentScore, currentJudge, baselineScore, baselineJudge) {
  if (!baselineScore && !baselineJudge) return null;

  const currentS = currentScore?.summary?.overall || {};
  const currentJ = currentJudge?.summary || {};
  const baselineS = baselineScore?.summary?.overall || {};
  const baselineJ = baselineJudge?.summary || {};

  return {
    proxyDelta: {
      languageMatchRate: maybeDelta(currentS.languageMatchRate, baselineS.languageMatchRate),
      styleComplianceRate: maybeDelta(currentS.styleComplianceRate, baselineS.styleComplianceRate),
      guardrailProxyComplianceRate: maybeDelta(
        currentS.guardrailProxyComplianceRate,
        baselineS.guardrailProxyComplianceRate
      ),
      hallucinationProxyRate: maybeDelta(currentS.hallucinationProxyRate, baselineS.hallucinationProxyRate),
      wrongProductProxyRate: maybeDelta(currentS.wrongProductProxyRate, baselineS.wrongProductProxyRate),
      deterministicFactsAnswerRate: maybeDelta(
        currentS.deterministicFactsAnswerRate,
        baselineS.deterministicFactsAnswerRate
      ),
      avgFactsSnapshotsFound: maybeDelta(currentS.avgFactsSnapshotsFound, baselineS.avgFactsSnapshotsFound),
      avgDeterministicEvidenceUsed: maybeDelta(
        currentS.avgDeterministicEvidenceUsed,
        baselineS.avgDeterministicEvidenceUsed
      ),
      latencyP95Ms: maybeDelta(currentS?.latencyMs?.p95, baselineS?.latencyMs?.p95),
      avgTokensTotal: maybeDelta(currentS?.tokens?.avgTotal, baselineS?.tokens?.avgTotal),
    },
    judgeDelta: {
      factCorrectnessAvg: maybeDelta(currentJ.fact_correctness_avg, baselineJ.fact_correctness_avg),
      groundednessAvg: maybeDelta(currentJ.groundedness_avg, baselineJ.groundedness_avg),
      abstainQualityAvg: maybeDelta(currentJ.abstain_quality_avg, baselineJ.abstain_quality_avg),
      guardrailBehaviorAvg: maybeDelta(currentJ.guardrail_behavior_avg, baselineJ.guardrail_behavior_avg),
      hallucinationFlagRate: maybeDelta(currentJ.hallucinationFlagRate, baselineJ.hallucinationFlagRate),
      wrongProductFlagRate: maybeDelta(currentJ.wrongProductFlagRate, baselineJ.wrongProductFlagRate),
      languageMismatchFlagRate: maybeDelta(
        currentJ.languageMismatchFlagRate,
        baselineJ.languageMismatchFlagRate
      ),
    },
  };
}

function flattenGateResults(gates) {
  return Object.entries(gates).flatMap(([group, metrics]) =>
    Object.entries(metrics).map(([name, m]) => ({ group, name, ...m }))
  );
}

function overallVerdict(gates, score, judge) {
  const flattened = flattenGateResults(gates);
  const known = flattened.filter((m) => m.pass !== null);
  const failed = known.filter((m) => m.pass === false);

  const hasJudge = Boolean(judge?.summary?.judgedRuns);
  const hasScore = Boolean(score?.summary?.overall);

  if (!hasScore) return { status: 'insufficient_data', reason: 'missing_score_report', failed: [] };
  if (!hasJudge) return { status: 'partial', reason: 'missing_judge_report', failed: failed.map(keyOfGate) };
  if (failed.length === 0) return { status: 'pass', reason: 'all_gates_met', failed: [] };
  if (failed.length <= 3) return { status: 'needs_improvement', reason: 'few_gates_failed', failed: failed.map(keyOfGate) };
  return { status: 'risk', reason: 'many_gates_failed', failed: failed.map(keyOfGate) };
}

function keyOfGate(g) {
  return `${g.group}.${g.name}`;
}

function generateRecommendations(score, judge, gates, baselineComparison = null) {
  const recs = [];
  const s = score?.summary?.overall || {};
  const j = judge?.summary || {};
  const postDelivery = score?.summary?.byCategory?.post_delivery_onboarding || null;

  if (typeof s.wrongProductProxyRate === 'number' && s.wrongProductProxyRate > 0.02) {
    recs.push('Improve product disambiguation/order scoping; wrong-product proxy rate is above target.');
  }
  if (typeof s.languageMatchRate === 'number' && s.languageMatchRate < 0.98) {
    recs.push('Tighten same-language enforcement and inspect guardrail fallback/localized templates.');
  }
  if (typeof s.styleComplianceRate === 'number' && s.styleComplianceRate < 0.95) {
    recs.push('Strengthen style enforcement (length/emoji) in deterministic and LLM-generated paths.');
  }
  if (typeof j.fact_correctness_avg === 'number' && j.fact_correctness_avg < 1.5) {
    recs.push('Increase facts-first coverage and improve retrieval grounding for unsupported factual answers.');
  }
  if (typeof j.groundedness_avg === 'number' && j.groundedness_avg < 1.5) {
    recs.push('Add stronger evidence usage or cite supporting snippets in generated answers.');
  }
  if (typeof j.hallucinationFlagRate === 'number' && j.hallucinationFlagRate > 0.05) {
    recs.push('Reduce hallucination by expanding deterministic fact planner and tightening “unknown” behavior.');
  }
  if (typeof s.deterministicFactsAnswerRate === 'number' && s.deterministicFactsAnswerRate < 0.2) {
    recs.push('Expand deterministic fact planner coverage to more cosmetics question types.');
  }
  if (
    postDelivery &&
    typeof postDelivery.postDeliveryFollowUpDetectionRate === 'number' &&
    postDelivery.postDeliveryFollowUpDetectionRate < 0.9
  ) {
    recs.push('Post-delivery onboarding follow-up detection is weak; tune short reply patterns (yes/no/how/often) across TR/EN/HU.');
  }
  if (
    postDelivery &&
    typeof postDelivery.postDeliveryFollowUpFactsFirstRate === 'number' &&
    postDelivery.postDeliveryFollowUpFactsFirstRate < 0.5
  ) {
    recs.push('Increase facts-first coverage for post-delivery onboarding follow-ups (usage/frequency/warnings).');
  }
  if (
    typeof baselineComparison?.proxyDelta?.wrongProductProxyRate === 'number' &&
    baselineComparison.proxyDelta.wrongProductProxyRate > 0.01
  ) {
    recs.push('Wrong-product proxy rate regressed vs baseline; inspect order scoping and product resolution traces.');
  }
  if (
    typeof baselineComparison?.judgeDelta?.factCorrectnessAvg === 'number' &&
    baselineComparison.judgeDelta.factCorrectnessAvg < -0.1
  ) {
    recs.push('Judge fact correctness regressed vs baseline; compare facts-first coverage and evidence-rich answers.');
  }
  if (
    typeof baselineComparison?.proxyDelta?.latencyP95Ms === 'number' &&
    baselineComparison.proxyDelta.latencyP95Ms > 200
  ) {
    recs.push('Latency p95 regressed materially vs baseline; review retrieval candidate multiplier and deterministic hit rate.');
  }

  const failed = flattenGateResults(gates).filter((g) => g.pass === false).length;
  if (recs.length === 0 && failed === 0) {
    recs.push('Current eval run meets configured gates. Keep scenario set stable and compare against a new baseline after each major change.');
  }
  return recs;
}

function buildDecisionSummary(score, judge, baselineScore, baselineJudge) {
  const gates = buildGates(score, judge);
  const verdict = overallVerdict(gates, score, judge);
  const baselineComparison = buildBaselineComparison(score, judge, baselineScore, baselineJudge);
  const recommendations = generateRecommendations(score, judge, gates, baselineComparison);

  return {
    generatedAt: new Date().toISOString(),
    inputs: {
      scoreReport: scorePath,
      judgeReport: judgePath,
      baselineScoreReport: baselineScorePath || null,
      baselineJudgeReport: baselineJudgePath || null,
      scoreSourceReport: score?.sourceReport || null,
      judgeSourceReport: judge?.sourceReport || null,
      baselineScoreSourceReport: baselineScore?.sourceReport || null,
      baselineJudgeSourceReport: baselineJudge?.sourceReport || null,
    },
    verdict,
    gates,
    scoreHighlights: score?.summary || null,
    judgeHighlights: judge?.summary || null,
    baselineComparison,
    recommendations,
  };
}

async function main() {
  const [score, judge, baselineScore, baselineJudge] = await Promise.all([
    readJsonOrNull(scorePath),
    readJsonOrNull(judgePath),
    baselineScorePath ? readJsonOrNull(baselineScorePath) : Promise.resolve(null),
    baselineJudgePath ? readJsonOrNull(baselineJudgePath) : Promise.resolve(null),
  ]);
  const summary = buildDecisionSummary(score, judge, baselineScore, baselineJudge);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

  console.log(`Wrote decision summary to ${outputPath}`);
  console.log(`Verdict: ${summary.verdict.status} (${summary.verdict.reason})`);
  if (summary.verdict.failed?.length) {
    console.log('Failed gates:');
    for (const f of summary.verdict.failed) console.log(`- ${f}`);
  }
  if (summary.recommendations?.length) {
    console.log('Recommendations:');
    for (const r of summary.recommendations.slice(0, 5)) console.log(`- ${r}`);
  }
  if (summary.baselineComparison) {
    console.log('Baseline comparison: included in summary.baselineComparison');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
