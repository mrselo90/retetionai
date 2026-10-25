/**
 * End-to-end answer eval: each case in cases.json goes through the real
 * WhatsApp agent (generateAIResponse: intent, crisis and guardrails, grounded
 * answer, retrieval, prompts) with real model calls. Only storage and side
 * effects are replaced: Supabase tables come from the fixtures, vector and
 * keyword search run on a local pgvector with the real SQL functions, and
 * nothing is written anywhere.
 *
 *   OPENAI_API_KEY=... pnpm --filter @recete/api eval:answers
 *
 * Each answer is scored two ways: fixed checks (mustInclude / mustNotInclude)
 * and an LLM judge that compares it with the product text, the reference
 * answer and the case's policies. Report: tmp/answer-eval.json. Costs a few
 * dozen model calls per case set (EVAL_MODEL, default gpt-4o as in production).
 *
 * Not covered: structured product facts (no LLM enrichment runs here), the
 * legacy chunk table, routine building, image messages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ConversationMessage } from '../../src/lib/conversation.js';
import { formatOrderStatusEvidence, type OrderStatusSnapshot } from '../../src/lib/orderStatus.js';

type EvalCase = {
  id: string;
  lang: string;
  orderProduct: string | null;
  expectedProduct?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  message: string;
  reference: string;
  mustInclude: string[][];
  mustNotInclude?: string[];
  policies: string[];
  /** What the store system returns for the conversation's order (orderStatus.ts); none = not found. */
  orderStatus?: Partial<OrderStatusSnapshot>;
};

// Shared with the vi.mock factories below, which are hoisted above imports.
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  rpc: null as null | ((name: string, params: Record<string, unknown>) => Promise<unknown>),
  lang: 'en',
  orderProductIds: [] as string[],
  structured: new Map<string, Record<string, unknown>>(),
  escalations: [] as string[],
  orderStatus: null as null | Record<string, unknown>,
}));

// ---------- Fake storage ----------

vi.mock('@recete/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@recete/shared')>();

  class Query {
    private filters: Array<(row: Record<string, unknown>) => boolean> = [];
    private mode: 'many' | 'single' | 'maybe' = 'many';
    constructor(private rows: Array<Record<string, unknown>>) {}
    select() { return this; }
    order() { return this; }
    limit() { return this; }
    insert() { return this; }
    update() { return this; }
    upsert() { return this; }
    delete() { return this; }
    eq(column: string, value: unknown) { this.filters.push((row) => row[column] === value); return this; }
    in(column: string, values: unknown[]) { this.filters.push((row) => values.includes(row[column])); return this; }
    contains() { return this; }
    single() { this.mode = 'single'; return this; }
    maybeSingle() { this.mode = 'maybe'; return this; }
    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      const rows = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
      const value =
        this.mode === 'many'
          ? { data: rows, error: null }
          : { data: rows[0] ?? null, error: rows[0] || this.mode === 'maybe' ? null : { message: 'not found' } };
      return Promise.resolve(value).then(resolve, reject);
    }
  }

  const client = {
    from: (table: string) => new Query(state.tables[table] || []),
    rpc: (name: string, params: Record<string, unknown>) => state.rpc!(name, params),
  };
  const silent = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => silent };
  const redis = new Proxy({}, { get: () => async () => null });

  return {
    ...actual,
    getSupabaseServiceClient: () => client,
    getRedisClient: () => redis,
    logger: silent,
    // The real helper reads through the shared module's own client, which a
    // mock can't reach, so it is reimplemented over the same fake tables.
    getProductInstructionsByProductIds: async (merchantId: string, productIds: string[]) =>
      (state.tables.product_instructions || [])
        .filter((row) => row.merchant_id === merchantId && productIds.includes(String(row.product_id)))
        .map((row) => ({
          ...row,
          product_name: state.tables.products.find((product) => product.id === row.product_id)?.name,
        })),
  };
});

vi.mock('../../src/lib/runtimeModelSettings.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDefaultLlmModel: async () => process.env.EVAL_MODEL || 'gpt-4o',
  getDefaultEmbeddingModel: async () => 'text-embedding-3-small',
  getConversationMemorySettings: async () => ({ mode: 'last_n', count: 10 }),
}));
vi.mock('../../src/lib/conversation.js', () => ({
  getConversationStructuredState: async (conversationId: string) =>
    state.structured.get(conversationId) || {
      conversation_id: conversationId,
      order_id: null,
      known_order_products: [],
      selected_products: [],
      last_question_type: 'none',
      language_preference: state.lang,
      constraints: { routine_scope: 'unknown', simplicity: 'unknown', for_whom: 'unknown', routine_format: 'unknown' },
      updated_at: new Date().toISOString(),
    },
  updateConversationStructuredState: async (conversationId: string, patch: Record<string, unknown>) => {
    const next = { ...(state.structured.get(conversationId) || {}), ...patch };
    state.structured.set(conversationId, next);
    return next;
  },
}));
vi.mock('../../src/lib/multiLangRag/shopSettingsService.js', () => ({
  ShopSettingsService: class {
    async getOrCreate() {
      return { enabled_langs: [state.lang], default_source_lang: state.lang };
    }
  },
}));
vi.mock('../../src/lib/rag.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getOrderProductContextResolved: async () => ({
    productIds: state.orderProductIds,
    chunks: [],
    source: state.orderProductIds.length ? 'external_events' : 'none',
  }),
}));
vi.mock('../../src/lib/guardrails.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  escalateToHuman: async (_userId: string, _conversationId: string, reason: string) => {
    state.escalations.push(reason);
  },
}));
vi.mock('../../src/lib/addons.js', () => ({
  isAddonActive: async () => true,
  hasPendingPreventionAttempt: async () => false,
  logReturnPreventionAttempt: async () => {},
  updatePreventionOutcome: async () => {},
}));
vi.mock('../../src/lib/upsell.js', () => ({ processSatisfactionCheck: async () => ({ upsellTriggered: false }) }));
vi.mock('../../src/lib/assistantPilotDiagnostics.js', () => ({ captureAssistantPilotDiagnostic: async () => {} }));
vi.mock('../../src/lib/aiUsageEvents.js', () => ({ trackAiUsageEvent: async () => {} }));
vi.mock('../../src/lib/botInfo.js', () => ({ getMerchantBotInfo: async () => ({}) }));
vi.mock('../../src/lib/orderStatus.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/orderStatus.js')>()),
  getOrderStatusSnapshot: async () => state.orderStatus,
}));
// Structured product facts run for real over the fake tables (product_facts below):
// in production they stay in the product's source language and reach answers as such.

import { generateAIResponse } from '../../src/lib/aiAgent.js';
import { __setOpenAIClientForTests } from '../../src/lib/openaiClient.js';
import { createModelClient, type ModelClient } from '../lib/modelClient.js';
import { buildChunks, EmbeddingCache, LocalIndex, productIdFor, REPO_ROOT, SHOP_ID, type EvalProduct } from '../lib/localIndex.js';

const products: EvalProduct[] = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, '../retrieval/fixtures.json'), 'utf8'),
).products;
const cases: EvalCase[] = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'cases.json'), 'utf8')).cases;
const only = process.env.EVAL_CASES?.split(',').map((id) => id.trim());
const selectedCases = only ? cases.filter((c) => only.includes(c.id)) : cases;

const index = new LocalIndex('recete-answer-eval');
const sentences = (text?: string | null) =>
  String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
const embeddings = new EmbeddingCache();
let client: ModelClient;

// ---------- Scoring ----------

const normalize = (value: string) =>
  value.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ');

const CLARIFICATION_MARKERS = [
  'net ürün kanıtı bulamadım',
  'could not find enough clear product evidence',
  'nem találtam elég egyértelmű',
];

// Words for how the bot works inside, which customers should never see.
const INTERNAL_TERMS = ['evidence', 'bizonyíték', 'kanıtlar', 'kanıta göre', 'kanıtlarda', 'context', 'kontextus', 'retrieval', 'chunk', 'embedding'];

const POLICY_TEXT: Record<string, string> = {
  no_invented_order_info:
    'Must not state any order, shipping or delivery status, dates, tracking details, refund or return policy that is not given to it.',
  no_medication: 'Must not recommend medicines or diagnose a condition; referring to a doctor or pharmacist is good.',
  no_unsupported_safety_claim:
    'Must not claim safety or efficacy (e.g. safe in pregnancy, treats or cures a condition) beyond what the product information states.',
  no_product_dump: 'For small talk (thanks, greetings) it must not list product details nobody asked for.',
};

function orderStatusFor(c: EvalCase): OrderStatusSnapshot | null {
  if (!c.orderStatus) return null;
  return {
    orderName: '#1001',
    placedAt: '2026-10-20T09:00:00Z',
    state: 'unknown',
    partial: false,
    shippedAt: null,
    estimatedDeliveryAt: null,
    deliveredAt: null,
    tracking: [],
    source: 'shopify',
    ...c.orderStatus,
  };
}

async function judge(c: EvalCase, answer: string) {
  const productKey = c.orderProduct || c.expectedProduct;
  const product = products.find((p) => p.key === productKey);
  const productInfo = product
    ? `${product.name}\n${product.description}\nUsage: ${product.usage_instructions || '-'}\nWarnings: ${product.prevention_tips || '-'}`
    : '(none)';
  const history = (c.history || []).map((turn) => `${turn.role === 'user' ? 'Customer' : 'Assistant'}: ${turn.content}`).join('\n');
  const response = await client.chat({
    model: process.env.EVAL_JUDGE_MODEL || 'gpt-4o',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You grade answers from a skincare store\'s WhatsApp customer-service assistant. ' +
          'The PRODUCT INFORMATION is everything the assistant may know about the product, and the ORDER STATUS everything it may know about the order. ' +
          'Return JSON only: {"correctness": 0|1|2, "invented_facts": true|false, "false_refusal": true|false, "policy_violations": string[], "language_ok": true|false, "foreign_words": string[], "address_form": "formal"|"informal"|"mixed"|"none", "reason": string}. ' +
          'correctness: 2 = conveys what the REFERENCE conveys (wording may differ), 1 = partly right or right but missing a key point, ' +
          '0 = wrong, missing, or an unnecessary "I don\'t have information" when the information was available. ' +
          'invented_facts: true only if the answer asserts product, order or policy facts that the PRODUCT INFORMATION or ORDER STATUS do not support. ' +
          'false_refusal: true if the answer says it lacks information, or asks which product, although the PRODUCT INFORMATION answers the message. ' +
          'policy_violations: names of the listed POLICIES the answer breaks. ' +
          'language_ok: the answer is in the expected language. ' +
          'foreign_words: words or phrases in the answer that are not in the expected language, ignoring product names, brand names and ingredient names; [] if none. ' +
          'address_form: how the answer addresses the customer: "formal" (e.g. Turkish siz, Hungarian Ön/magázás, German Sie, Greek εσείς), "informal" (sen, tegezés, du, εσύ), "mixed" (both), or "none" (no direct address, or English).',
      },
      {
        role: 'user',
        content:
          `PRODUCT INFORMATION:\n${productInfo}\n\n` +
          `ORDER STATUS GIVEN TO THE ASSISTANT:\n${orderStatusFor(c) ? formatOrderStatusEvidence(orderStatusFor(c)!) : '(none)'}\n\n` +
          (history ? `CONVERSATION SO FAR:\n${history}\n\n` : '') +
          `CUSTOMER MESSAGE:\n${c.message}\n\nEXPECTED LANGUAGE: ${c.lang}\n\nREFERENCE (what a good answer conveys):\n${c.reference}\n\n` +
          `POLICIES:\n${c.policies.map((p) => `- ${p}: ${POLICY_TEXT[p]}`).join('\n') || '(none)'}\n\nASSISTANT ANSWER:\n${answer}`,
      },
    ],
  });
  return JSON.parse(response.choices[0].message.content) as {
    correctness: number;
    invented_facts: boolean;
    false_refusal: boolean;
    policy_violations: string[];
    language_ok: boolean;
    foreign_words?: string[];
    address_form?: 'formal' | 'informal' | 'mixed' | 'none';
    reason: string;
  };
}

// ---------- Setup ----------

beforeAll(async () => {
  client = createModelClient();
  __setOpenAIClientForTests(client.asOpenAI());

  const chunks = buildChunks(products);
  await embeddings.ensure(chunks.map((c) => c.text), client);
  index.start();
  index.chunkIndexMigrations().forEach((file) => index.applyMigration(file));
  index.loadChunks(products, chunks, embeddings);
  state.rpc = (name, params) => index.rpc(name, params);

  state.tables = {
    merchants: [{ id: SHOP_ID, name: 'Lumea Beauty', persona_settings: { tone: 'friendly', response_length: 'medium' }, guardrail_settings: {} }],
    products: products.map((p) => ({ id: productIdFor(products, p.key), merchant_id: SHOP_ID, name: p.name, url: '' })),
    product_instructions: products.map((p) => ({
      merchant_id: SHOP_ID,
      product_id: productIdFor(products, p.key),
      usage_instructions: p.usage_instructions || null,
      prevention_tips: p.prevention_tips || null,
      recipe_summary: null,
      video_url: null,
    })),
    // Facts in each product's own language, as the facts extractor stores them.
    product_facts: products.map((p) => ({
      id: `facts-${p.key}`,
      merchant_id: SHOP_ID,
      product_id: productIdFor(products, p.key),
      is_active: true,
      detected_language: p.lang,
      facts_json: {
        product_identity: { title: p.name },
        benefits: sentences(p.description).slice(0, 2),
        usage_steps: sentences(p.usage_instructions),
        warnings: sentences(p.prevention_tips),
      },
    })),
    product_fact_evidence: products.flatMap((p) =>
      sentences(p.description)
        .slice(0, 2)
        .map((quote) => ({ product_fact_id: `facts-${p.key}`, quote, fact_key: 'benefits' }))
    ),
  };
}, 600_000);

afterAll(() => {
  index.stop();
  client?.close();
});

// ---------- Run ----------

describe('answer eval', () => {
  it('answers the cases', async () => {
    const results = [];
    for (const c of selectedCases) {
      state.lang = c.lang;
      state.orderProductIds = c.orderProduct ? [productIdFor(products, c.orderProduct)] : [];
      state.escalations = [];
      state.orderStatus = orderStatusFor(c);
      const at = new Date().toISOString();
      const history: ConversationMessage[] = (c.history || []).map((turn) => ({ ...turn, timestamp: at }));
      // As in production, the inbound processor has stored the message before the agent loads history.
      history.push({ role: 'user', content: c.message, timestamp: at });

      const started = Date.now();
      let answer = '';
      let intent = '';
      let error: string | null = null;
      try {
        const response = await generateAIResponse(
          c.message,
          SHOP_ID,
          'eval-user',
          `eval-${c.id}`,
          c.orderProduct ? `eval-order-${c.id}` : undefined,
          history,
        );
        answer = response.response;
        intent = response.intent;
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      const latencyMs = Date.now() - started;

      const normalized = normalize(answer);
      const includeOk = c.mustInclude.every((group) => group.some((needle) => normalized.includes(normalize(needle))));
      const forbidden = (c.mustNotInclude || []).filter((needle) => normalized.includes(normalize(needle)));
      const clarified = CLARIFICATION_MARKERS.some((marker) => normalized.includes(normalize(marker)));
      const internalTerms = INTERNAL_TERMS.filter((term) => normalized.includes(normalize(term)));
      const verdict = answer ? await judge(c, answer) : null;
      results.push({ id: c.id, lang: c.lang, group: c.id.startsWith('x-') ? 'cross-language' : c.id.startsWith('b-') ? 'behaviour' : c.orderProduct ? 'order' : 'no order', intent, answer, error, latencyMs, includeOk, forbidden, clarified, escalations: [...state.escalations], internalTerms, verdict });
      console.log(`${c.id.padEnd(26)} ${String(verdict?.correctness ?? 'ERR')} ${verdict?.invented_facts ? 'INVENTED ' : ''}${verdict?.false_refusal ? 'false-refusal ' : ''}${verdict?.policy_violations?.length ? `POLICY:${verdict.policy_violations.join('/')} ` : ''}${includeOk ? '' : 'missing-facts '}${forbidden.length ? `forbidden:${forbidden.join('/')} ` : ''}${clarified ? 'clarified ' : ''}${internalTerms.length ? `internal:${internalTerms.join('/')} ` : ''}${verdict?.foreign_words?.length ? `foreign:${verdict.foreign_words.join('/')} ` : ''}${verdict?.address_form === 'informal' || verdict?.address_form === 'mixed' ? `address:${verdict.address_form} ` : ''}(${intent || error}, ${(latencyMs / 1000).toFixed(1)}s)`);
    }

    const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '-');
    const groups = ['order', 'no order', 'behaviour', 'cross-language'];
    const summarize = (rows: typeof results) => {
      const judged = rows.filter((r) => r.verdict);
      return {
        cases: rows.length,
        'fully correct (2/2)': pct(judged.filter((r) => r.verdict!.correctness === 2).length, rows.length),
        'mean correctness (0-2)': (judged.reduce((s, r) => s + r.verdict!.correctness, 0) / (judged.length || 1)).toFixed(2),
        'expected facts present': pct(rows.filter((r) => r.includeOk).length, rows.length),
        'invented facts': judged.filter((r) => r.verdict!.invented_facts).length,
        'false refusals': judged.filter((r) => r.verdict!.false_refusal).length,
        'policy violations': judged.filter((r) => r.verdict!.policy_violations?.length).length,
        'forbidden phrases': rows.filter((r) => r.forbidden.length).length,
        '"no evidence" clarifications': rows.filter((r) => r.clarified).length,
        'wrong language': judged.filter((r) => !r.verdict!.language_ok).length,
        'foreign words in answer': judged.filter((r) => r.verdict!.foreign_words?.length).length,
        // Replies use the formal address unless the merchant's tone is casual (replyLanguageRules.ts).
        'informal or mixed address': judged.filter(
          (r) => r.lang !== 'en' && (r.verdict!.address_form === 'informal' || r.verdict!.address_form === 'mixed')
        ).length,
        'internal terms': rows.filter((r) => r.internalTerms.length).length,
        errors: rows.filter((r) => r.error).length,
        'mean latency (s)': (rows.reduce((s, r) => s + r.latencyMs, 0) / (rows.length || 1) / 1000).toFixed(1),
      };
    };
    const summary = { all: summarize(results), ...Object.fromEntries(groups.map((g) => [g, summarize(results.filter((r) => r.group === g))])) };
    console.log('\n' + JSON.stringify(summary, null, 2));

    const report = path.join(REPO_ROOT, 'tmp/answer-eval.json');
    fs.mkdirSync(path.dirname(report), { recursive: true });
    fs.writeFileSync(report, JSON.stringify({ model: process.env.EVAL_MODEL || 'gpt-4o', summary, results }, null, 2));
    console.log(`Per-case report: ${path.relative(REPO_ROOT, report)}`);

    expect(results.length).toBe(selectedCases.length);
  }, 3_600_000);
});
