import { getSupabaseServiceClient } from '@recete/shared';

/**
 * Export all merchant data
 */
export async function exportMerchantData(merchantId: string): Promise<{
  merchant: any;
  integrations: any[];
  products: any[];
  users: any[];
  orders: any[];
  conversations: any[];
  analytics_events: any[];
  exported_at: string;
}> {
  const supabase = getSupabaseServiceClient();

  // Export merchant data
  const { data: merchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', merchantId)
    .single();

  // Export integrations
  const { data: integrations } = await supabase
    .from('integrations')
    .select('*')
    .eq('merchant_id', merchantId);

  // Export products
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('merchant_id', merchantId);

  // Export users (without encrypted phone numbers - export as masked)
  const { data: users } = await supabase
    .from('users')
    .select('id, merchant_id, name, consent_status, created_at, updated_at')
    .eq('merchant_id', merchantId);

  // Export orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('merchant_id', merchantId);

  // Export conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('merchant_id', merchantId);

  // Export analytics events (last 2 years)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const { data: analytics_events } = await supabase
    .from('analytics_events')
    .select('*')
    .eq('merchant_id', merchantId)
    .gte('created_at', twoYearsAgo.toISOString());

  return {
    merchant: merchant || null,
    integrations: integrations || [],
    products: products || [],
    users: (users || []).map((u) => ({
      ...u,
      phone: '[REDACTED - Encrypted]', // Don't export encrypted phone numbers
    })),
    orders: orders || [],
    conversations: conversations || [],
    analytics_events: analytics_events || [],
    exported_at: new Date().toISOString(),
  };
}

/**
 * Export user data (for end users)
 */
export async function exportUserData(userId: string): Promise<{
  user: any;
  orders: any[];
  conversations: any[];
  exported_at: string;
}> {
  const supabase = getSupabaseServiceClient();

  // Export user data (without encrypted phone)
  const { data: user } = await supabase
    .from('users')
    .select('id, merchant_id, name, consent_status, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (!user) {
    throw new Error('User not found');
  }

  // Export user's orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId);

  // Export user's conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId);

  return {
    user: {
      ...user,
      phone: '[REDACTED - Encrypted]', // Don't export encrypted phone
    },
    orders: orders || [],
    conversations: conversations || [],
    exported_at: new Date().toISOString(),
  };
}
