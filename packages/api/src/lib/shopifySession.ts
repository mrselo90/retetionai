/**
 * Shopify Session Token Verification
 * Verifies session tokens from Shopify App Bridge
 */

import crypto from 'crypto';
import { getSupabaseServiceClient, logger } from '@recete/shared';

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

/**
 * Verify Shopify session token
 * Shopify App Bridge sends session tokens that need to be verified
 */
export async function verifyShopifySessionToken(
  token: string,
  shop: string
): Promise<{ valid: boolean; merchantId?: string; error?: string }> {
  if (!SHOPIFY_API_SECRET) {
    logger.error('SHOPIFY_API_SECRET not configured');
    return { valid: false, error: 'Server configuration error' };
  }

  try {
    // Decode and verify the session token
    // Shopify session tokens are JWT-like but use HMAC
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [header, payload, signature] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', SHOPIFY_API_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid token signature' };
    }

    // Decode payload
    const decodedPayload = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8')
    );

    // Verify shop matches
    if (decodedPayload.dest !== `https://${shop}`) {
      return { valid: false, error: 'Shop mismatch' };
    }

    // Verify expiration
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      return { valid: false, error: 'Token expired' };
    }

    // Find merchant by Shopify shop
    const serviceClient = getSupabaseServiceClient();
    const { data: integration } = await serviceClient
      .from('integrations')
      .select('merchant_id')
      .eq('provider', 'shopify')
      .eq('status', 'active')
      .single();

    if (!integration) {
      return { valid: false, error: 'Shopify integration not found' };
    }

    return {
      valid: true,
      merchantId: integration.merchant_id,
    };
  } catch (error) {
    logger.error({ error, shop }, 'Error verifying Shopify session token');
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Note: Shopify actually uses a different session token format
 * This is a simplified implementation. For production, use:
 * - @shopify/session-token package
 * - Or verify according to Shopify's official documentation
 */
