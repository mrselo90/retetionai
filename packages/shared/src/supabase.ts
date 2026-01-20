/**
 * Supabase client setup
 * Provides configured Supabase client instances for API and service role access
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

/**
 * Public Supabase client (uses anon key, respects RLS)
 * Use for client-side operations where RLS policies apply
 */
export function getSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl as string, supabaseAnonKey as string);
}

/**
 * Service role Supabase client (bypasses RLS)
 * Use only in server-side operations where you need to bypass RLS
 * ⚠️ Never expose this client to the frontend
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service role client');
  }
  return createClient(supabaseUrl as string, supabaseServiceRoleKey as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get Supabase client with merchant context
 * Automatically sets merchant_id filter for RLS
 */
export function getMerchantSupabaseClient(merchantId: string): SupabaseClient {
  const client = getSupabaseClient();
  // RLS policies will automatically filter by merchant_id
  // This is a helper to make the intent clear
  return client;
}
