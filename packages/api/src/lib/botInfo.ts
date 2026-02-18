/**
 * Merchant bot info (guidelines, brand, recipes overview)
 * Injected into AI system prompt for customer Q&A.
 */

import { getSupabaseServiceClient } from '@recete/shared';

export type BotInfoKey =
  | 'brand_guidelines'
  | 'bot_boundaries'
  | 'recipe_overview'
  | 'custom_instructions'
  | string;

/**
 * Get all bot info key-value pairs for a merchant
 */
export async function getMerchantBotInfo(
  merchantId: string
): Promise<Record<string, string>> {
  const serviceClient = getSupabaseServiceClient();
  const { data: rows, error } = await serviceClient
    .from('merchant_bot_info')
    .select('key, value')
    .eq('merchant_id', merchantId);

  if (error || !rows) return {};
  return Object.fromEntries((rows as { key: string; value: string }[]).map((r) => [r.key, r.value || '']));
}

/**
 * Set one bot info key-value for a merchant (upsert)
 */
export async function setMerchantBotInfoKey(
  merchantId: string,
  key: string,
  value: string
): Promise<void> {
  const serviceClient = getSupabaseServiceClient();
  await serviceClient
    .from('merchant_bot_info')
    .upsert(
      { merchant_id: merchantId, key, value },
      { onConflict: 'merchant_id,key', ignoreDuplicates: false }
    );
}
