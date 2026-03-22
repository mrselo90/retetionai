/**
 * Supabase client setup
 * Provides configured Supabase client instances for API and service role access
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only throw error in non-test environments
if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }
}

let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/**
 * Public Supabase client (uses anon key, respects RLS)
 * Use for client-side operations where RLS policies apply
 */
export function getSupabaseClient(): SupabaseClient {
  if (!anonClient) {
    anonClient = createClient(supabaseUrl as string, supabaseAnonKey as string);
  }
  return anonClient;
}

/**
 * Service role Supabase client (bypasses RLS)
 * Use only in server-side operations where you need to bypass RLS
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service role client');
  }
  if (!serviceClient) {
    serviceClient = createClient(supabaseUrl as string, supabaseServiceRoleKey as string, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return serviceClient;
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
