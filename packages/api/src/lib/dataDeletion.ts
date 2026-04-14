import { getSupabaseServiceClient } from '@recete/shared';
import { decryptPhone } from './encryption.js';

/**
 * Soft delete merchant data (30-day grace period)
 * Marks data for deletion but keeps it for 30 days
 */
export async function softDeleteMerchantData(merchantId: string): Promise<{
  deleted: boolean;
  deletion_scheduled_at: string;
  permanent_deletion_at: string;
}> {
  const supabase = getSupabaseServiceClient();

  const deletionScheduledAt = new Date();
  const permanentDeletionAt = new Date();
  permanentDeletionAt.setDate(permanentDeletionAt.getDate() + 30); // 30-day grace period

  // Mark merchant for deletion
  const { error } = await supabase
    .from('merchants')
    .update({
      deleted_at: deletionScheduledAt.toISOString(),
      // Store permanent deletion date in a JSONB field or separate table
      // For now, we'll use a metadata field
    })
    .eq('id', merchantId);

  if (error) {
    throw new Error(`Failed to schedule deletion: ${error.message}`);
  }

  // FUTURE: Schedule a background job to permanently delete after 30 days
  // This should be handled by a worker process that runs daily to check for
  // merchants with deleted_at > 30 days ago and calls permanentlyDeleteMerchantData()
  // For MVP, permanent deletion can be triggered manually via GDPR endpoint

  return {
    deleted: true,
    deletion_scheduled_at: deletionScheduledAt.toISOString(),
    permanent_deletion_at: permanentDeletionAt.toISOString(),
  };
}

/**
 * Permanently delete merchant data
 * WARNING: This is irreversible!
 */
export async function permanentlyDeleteMerchantData(merchantId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  // Delete in order (respecting foreign key constraints)
  // 1. Analytics events
  await supabase.from('analytics_events').delete().eq('merchant_id', merchantId);

  // 1b. WhatsApp inbox/outbox audit data
  await supabase.from('whatsapp_outbound_events').delete().eq('merchant_id', merchantId);
  await supabase.from('whatsapp_inbound_events').delete().eq('merchant_id', merchantId);

  // 1c. Product instructions and sync metadata
  await supabase.from('product_instructions').delete().eq('merchant_id', merchantId);
  await supabase.from('sync_jobs').delete().eq('merchant_id', merchantId);

  // 2. Conversations
  await supabase.from('conversations').delete().eq('merchant_id', merchantId);

  // 3. Orders
  await supabase.from('orders').delete().eq('merchant_id', merchantId);

  // 4. Users
  await supabase.from('users').delete().eq('merchant_id', merchantId);

  // 5. Products and knowledge chunks
  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('merchant_id', merchantId);

  if (products) {
    const productIds = products.map((p) => p.id);
    await supabase.from('knowledge_chunks').delete().in('product_id', productIds);
    await supabase.from('products').delete().eq('merchant_id', merchantId);
  }

  // 6. Integrations
  await supabase.from('integrations').delete().eq('merchant_id', merchantId);

  // 7. External events
  await supabase.from('external_events').delete().eq('merchant_id', merchantId);

  // 8. Scheduled tasks
  await supabase.from('scheduled_tasks').delete().eq('merchant_id', merchantId);

  // 9. Finally, delete merchant
  await supabase.from('merchants').delete().eq('id', merchantId);
}

/**
 * Clear merchant operational data while preserving the merchant record itself.
 * This is intended for admin reset flows where merchant identity/bootstrap must stay.
 */
export async function clearMerchantDataKeepMerchant(merchantId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id')
    .eq('merchant_id', merchantId);
  if (productsError) {
    throw new Error(`Failed to load merchant products: ${productsError.message}`);
  }
  const productIds = (products || []).map((p) => String(p.id));

  const { data: facts, error: factsError } = await supabase
    .from('product_facts')
    .select('id')
    .eq('merchant_id', merchantId);
  if (factsError && factsError.code !== '42P01') {
    throw new Error(`Failed to load product facts: ${factsError.message}`);
  }
  const factIds = (facts || []).map((f: any) => String(f.id));

  // Child rows first
  if (factIds.length > 0) {
    const { error } = await supabase.from('product_fact_evidence').delete().in('product_fact_id', factIds);
    if (error && error.code !== '42P01') throw new Error(`Failed to delete product_fact_evidence: ${error.message}`);
  }

  if (productIds.length > 0) {
    const { error: chunksError } = await supabase.from('knowledge_chunks').delete().in('product_id', productIds);
    if (chunksError && chunksError.code !== '42P01') {
      throw new Error(`Failed to delete knowledge_chunks: ${chunksError.message}`);
    }
    const { error: i18nChunksError } = await supabase.from('knowledge_chunks_i18n').delete().in('product_id', productIds);
    if (i18nChunksError && i18nChunksError.code !== '42P01') {
      throw new Error(`Failed to delete knowledge_chunks_i18n: ${i18nChunksError.message}`);
    }
    const { error: productI18nError } = await supabase.from('product_i18n').delete().in('product_id', productIds);
    if (productI18nError && productI18nError.code !== '42P01') {
      throw new Error(`Failed to delete product_i18n: ${productI18nError.message}`);
    }
  }

  // Merchant-scoped operational tables
  const merchantScopedTables = [
    'analytics_events',
    'ai_usage_events',
    'delivery_template_events',
    'feedback_requests',
    'return_prevention_attempts',
    'whatsapp_outbound_events',
    'whatsapp_inbound_events',
    'product_instructions',
    'sync_jobs',
    'conversations',
    'orders',
    'users',
    'products',
    'product_facts',
    'integrations',
    'external_events',
    'scheduled_tasks',
    'usage_tracking',
    'gdpr_exports',
    'gdpr_jobs',
    'merchant_addons',
    'merchant_bot_info',
    'merchant_members',
    'platform_ai_settings',
    'shop_settings',
    'subscription_plans',
  ] as const;

  for (const table of merchantScopedTables) {
    const { error } = await supabase.from(table).delete().eq('merchant_id', merchantId);
    if (error && error.code !== '42P01') {
      throw new Error(`Failed to delete ${table}: ${error.message}`);
    }
  }

  // Reset merchant mutable settings/billing flags but preserve merchant identity.
  const { error: merchantUpdateError } = await supabase
    .from('merchants')
    .update({
      persona_settings: {},
      notification_phone: null,
      guardrail_settings: { custom_guardrails: [] },
      subscription_status: 'inactive',
      subscription_plan: null,
      trial_ends_at: null,
      deleted_at: null,
    })
    .eq('id', merchantId);

  if (merchantUpdateError) {
    throw new Error(`Failed to reset merchant settings: ${merchantUpdateError.message}`);
  }
}

/**
 * Soft delete user data
 */
export async function softDeleteUserData(userId: string): Promise<{
  deleted: boolean;
  deletion_scheduled_at: string;
  permanent_deletion_at: string;
}> {
  const supabase = getSupabaseServiceClient();

  const deletionScheduledAt = new Date();
  const permanentDeletionAt = new Date();
  permanentDeletionAt.setDate(permanentDeletionAt.getDate() + 30);

  // Mark user for deletion
  const { error } = await supabase
    .from('users')
    .update({
      deleted_at: deletionScheduledAt.toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to schedule deletion: ${error.message}`);
  }

  return {
    deleted: true,
    deletion_scheduled_at: deletionScheduledAt.toISOString(),
    permanent_deletion_at: permanentDeletionAt.toISOString(),
  };
}

/**
 * Permanently delete user data
 */
export async function permanentlyDeleteUserData(userId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  // Delete conversations
  await supabase.from('conversations').delete().eq('user_id', userId);

  // Delete orders
  await supabase.from('orders').delete().eq('user_id', userId);

  // Delete user
  await supabase.from('users').delete().eq('id', userId);
}
