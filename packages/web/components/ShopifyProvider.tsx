'use client';

import { AppProvider as PolarisProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import enTranslations from '@shopify/polaris/locales/en.json';

interface ShopifyProviderProps {
  children: React.ReactNode;
}

export function ShopifyProvider({ children }: ShopifyProviderProps) {
  const i18n = enTranslations;

  return <PolarisProvider i18n={i18n}>{children}</PolarisProvider>;
}
