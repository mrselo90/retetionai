'use client';

/**
 * Shopify App Bridge Provider
 * Wraps the app with Shopify App Bridge context
 * Note: Shopify App Bridge is optional - app works without it
 */

import { useEffect, useState } from 'react';
import { getAppBridgeConfig } from '../lib/shopifyAppBridge';

interface ShopifyProviderProps {
  children: React.ReactNode;
}

export function ShopifyProvider({ children }: ShopifyProviderProps) {
  const [config, setConfig] = useState<{ apiKey: string; shop?: string } | null>(null);

  useEffect(() => {
    try {
      const appConfig = getAppBridgeConfig();
      setConfig(appConfig);
    } catch (error) {
      // Not in Shopify context, continue without App Bridge
      // This is expected when running locally
    }
  }, []);

  // Always render children - Shopify App Bridge integration is optional
  // The app works fine without it for local development
  return <>{children}</>;
}
