/**
 * RAG (Retrieval Augmented Generation) utilities
 * Shared result formatting and order-scoped product context resolution.
 */

import { getSupabaseServiceClient } from '@recete/shared';

export interface RAGResult {
  chunkId: string;
  productId: string;
  productName: string;
  productUrl: string;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
  sectionType?: string | null;
  languageCode?: string | null;
}

interface OrderScopeResolution {
  productIds: string[];
  chunks: RAGResult[];
  source: 'external_events' | 'merchant_fallback_legacy' | 'none';
}

function normalizeProductNameForMatch(name: string): string {
  return (name || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

/**
 * Format RAG results for LLM context
 */
export function formatRAGResultsForLLM(results: RAGResult[]): string {
  if (results.length === 0) {
    return 'No relevant product information found.';
  }

  const formatted = results
    .map((result, index) => {
      const section = result.sectionType ? `Section: ${result.sectionType}` : '';
      const url = result.productUrl ? `Source: ${result.productUrl}` : '';
      const metaLines = [section, url].filter(Boolean).join('\n');
      return `[${index + 1}] ${result.productName}
${metaLines ? `${metaLines}\n` : ''}${result.chunkText}
Similarity: ${(result.similarity * 100).toFixed(1)}%`;
    })
    .join('\n\n---\n\n');

  return `Relevant Product Information:\n\n${formatted}`;
}

/**
 * Get product context for a user's order
 * Retrieves all chunks for products in the order
 */
export async function getOrderProductContext(
  orderId: string,
  merchantId: string
): Promise<RAGResult[]> {
  const result = await getOrderProductContextResolved(orderId, merchantId);
  return result.chunks;
}

/**
 * Best-effort order-scoped product resolution.
 * Resolves products from external_events.payload.items[*].external_product_id when available.
 * Returns empty scope (instead of all merchant products) when order items cannot be resolved.
 */
export async function getOrderProductContextResolved(
  orderId: string,
  merchantId: string
): Promise<OrderScopeResolution> {
  const serviceClient = getSupabaseServiceClient();

  // Get order with products (from orders table, we need to join with items)
  // For MVP, we'll assume products are linked via external_product_id
  // This is a simplified version - in production, you'd have an order_items table

  const { data: order, error: orderError } = await serviceClient
    .from('orders')
    .select('id, merchant_id, user_id, external_order_id')
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  // Try to resolve product IDs from normalized event payload items
  let resolvedProductIds: string[] = [];
  try {
    const { data: events } = await serviceClient
      .from('external_events')
      .select('payload, received_at')
      .eq('merchant_id', order.merchant_id)
      .contains('payload', { external_order_id: (order as any).external_order_id })
      .order('received_at', { ascending: false })
      .limit(5);

    const eventItems = (events || []).flatMap((e: any) =>
      Array.isArray(e?.payload?.items) ? e.payload.items : []
    );

    const externalProductIds = Array.from(
      new Set(
        eventItems
          .map((i: any) => (typeof i?.external_product_id === 'string' ? i.external_product_id.trim() : ''))
          .filter(Boolean)
      )
    );

    if (externalProductIds.length > 0) {
      const { data: products } = await serviceClient
        .from('products')
        .select('id, external_id')
        .eq('merchant_id', order.merchant_id)
        .in('external_id', externalProductIds);

      resolvedProductIds = Array.from(new Set((products || []).map((p: any) => p.id)));
    }

    // Fallback for manual / CSV orders where external_product_id may be missing or not mapped.
    if (resolvedProductIds.length === 0) {
      const eventItemNames = Array.from(
        new Set(
          eventItems
            .map((i: any) => (typeof i?.name === 'string' ? i.name.trim() : ''))
            .filter(Boolean)
        )
      );

      if (eventItemNames.length > 0) {
        const { data: merchantProducts } = await serviceClient
          .from('products')
          .select('id, name')
          .eq('merchant_id', order.merchant_id)
          .limit(500);

        const requestedNames = new Set(eventItemNames.map(normalizeProductNameForMatch));
        resolvedProductIds = Array.from(
          new Set(
            (merchantProducts || [])
              .filter((p: any) => requestedNames.has(normalizeProductNameForMatch(String(p?.name || ''))))
              .map((p: any) => p.id)
          )
        );
      }
    }
  } catch {
    // Best-effort only. We'll return no scope rather than broadening incorrectly.
    resolvedProductIds = [];
  }

  if (resolvedProductIds.length === 0) {
    return { productIds: [], chunks: [], source: 'none' };
  }

  const { data: chunks, error: chunksError } = await serviceClient
    .from('knowledge_chunks')
    .select(
      `
      id,
      product_id,
      chunk_text,
      chunk_index,
      products!inner (
        id,
        name,
        url,
        merchant_id
      )
    `
    )
    .eq('products.merchant_id', order.merchant_id)
    .in('product_id', resolvedProductIds)
    .order('chunk_index', { ascending: true });

  if (chunksError) {
    throw new Error(`Failed to get product context: ${chunksError.message}`);
  }

  if (!chunks || chunks.length === 0) {
    return { productIds: resolvedProductIds, chunks: [], source: 'external_events' };
  }

  const mapped = chunks.map((chunk: any) => ({
    chunkId: chunk.id,
    productId: chunk.product_id,
    productName: chunk.products.name,
    productUrl: chunk.products.url,
    chunkText: chunk.chunk_text,
    chunkIndex: chunk.chunk_index,
    similarity: 1.0, // Not calculated for full context retrieval
  }));

  return { productIds: resolvedProductIds, chunks: mapped, source: 'external_events' };
}
