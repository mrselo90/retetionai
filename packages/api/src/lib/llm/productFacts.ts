import { z } from 'zod';

export const ProductFactSchema = z.object({
  schema_version: z.number().int().default(1),
  detected_language: z.enum(['tr', 'en', 'hu']).catch('en'),
  product_identity: z.object({
    title: z.string().min(1),
    brand: z.string().optional().nullable(),
    product_type: z.string().optional().nullable(),
    variant: z.string().optional().nullable(),
    volume_value: z.number().optional().nullable(),
    volume_unit: z.string().optional().nullable(),
  }),
  target_skin_types: z.array(z.string()).default([]),
  ingredients: z.array(z.string()).default([]),
  active_ingredients: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  usage_steps: z.array(z.string()).default([]),
  frequency: z.string().optional().nullable(),
  warnings: z.array(z.string()).default([]),
  claims: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
  evidence_quotes: z.array(z.string()).default([]),
});

export type ProductFacts = z.infer<typeof ProductFactSchema>;

export interface EnrichProductResult {
  enrichedText: string;
  facts: ProductFacts | null;
  factsValidationErrors?: string[];
  enrichmentMode: 'structured_facts' | 'summary_fallback' | 'raw_fallback';
}

export function tryParseProductFacts(text: string): ProductFacts | null {
  const json = extractJsonObject(text);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    const normalized = ProductFactSchema.parse(parsed);
    return normalized;
  } catch {
    return null;
  }
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function section(label: string, lines: string[]): string {
  if (!lines.length) return '';
  return [`[SECTION:${label}]`, ...lines].join('\n');
}

export function formatProductFactsForRAG(facts: ProductFacts): string {
  const identity = facts.product_identity;
  const out: string[] = [];
  out.push('[PRODUCT_FACTS]');
  out.push(`[LANG:${facts.detected_language}]`);

  const identityLines = [
    `Title: ${identity.title}`,
    identity.brand ? `Brand: ${identity.brand}` : '',
    identity.product_type ? `Type: ${identity.product_type}` : '',
    identity.variant ? `Variant: ${identity.variant}` : '',
    identity.volume_value != null && identity.volume_unit
      ? `Volume: ${identity.volume_value} ${identity.volume_unit}`
      : '',
  ].filter(Boolean) as string[];
  out.push(section('IDENTITY', identityLines));

  out.push(section('SKIN_TYPES', facts.target_skin_types.map((v) => `- ${v}`)));
  out.push(section('BENEFITS', facts.benefits.map((v) => `- ${v}`)));
  out.push(section('INGREDIENTS', facts.ingredients.map((v) => `- ${v}`)));
  out.push(section('ACTIVE_INGREDIENTS', facts.active_ingredients.map((v) => `- ${v}`)));

  const usageLines = [...facts.usage_steps.map((v, i) => `${i + 1}. ${v}`)];
  if (facts.frequency) usageLines.push(`Frequency: ${facts.frequency}`);
  out.push(section('USAGE', usageLines));

  out.push(section('WARNINGS', facts.warnings.map((v) => `- ${v}`)));
  out.push(section('CLAIMS', facts.claims.map((v) => `- ${v}`)));
  out.push(section('UNKNOWNS', facts.unknowns.map((v) => `- ${v}`)));
  out.push(section('EVIDENCE', facts.evidence_quotes.slice(0, 8).map((v) => `- ${v}`)));

  return out.filter(Boolean).join('\n\n').trim();
}

export function validateProductFactsBusinessRules(facts: ProductFacts): string[] {
  const errors: string[] = [];
  if (!facts.product_identity.title?.trim()) errors.push('Missing product title');
  if (
    facts.product_identity.volume_value != null &&
    facts.product_identity.volume_value <= 0
  ) {
    errors.push('Invalid volume_value');
  }
  if (
    facts.product_identity.volume_unit &&
    !/^(ml|mL|g|kg|oz|l|L)$/i.test(facts.product_identity.volume_unit)
  ) {
    errors.push('Unexpected volume_unit');
  }
  return errors;
}
