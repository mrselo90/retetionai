import { getSupabaseServiceClient, logger } from '@recete/shared';
import type { ProductFacts } from './llm/productFacts.js';

export interface PersistProductFactsInput {
  productId: string;
  merchantId: string;
  facts: ProductFacts;
  sourceUrl?: string;
  sourceType?: string;
  extractionModel?: string;
  validationErrors?: string[];
}

export async function persistProductFactsSnapshot(input: PersistProductFactsInput): Promise<string | null> {
  const serviceClient = getSupabaseServiceClient();

  try {
    // Deactivate prior active snapshot (if any)
    await serviceClient
      .from('product_facts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('product_id', input.productId)
      .eq('merchant_id', input.merchantId)
      .eq('is_active', true);

    const validationErrors = input.validationErrors || [];
    const { data: factRow, error: insertError } = await serviceClient
      .from('product_facts')
      .insert({
        product_id: input.productId,
        merchant_id: input.merchantId,
        schema_version: input.facts.schema_version ?? 1,
        detected_language: input.facts.detected_language,
        facts_json: input.facts as any,
        source_type: input.sourceType || 'scrape_enrich',
        source_url: input.sourceUrl || null,
        extraction_model: input.extractionModel || 'gpt-4o-mini',
        validation_status: validationErrors.length ? 'invalid' : 'validated',
        validation_errors: validationErrors,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !factRow?.id) {
      throw new Error(insertError?.message || 'Failed to insert product facts');
    }

    const evidenceQuotes = Array.isArray(input.facts.evidence_quotes)
      ? input.facts.evidence_quotes.filter((q) => typeof q === 'string' && q.trim())
      : [];
    if (evidenceQuotes.length > 0) {
      const { error: evError } = await serviceClient.from('product_fact_evidence').insert(
        evidenceQuotes.slice(0, 16).map((quote) => ({
          product_fact_id: factRow.id,
          product_id: input.productId,
          merchant_id: input.merchantId,
          fact_key: 'general',
          quote,
          quote_language: input.facts.detected_language || null,
        }))
      );
      if (evError) {
        logger.error({ evError, productId: input.productId }, 'Failed to insert product fact evidence');
      }
    }

    return factRow.id;
  } catch (error) {
    logger.error({ error, productId: input.productId, merchantId: input.merchantId }, 'Failed to persist product facts snapshot');
    return null;
  }
}

