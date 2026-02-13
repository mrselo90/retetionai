/**
 * Authentication middleware for Hono
 * Validates merchant authentication via JWT or API key
 */

import { Context, Next } from 'hono';
import { getSupabaseServiceClient } from '@glowguide/shared';
import { isValidApiKeyFormat, hashApiKey } from '@glowguide/shared';
import {
  normalizeApiKeys,
  getApiKeyByHash,
  isApiKeyExpired,
  updateApiKeyLastUsed,
} from '../lib/apiKeyManager.js';

export interface AuthContext {
  merchantId: string;
  authMethod: 'jwt' | 'api_key';
}

/**
 * Extract token from Authorization header
 */
function extractToken(header: string | undefined): string | null {
  if (!header) return null;
  
  // Bearer token format
  if (header.startsWith('Bearer ')) {
    return header.substring(7);
  }
  
  // API key format (can be in header or as Bearer)
  return header;
}

/**
 * Authenticate via JWT (Supabase Auth).
 * For OAuth (e.g. Google) users: create merchant if missing (first-time social login).
 */
async function authenticateJWT(token: string): Promise<string | null> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    let { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', user.id)
      .single();

    // First-time OAuth user: create merchant so they can use the app
    if (!merchant) {
      const name =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        (user.email ?? 'Merchant');
      const { data: inserted } = await supabase
        .from('merchants')
        .insert({
          id: user.id,
          name: typeof name === 'string' ? name.slice(0, 255) : 'Merchant',
          api_keys: [],
        })
        .select('id')
        .single();
      merchant = inserted;
    }

    return merchant?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Authenticate via API key
 */
async function authenticateApiKey(apiKey: string): Promise<string | null> {
  if (!isValidApiKeyFormat(apiKey)) {
    return null;
  }
  
  try {
    const supabase = getSupabaseServiceClient();
    const hashedKey = hashApiKey(apiKey);
    
    // Query merchants where api_keys array contains the hashed key
    // Using JSONB contains operator (@>)
    const { data: merchants, error } = await supabase
      .from('merchants')
      .select('id, api_keys')
      .contains('api_keys', [hashedKey])
      .limit(1);
    
    if (error || !merchants || merchants.length === 0) {
      return null;
    }
    
    const merchant = merchants[0];
    
    // Normalize and check if key is expired
    const normalizedKeys = normalizeApiKeys((merchant.api_keys as any) || []);
    const keyObject = getApiKeyByHash(normalizedKeys, hashedKey);
    
    if (!keyObject) {
      return null;
    }
    
    // Check if key is expired
    if (isApiKeyExpired(keyObject)) {
      return null;
    }
    
    // Update last used timestamp (async, don't wait)
    const updatedKeys = updateApiKeyLastUsed(normalizedKeys, hashedKey);
    void supabase
      .from('merchants')
      .update({ api_keys: updatedKeys })
      .eq('id', merchant.id);
    
    return merchant.id;
  } catch {
    return null;
  }
}

/**
 * Auth middleware
 * Supports both JWT (Supabase Auth) and API key authentication
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);
  
  if (!token) {
    return c.json({ error: 'Unauthorized: Missing authentication' }, 401);
  }
  
  // Try JWT first (Supabase Auth)
  let merchantId = await authenticateJWT(token);
  let authMethod: 'jwt' | 'api_key' = 'jwt';
  
  // If JWT fails, try API key
  if (!merchantId) {
    merchantId = await authenticateApiKey(token);
    authMethod = 'api_key';
  }
  
  if (!merchantId) {
    return c.json({ error: 'Unauthorized: Invalid token or API key' }, 401);
  }
  
  // Add merchant context to request
  c.set('merchantId', merchantId);
  c.set('authMethod', authMethod);
  
  await next();
}

/**
 * Optional auth middleware (doesn't fail if no auth provided)
 * Useful for public endpoints that can optionally use auth
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);
  
  if (token) {
    // Try to authenticate
    let merchantId = await authenticateJWT(token);
    let authMethod: 'jwt' | 'api_key' = 'jwt';
    
    if (!merchantId) {
      merchantId = await authenticateApiKey(token);
      authMethod = 'api_key';
    }
    
    if (merchantId) {
      c.set('merchantId', merchantId);
      c.set('authMethod', authMethod);
    }
  }
  
  await next();
}
