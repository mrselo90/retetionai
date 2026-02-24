import crypto from 'node:crypto';
import type { ProductI18nSnapshot } from './types.js';

export function normalizeWhitespace(input: string): string {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sortJsonDeep(value: any): any {
  if (Array.isArray(value)) return value.map(sortJsonDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortJsonDeep(value[key]);
    }
    return out;
  }
  return value;
}

export function stableStringify(value: any): string {
  return JSON.stringify(sortJsonDeep(value));
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function buildSourceSnapshotHash(snapshot: ProductI18nSnapshot): string {
  const normalized: ProductI18nSnapshot = {
    title: normalizeWhitespace(snapshot.title || ''),
    description_html: normalizeWhitespace(snapshot.description_html || ''),
    specs_json: sortJsonDeep(snapshot.specs_json || {}),
    faq_json: sortJsonDeep(snapshot.faq_json || []),
  };
  return sha256(stableStringify(normalized));
}

export function stripHtmlToText(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildEmbeddingDocument(snapshot: ProductI18nSnapshot & { variant_lines?: string[] }): string {
  const lines: string[] = [];
  if (snapshot.title) lines.push(`Title: ${normalizeWhitespace(snapshot.title)}`);
  if (snapshot.description_html) lines.push(`Description: ${stripHtmlToText(snapshot.description_html)}`);
  const specs = snapshot.specs_json || {};
  const specLines = Object.entries(specs)
    .flatMap(([k, v]) => {
      if (v == null) return [];
      if (Array.isArray(v)) return [`${k}: ${v.map(String).join(', ')}`];
      if (typeof v === 'object') return [`${k}: ${stableStringify(v)}`];
      return [`${k}: ${String(v)}`];
    });
  if (specLines.length) lines.push('Specs:', ...specLines.slice(0, 30));
  const faqs = Array.isArray(snapshot.faq_json) ? snapshot.faq_json : [];
  if (faqs.length) {
    lines.push('FAQ:');
    for (const faq of faqs.slice(0, 10)) {
      if (!faq) continue;
      const q = typeof faq.question === 'string' ? faq.question : '';
      const a = typeof faq.answer === 'string' ? faq.answer : '';
      if (q || a) lines.push(`Q: ${q} A: ${a}`);
    }
  }
  if (Array.isArray(snapshot.variant_lines) && snapshot.variant_lines.length) {
    lines.push('Variants:', ...snapshot.variant_lines.slice(0, 20));
  }
  return normalizeWhitespace(lines.join('\n')).slice(0, 24000);
}

export function buildEmbeddingContentHash(doc: string): string {
  return sha256(normalizeWhitespace(doc));
}

export function normalizeLangCode(lang?: string | null): string {
  if (!lang) return 'en';
  const v = lang.trim().toLowerCase();
  if (v.startsWith('tr')) return 'tr';
  if (v.startsWith('hu')) return 'hu';
  if (v.startsWith('en')) return 'en';
  if (v.startsWith('de')) return 'de';
  if (v.startsWith('el')) return 'el';
  return v.slice(0, 8) || 'en';
}

