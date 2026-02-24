/**
 * Authentication utilities
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Only throw error in non-test environments
if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Missing Supabase environment variables for auth');
  }
}

/**
 * Get Supabase client for authentication
 * Uses anon key, respects RLS
 */
export function getAuthClient(): SupabaseClient {
  return createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}

/**
 * Extract merchant ID from JWT token (Supabase Auth)
 */
export function getMerchantIdFromToken(token: string): string | null {
  try {
    // Supabase JWT structure: { sub: user_id, ... }
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}
