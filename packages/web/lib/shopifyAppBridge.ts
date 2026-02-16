/**
 * Shopify App Bridge utilities
 * Handles session token verification and App Bridge configuration
 * API route: /api/integrations/shopify/verify-session
 */

import { getApiUrl } from '@/lib/api';

/**
 * Verify Shopify session token
 * This is called by the API to verify tokens from App Bridge
 */
export async function verifyShopifySessionToken(
  token: string,
  shop: string
): Promise<{ valid: boolean; merchantId?: string; error?: string }> {
  try {
    const response = await fetch(getApiUrl('/api/integrations/shopify/verify-session'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, shop }),
    });

    if (!response.ok) {
      return { valid: false, error: 'Token verification failed' };
    }

    const data = await response.json();
    return { valid: true, merchantId: data.merchantId };
  } catch (error) {
    return { valid: false, error: 'Token verification error' };
  }
}

/**
 * Get App Bridge configuration
 */
export function getAppBridgeConfig() {
  const shop = typeof window !== 'undefined' 
    ? new URLSearchParams(window.location.search).get('shop') 
    : null;
  
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_SHOPIFY_API_KEY is not configured');
  }
  
  return {
    apiKey,
    shop: shop || undefined,
  };
}
