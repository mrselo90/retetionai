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

  // host/shop are pure functions of the query string, so they are derived rather
  // than copied into state by an effect (which set state synchronously and
  // cascaded renders).
  const host = searchParams.get('host');
  const shop = host ? searchParams.get('shop') : null;

  // The iframe fallback is the one part that cannot be derived: window is not
  // available during SSR, and reading it in a useState initialiser would render
  // false on the server and true on the client, producing a hydration mismatch.
  // Detecting after mount is the correct pattern here, so the rule is suppressed
  // rather than worked around.
  const [isIframe, setIsIframe] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof window !== 'undefined' && window.top !== window.self) setIsIframe(true);
  }, []);

  const isEmbedded = Boolean(host) || isIframe;

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
