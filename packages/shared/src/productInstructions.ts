/**
 * Product instructions lookup for workers (T+0 beauty consultant).
 * Uses Supabase service client; used by workers package.
 */

import { getSupabaseServiceClient } from './supabase.js';

export interface ProductInstructionRow {
  product_id: string;
  product_name?: string;
  external_id?: string;
  usage_instructions: string;
  recipe_summary: string | null;
  video_url?: string | null;
  prevention_tips?: string | null;
}

/**
 * Get usage instructions for products by Shopify external IDs (e.g. from event.items[].external_product_id).
 * Returns array of instructions; products without instructions are omitted.
 */
export async function getUsageInstructionsForProductIds(
  merchantId: string,
  externalProductIds: string[]
): Promise<ProductInstructionRow[]> {
  if (externalProductIds.length === 0) return [];

  const serviceClient = getSupabaseServiceClient();

  const { data: products, error: productsError } = await serviceClient
    .from('products')
    .select('id, name, external_id')
    .eq('merchant_id', merchantId)
    .in('external_id', externalProductIds);

  if (productsError || !products || products.length === 0) return [];

  const productIds = products.map((p: { id: string }) => p.id);
  const productMap = new Map(products.map((p: { id: string; name?: string; external_id?: string }) => [p.id, p]));

  const { data: instructions, error: instructionsError } = await serviceClient
    .from('product_instructions')
    .select('product_id, usage_instructions, recipe_summary')
    .eq('merchant_id', merchantId)
    .in('product_id', productIds);

  if (instructionsError || !instructions) return [];

  return instructions.map((row: { product_id: string; usage_instructions: string; recipe_summary: string | null }) => {
    const product = productMap.get(row.product_id) as { name?: string; external_id?: string } | undefined;
    return {
      product_id: row.product_id,
      product_name: product?.name,
      external_id: product?.external_id ?? undefined,
      usage_instructions: row.usage_instructions,
      recipe_summary: row.recipe_summary ?? null,
    };
  });
}

/**
 * Get usage instructions for products by internal product IDs (e.g. from order product context).
 * Used by AI agent RAG to include recipes in answer context.
 */
export async function getProductInstructionsByProductIds(
  merchantId: string,
  productIds: string[]
): Promise<ProductInstructionRow[]> {
  if (productIds.length === 0) return [];

  const serviceClient = getSupabaseServiceClient();

  const { data: instructions, error } = await serviceClient
    .from('product_instructions')
    .select('product_id, usage_instructions, recipe_summary, video_url, prevention_tips')
    .eq('merchant_id', merchantId)
    .in('product_id', productIds);

  if (error || !instructions) return [];

  const { data: products } = await serviceClient
    .from('products')
    .select('id, name, external_id')
    .eq('merchant_id', merchantId)
    .in('id', productIds);

  const productMap = new Map((products || []).map((p: { id: string; name?: string; external_id?: string }) => [p.id, p]));

  return instructions.map((row: any) => {
    const product = productMap.get(row.product_id);
    return {
      product_id: row.product_id,
      product_name: product?.name,
      external_id: product?.external_id ?? undefined,
      usage_instructions: row.usage_instructions,
      recipe_summary: row.recipe_summary ?? null,
      video_url: row.video_url ?? null,
      prevention_tips: row.prevention_tips ?? null,
    };
  });
}
