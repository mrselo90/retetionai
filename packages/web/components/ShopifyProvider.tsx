'use client';

import { AppProvider as PolarisProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { createContext, useContext, useEffect, useState, Suspense } from 'react';

interface ShopifyContextType {
  isEmbedded: boolean;
  host: string | null;
  shop: string | null;
}

const ShopifyContext = createContext<ShopifyContextType>({
  isEmbedded: false,
  host: null,
  shop: null,
});

export const useShopify = () => useContext(ShopifyContext);

interface ShopifyProviderProps {
  children: React.ReactNode;
}

function ShopifyProviderContent({ children }: ShopifyProviderProps) {
  const searchParams = useSearchParams();
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [host, setHost] = useState<string | null>(null);
  const [shop, setShop] = useState<string | null>(null);

  useEffect(() => {
    const hostParam = searchParams.get('host');
    const shopParam = searchParams.get('shop');
    
    // If host is present, we are likely in Shopify embedded mode
    if (hostParam) {
      setIsEmbedded(true);
      setHost(hostParam);
      setShop(shopParam);
    } else if (typeof window !== 'undefined' && window.top !== window.self) {
      // Fallback check for iframe
      setIsEmbedded(true);
    }
  }, [searchParams]);

  return (
    <ShopifyContext.Provider value={{ isEmbedded, host, shop }}>
      <PolarisProvider i18n={enTranslations}>
        {children}
      </PolarisProvider>
    </ShopifyContext.Provider>
  );
}

export function ShopifyProvider({ children }: ShopifyProviderProps) {
  return (
    <Suspense fallback={<PolarisProvider i18n={enTranslations}>{children}</PolarisProvider>}>
      <ShopifyProviderContent>
        {children}
      </ShopifyProviderContent>
    </Suspense>
  );
}
