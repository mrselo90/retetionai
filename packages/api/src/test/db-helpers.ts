/**
 * Database Test Helpers
 * Utilities for database testing and cleanup
 */

import { getSupabaseServiceClient } from '@recete/shared';
import { createTestMerchant, createTestProduct, createTestUser, createTestOrder } from './fixtures';

// ============================================================================
// Database Setup & Teardown
// ============================================================================

/**
 * Clean up test data
 */
export async function cleanupTestData(merchantId: string) {
  const supabase = getSupabaseServiceClient();

  // Delete in reverse order of dependencies
  await supabase.from('scheduled_tasks').delete().eq('merchant_id', merchantId);
  await supabase.from('external_events').delete().eq('merchant_id', merchantId);
  await supabase.from('analytics_events').delete().eq('merchant_id', merchantId);
  await supabase.from('conversations').delete().eq('merchant_id', merchantId);
  await supabase.from('knowledge_chunks').delete().eq('merchant_id', merchantId);
  await supabase.from('orders').delete().eq('merchant_id', merchantId);
  await supabase.from('users').delete().eq('merchant_id', merchantId);
  await supabase.from('products').delete().eq('merchant_id', merchantId);
  await supabase.from('integrations').delete().eq('merchant_id', merchantId);
  await supabase.from('merchants').delete().eq('id', merchantId);
}

/**
 * Create test merchant in database
 */
export async function createTestMerchantInDB(overrides?: Partial<any>) {
  const merchant = createTestMerchant(overrides);
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from('merchants')
    .insert(merchant)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test merchant: ${error.message}`);
  }

  return data;
}

/**
 * Create test product in database
 */
export async function createTestProductInDB(merchantId: string, overrides?: Partial<any>) {
  const product = createTestProduct(merchantId, overrides);
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test product: ${error.message}`);
  }

  return data;
}

/**
 * Create test user in database
 */
export async function createTestUserInDB(merchantId: string, overrides?: Partial<any>) {
  const user = createTestUser(merchantId, overrides);
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from('users')
    .insert(user)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return data;
}

/**
 * Create test order in database
 */
export async function createTestOrderInDB(merchantId: string, userId: string, overrides?: Partial<any>) {
  const order = createTestOrder(merchantId, userId, overrides);
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test order: ${error.message}`);
  }

  return data;
}

/**
 * Reset test database (use with caution)
 */
export async function resetTestDatabase() {
  const supabase = getSupabaseServiceClient();

  // Delete all test data (merchants with test prefix)
  await supabase.from('scheduled_tasks').delete().like('merchant_id', 'test-%');
  await supabase.from('external_events').delete().like('merchant_id', 'test-%');
  await supabase.from('analytics_events').delete().like('merchant_id', 'test-%');
  await supabase.from('conversations').delete().like('merchant_id', 'test-%');
  await supabase.from('knowledge_chunks').delete().like('merchant_id', 'test-%');
  await supabase.from('orders').delete().like('merchant_id', 'test-%');
  await supabase.from('users').delete().like('merchant_id', 'test-%');
  await supabase.from('products').delete().like('merchant_id', 'test-%');
  await supabase.from('integrations').delete().like('merchant_id', 'test-%');
  await supabase.from('merchants').delete().like('id', 'test-%');
}
