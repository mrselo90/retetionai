'use client';

import Script from 'next/script';
import { AppProvider as PolarisProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import enTranslations from '@shopify/polaris/locales/en.json';

interface ShopifyProviderProps {
  children: React.ReactNode;
}

export function ShopifyProvider({ children }: ShopifyProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

  const i18n = enTranslations;

  if (!apiKey) {
    return <PolarisProvider i18n={i18n}>{children}</PolarisProvider>;
  }

  return (
    <PolarisProvider i18n={i18n}>
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        strategy="beforeInteractive"
        data-api-key={apiKey}
      />
      {children}
    </PolarisProvider>
  );
}
