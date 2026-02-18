'use client';
import { useEffect, useState } from 'react';
import { Provider } from '@shopify/app-bridge-react';

interface ShopifyProviderProps {
  children: React.ReactNode;
}

export function ShopifyProvider({ children }: ShopifyProviderProps) {
  const [mounted, setMounted] = useState(false);

  // Get config from URL if available (standard for embedded apps)
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const shop = urlParams?.get('shop') || undefined;
  const host = urlParams?.get('host') || undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  // If we have API key and host/shop (embedded context), initialize App Bridge
  // Otherwise render children directly (standalone / local dev)
  if (mounted && apiKey && (host || shop)) {
    return (
      <Provider
        apiKey={apiKey}
        i18n={{}}
        config={{
          apiKey,
          host: host || btoa(shop || ''),
          forceRedirect: false // Don't redirect locally during dev
        }}
      >
        {children}
      </Provider>
    );
  }

  return <>{children}</>;
}
