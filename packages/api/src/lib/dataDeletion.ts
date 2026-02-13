import { getSupabaseServiceClient } from '@glowguide/shared';
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
