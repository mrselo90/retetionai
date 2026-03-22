import type { ProductI18nSnapshot } from './types.js';

export function buildProductI18nSourceSnapshot(product: any): ProductI18nSnapshot {
  const instructionParts = [
    product?.product_instructions?.usage_instructions,
    product?.product_instructions?.recipe_summary,
    product?.product_instructions?.prevention_tips,
  ].filter((v) => typeof v === 'string' && v.trim().length > 0) as string[];
  const descriptionParts = [product.enriched_text, product.raw_text]
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .map(String);
  if (instructionParts.length) {
    descriptionParts.push(`<section><h3>Instructions</h3><p>${instructionParts.join('\n\n')}</p></section>`);
  }
  return {
    title: product.name || 'Product',
    description_html: descriptionParts.join('\n\n'),
    specs_json: {
      ...((product.multilang_specs_json && typeof product.multilang_specs_json === 'object') ? product.multilang_specs_json : {}),
      ...(product?.product_instructions?.usage_instructions ? { usage_instructions: product.product_instructions.usage_instructions } : {}),
      ...(product?.product_instructions?.prevention_tips ? { prevention_tips: product.product_instructions.prevention_tips } : {}),
    },
    faq_json: Array.isArray(product.multilang_faq_json) ? product.multilang_faq_json : [],
  };
}
