import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import {
  Link as RemixLink,
  Outlet,
  isRouteErrorResponse,
  redirect,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigation,
  useOutletContext,
  useRouteError,
} from 'react-router';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { AppProvider } from '@shopify/shopify-app-react-router/react';
import { NavMenu } from '@shopify/app-bridge-react';
import {
  AppProvider as PolarisAppProvider,
  Banner,
  BlockStack,
  Box,
  Card,
  Frame,
  InlineStack,
  SkeletonBodyText,
  SkeletonDisplayText,
  Spinner,
  Text,
} from '@shopify/polaris';
import enPolarisTranslations from '@shopify/polaris/locales/en.json';

const AppLink = forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { url?: string }
>(function AppLink({ url, href, children, ...rest }, ref) {
  const to = url ?? href ?? '';
  if (to.startsWith('http') || to.startsWith('//')) {
    return (
      <a ref={ref} href={to} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <RemixLink ref={ref} to={to} {...rest}>
      {children}
    </RemixLink>
  );
});
import { EmbeddedSessionTokenBoundary } from '../components/EmbeddedSessionTokenBoundary';
import { isBillingReady } from '../lib/billingStatus';
import { getSetupProgress, REQUIRED_STEP_INFO } from '../lib/setupProgress';
import type { ShopifyMerchantOverview } from '../platform.server';

const navItems = [
  { to: '/app', label: 'Overview' },
  { to: '/app/billing', label: 'Billing' },
  { to: '/app/products', label: 'Products' },
  { to: '/app/settings', label: 'Settings' },
  { to: '/app/integrations', label: 'Integrations' },
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app/conversations', label: 'Conversations' },
  { to: '/app/customers', label: 'Customers' },
  { to: '/app/analytics', label: 'Analytics' },
] as const;

// Until the required setup steps are done, list only the pages those steps use.
// Integrations is where the store connects its WhatsApp number.
const SETUP_NAV_PATHS = new Set<string>([
  '/app',
  '/app/billing',
  '/app/integrations',
  '/app/products',
  '/app/settings',
]);
const setupNavItems = navItems.filter((item) => SETUP_NAV_PATHS.has(item.to));

function isDocumentRequest(request: Request) {
  if (request.method.toUpperCase() !== 'GET') return false;

  const secFetchDest = request.headers.get('Sec-Fetch-Dest')?.toLowerCase();
  if (secFetchDest === 'document' || secFetchDest === 'iframe') return true;

  const accept = request.headers.get('Accept')?.toLowerCase() || '';
  return accept.includes('text/html');
}

function getStoreHandle(shop: string) {
  return shop.replace(/\.myshopify\.com$/i, '');
}

function getEmbeddedAdminUrl(requestUrl: URL, shop: string) {
  const storeHandle = getStoreHandle(shop);
  const appHandle = process.env.SHOPIFY_MANAGED_PRICING_APP_HANDLE?.trim() || 'blackeagle';
  const embeddedPath = requestUrl.pathname.replace(/\.data$/i, '');
  return `https://admin.shopify.com/store/${storeHandle}/apps/${appHandle}${embeddedPath}${requestUrl.search}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop')?.trim() || '';
  const isEmbeddedRequest =
    url.searchParams.has('host') ||
    url.searchParams.get('embedded') === '1' ||
    url.searchParams.has('id_token');

  if (shop && !isEmbeddedRequest && isDocumentRequest(request)) {
    throw redirect(getEmbeddedAdminUrl(url, shop));
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || '',
    initialShop: shop,
  };
};

export type AppBootstrapData = {
  merchantName: string;
  overview: ShopifyMerchantOverview;
  shop: string;
  subscriptionStatus: string;
  billingApproved?: boolean;
  themeEmbedEnabled?: boolean;
  activePlanName?: string | null;
  // Set by /app/bootstrap while the platform is still provisioning a fresh install.
  pending?: boolean;
  whatsapp?: { enabled: boolean; connected: boolean } | null;
};

export type AppBootstrapContext = {
  bootstrapData: AppBootstrapData | null;
  bootstrapError: string | null;
  shellLoading: boolean;
};

export function useAppBootstrapData() {
  return useOutletContext<AppBootstrapContext>();
}

const BOOTSTRAP_POLL_MS = 3_000;

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enPolarisTranslations} linkComponent={AppLink}>
        <AppShell />
      </PolarisAppProvider>
    </AppProvider>
  );
}

function AppShell() {
  const location = useLocation();
  const navigation = useNavigation();

  const fetcher = useFetcher<AppBootstrapData>();
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // The listeners below outlive the render that created them, so they read the
  // fetcher through a ref. Reading `fetcher.state` from the closure saw the
  // first render's "idle" forever and fired a new load on every tick.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const locationSearchRef = useRef(location.search);
  locationSearchRef.current = location.search;

  const load = useCallback(() => {
    if (fetcherRef.current.state === 'idle') {
      fetcherRef.current.load(`/app/bootstrap${locationSearchRef.current}`);
    }
  }, []);

  // Refresh on every navigation, so returning to Overview after billing,
  // products or messaging shows the new progress, and whenever the merchant
  // comes back to the tab.
  useEffect(() => {
    load();
  }, [load, location.pathname, location.search]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [load]);

  // Poll only while the platform is still provisioning a fresh install. This
  // used to run every 3s for as long as the app was open — a Shopify billing
  // check and a platform call per tick, per open tab.
  const bootstrapPending = !fetcher.data || Boolean(fetcher.data.pending);
  useEffect(() => {
    if (!bootstrapPending) return;
    const interval = window.setInterval(load, BOOTSTRAP_POLL_MS);
    return () => window.clearInterval(interval);
  }, [bootstrapPending, load]);

  useEffect(() => {
    if (fetcher.data && !hasLoadedOnce) {
      setHasLoadedOnce(true);
    }
  }, [fetcher.data, hasLoadedOnce]);

  const bootstrapData = fetcher.data ?? null;
  const bootstrapError =
    fetcher.state === 'idle' && hasLoadedOnce && !fetcher.data
      ? 'Bootstrap returned empty data'
      : null;

  const subscriptionStatus = bootstrapData?.subscriptionStatus || 'loading';
  const hasBillingApproved = bootstrapData?.billingApproved ?? isBillingReady(subscriptionStatus);
  const shellLoading = !bootstrapData && !bootstrapError;
  const overview = bootstrapData?.overview;
  const themeEmbedEnabled = bootstrapData?.themeEmbedEnabled ?? false;
  const setupProgress = overview
    ? getSetupProgress(overview, hasBillingApproved, themeEmbedEnabled, bootstrapData?.whatsapp)
    : null;

  // Navigation lives in the Shopify admin's own sidebar (App Bridge nav menu),
  // not in a card inside the page. The in-page sidebar was hidden below
  // 1040px — which includes the Shopify mobile app and most laptop admin
  // windows — leaving no way to move between pages at all. Until setup is
  // done, only the pages that setup needs are listed.
  const visibleNavItems = setupProgress?.setupComplete ? navItems : setupNavItems;

  return (
    <Frame>
      <EmbeddedSessionTokenBoundary />
      {bootstrapData ? (
        <NavMenu>
          {visibleNavItems.map((item) => (
            <RemixLink key={item.to} to={item.to} rel={item.to === '/app' ? 'home' : undefined}>
              {item.label}
            </RemixLink>
          ))}
        </NavMenu>
      ) : null}
      <Box background="bg-surface" minHeight="100vh" padding={{ xs: '200', sm: '300', md: '400' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <BlockStack gap="400">
            {navigation.state === 'loading' ? (
              <InlineStack align="center">
                <Spinner accessibilityLabel="Loading page" size="small" />
              </InlineStack>
            ) : null}

            {setupProgress && !setupProgress.setupComplete && location.pathname !== '/app' ? (
              <SetupTrail
                pathname={location.pathname}
                done={setupProgress.completedCount}
                total={setupProgress.totalSteps}
                nextStep={setupProgress.nextStep}
              />
            ) : null}

            {shellLoading && location.pathname === '/app' ? (
              <Card padding="500">
                <BlockStack gap="300">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={4} />
                </BlockStack>
              </Card>
            ) : (
              <Outlet
                context={{
                  bootstrapData,
                  bootstrapError,
                  shellLoading,
                }}
              />
            )}
          </BlockStack>
        </div>
      </Box>
    </Frame>
  );
}

/**
 * Keeps the merchant on the setup path from any page. The Overview checklist was
 * the only place that said what comes next, so a merchant who opened Products
 * or Settings had no way back but the nav. On the next step's own page it says
 * which step this is; anywhere else it points at that step.
 */
function SetupTrail({
  pathname,
  done,
  total,
  nextStep,
}: {
  pathname: string;
  done: number;
  total: number;
  nextStep: string | null;
}) {
  const info =
    nextStep && nextStep in REQUIRED_STEP_INFO
      ? REQUIRED_STEP_INFO[nextStep as keyof typeof REQUIRED_STEP_INFO]
      : null;
  if (!info) return null;

  const onNextStep = pathname === info.path || pathname.startsWith(`${info.path}/`);

  return onNextStep ? (
    <Banner
      tone="info"
      title={`Setup step ${done + 1} of ${total}: ${info.title}`}
      action={{ content: 'Back to setup', url: '/app' }}
    >
      <p>When you&apos;re done here, go back to setup for the next step.</p>
    </Banner>
  ) : (
    <Banner
      tone="info"
      title={`Setup ${done} of ${total} done`}
      action={{ content: `Continue: ${info.title}`, url: info.path }}
      secondaryAction={{ content: 'Back to setup', url: '/app' }}
    >
      <p>{`Next step: ${info.title.toLowerCase()}.`}</p>
    </Banner>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    const message =
      typeof error.data === 'object' &&
      error.data !== null &&
      'error' in error.data &&
      typeof error.data.error === 'string'
        ? error.data.error
        : error.statusText || 'Unexpected route error';

    return (
      <AppProvider embedded apiKey="">
        <PolarisAppProvider i18n={enPolarisTranslations} linkComponent={AppLink}>
          <Frame>
            <Box background="bg-surface-secondary" minHeight="100vh" padding="400">
              <div style={{ maxWidth: '840px', margin: '0 auto' }}>
                <Card padding="500">
                  <BlockStack gap="300">
                    <Text as="h1" variant="headingLg">
                      {`Request failed (${error.status})`}
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {message}
                    </Text>
                  </BlockStack>
                </Card>
              </div>
            </Box>
          </Frame>
        </PolarisAppProvider>
      </AppProvider>
    );
  }

  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
