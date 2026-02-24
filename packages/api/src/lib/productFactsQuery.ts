import { getSupabaseServiceClient, logger } from '@recete/shared';
import type { ProductFacts } from './llm/productFacts.js';

interface ProductFactRow {
  id: string;
  product_id: string;
  detected_language?: string | null;
  facts_json?: any;
}

interface ProductFactEvidenceRow {
  product_fact_id: string;
  quote: string;
  fact_key?: string | null;
}

export interface ProductFactsContextResult {
  text: string;
  factCount: number;
  productIds: string[];
}

export interface ProductFactSnapshot {
  id: string;
  productId: string;
  productName: string;
  detectedLanguage?: string | null;
  facts: ProductFacts | Record<string, any>;
  evidence: Array<{ quote: string; factKey?: string | null }>;
}

function block(label: string, lines: string[]): string {
  if (!lines.length) return '';
  return [`[${label}]`, ...lines].join('\n');
}

function formatFactSnapshot(productName: string, row: ProductFactRow, evidence: ProductFactEvidenceRow[]): string {
  const facts = row.facts_json || {};
  const identity = facts.product_identity || {};
  const lines: string[] = [];

  const identityLines = [
    `Title: ${identity.title || productName}`,
    identity.brand ? `Brand: ${identity.brand}` : '',
    identity.product_type ? `Type: ${identity.product_type}` : '',
    identity.variant ? `Variant: ${identity.variant}` : '',
    identity.volume_value != null && identity.volume_unit ? `Volume: ${identity.volume_value} ${identity.volume_unit}` : '',
    row.detected_language ? `Language: ${row.detected_language}` : '',
  ].filter(Boolean) as string[];
  lines.push(block('IDENTITY', identityLines));

  const listFields: Array<[string, string]> = [
    ['target_skin_types', 'SKIN_TYPES'],
    ['benefits', 'BENEFITS'],
    ['ingredients', 'INGREDIENTS'],
    ['active_ingredients', 'ACTIVE_INGREDIENTS'],
    ['usage_steps', 'USAGE_STEPS'],
    ['warnings', 'WARNINGS'],
    ['claims', 'CLAIMS'],
  ];
  for (const [key, label] of listFields) {
    const arr = Array.isArray(facts[key]) ? facts[key].filter(Boolean) : [];
    if (arr.length) {
      const formatted = key === 'usage_steps'
        ? arr.map((v: string, i: number) => `${i + 1}. ${String(v)}`)
        : arr.map((v: string) => `- ${String(v)}`);
      lines.push(block(label, formatted));
    }
  }

  if (typeof facts.frequency === 'string' && facts.frequency.trim()) {
    lines.push(block('FREQUENCY', [facts.frequency.trim()]));
  }

  const evidenceLines = evidence
    .slice(0, 6)
    .map((e) => `- ${e.quote}${e.fact_key ? ` (${e.fact_key})` : ''}`);
  if (evidenceLines.length) {
    lines.push(block('EVIDENCE_QUOTES', evidenceLines));
  }

  return [`[PRODUCT_FACTS:${productName}]`, ...lines.filter(Boolean)].join('\n');
}

export async function getActiveProductFactsContext(
  merchantId: string,
  productIds: string[]
): Promise<ProductFactsContextResult> {
  const snapshots = await getActiveProductFactsSnapshots(merchantId, productIds);
  if (snapshots.length === 0) return { text: '', factCount: 0, productIds: [] };

  return {
    text: ['--- STRUCTURED PRODUCT FACTS (Highest Priority) ---', ...snapshots.map((s) =>
      formatFactSnapshot(
        s.productName,
        { id: s.id, product_id: s.productId, detected_language: s.detectedLanguage, facts_json: s.facts },
        s.evidence.map((e) => ({ product_fact_id: s.id, quote: e.quote, fact_key: e.factKey }))
      )
    )].join('\n\n'),
    factCount: snapshots.length,
    productIds: [...new Set(snapshots.map((s) => s.productId))],
  };
}

export async function getActiveProductFactsSnapshots(
  merchantId: string,
  productIds: string[]
): Promise<ProductFactSnapshot[]> {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return [];
  }

  const serviceClient = getSupabaseServiceClient();
  try {
    const uniqueProductIds = [...new Set(productIds)];
    const [{ data: factsRows, error: factsError }, { data: productsRows, error: productsError }] = await Promise.all([
      serviceClient
        .from('product_facts')
        .select('id, product_id, detected_language, facts_json')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .in('product_id', uniqueProductIds),
      serviceClient
        .from('products')
        .select('id, name')
        .eq('merchant_id', merchantId)
        .in('id', uniqueProductIds),
    ]);

    if (factsError) {
      // Table may not exist yet in some environments. Degrade gracefully.
      logger.warn({ factsError, merchantId }, 'product_facts query failed; skipping structured facts context');
      return [];
    }
    if (productsError) {
      logger.warn({ productsError, merchantId }, 'products lookup failed for product facts context');
      return [];
    }

    const facts = (factsRows || []) as ProductFactRow[];
    if (facts.length === 0) return [];

    const factIds = facts.map((f) => f.id);
    const { data: evidenceRows, error: evidenceError } = await serviceClient
      .from('product_fact_evidence')
      .select('product_fact_id, quote, fact_key')
      .in('product_fact_id', factIds);
    if (evidenceError) {
      logger.warn({ evidenceError, merchantId }, 'product_fact_evidence query failed; continuing without evidence');
    }

    const productNameById = new Map((productsRows || []).map((p: any) => [p.id, p.name || 'Product']));
    const evidenceByFactId = new Map<string, ProductFactEvidenceRow[]>();
    for (const e of (evidenceRows || []) as ProductFactEvidenceRow[]) {
      const arr = evidenceByFactId.get(e.product_fact_id) || [];
      arr.push(e);
      evidenceByFactId.set(e.product_fact_id, arr);
    }

    return facts.map((f) => ({
      id: f.id,
      productId: f.product_id,
      productName: productNameById.get(f.product_id) || 'Product',
      detectedLanguage: f.detected_language,
      facts: (f.facts_json || {}) as any,
      evidence: (evidenceByFactId.get(f.id) || []).map((e) => ({ quote: e.quote, factKey: e.fact_key })),
    }));
  } catch (error) {
    logger.warn({ error, merchantId }, 'Failed to build product facts context');
    return [];
  }
}
