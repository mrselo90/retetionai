/**
 * Authentication utilities
 * Merchant authentication and API key management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables for auth');
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
 * Generate API key for merchant
 * Format: gg_live_<random_32_chars>
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `gg_live_${randomBytes}`;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return /^gg_live_[a-f0-9]{32}$/.test(apiKey);
}

/**
 * Hash API key for storage (one-way hash)
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Verify API key against hash
 */
export function verifyApiKey(apiKey: string, hash: string): boolean {
  const computedHash = hashApiKey(apiKey);
  return computedHash === hash;
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
