import { useCallback, useEffect, useRef, useState } from 'react';
import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import {
  Outlet,
  isRouteErrorResponse,
  redirect,
  useFetcher,
  useFetchers,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useOutletContext,
  useRouteError,
} from 'react-router';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { AppProvider } from '@shopify/shopify-app-react-router/react';
import { useAdminLoadingBar } from '../lib/appBridge';
import { PageBannerContext } from '../components/shell-ui';
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

/**
 * Setup progress exactly as the shell computes it (billing approval from
 * Shopify, WhatsApp step). Pages used to call getSetupProgress
 * with the overview alone, which skipped billing approval and the WhatsApp
 * step: the Dashboard said "3 required steps" while Overview listed 4, and a
 * page could unlock while the checklist still showed work left.
 */
export function shellSetupProgress(
  overview: ShopifyMerchantOverview,
  bootstrapData: AppBootstrapData | null | undefined
) {
  return getSetupProgress(overview, bootstrapData?.billingApproved, bootstrapData?.whatsapp);
}

const BOOTSTRAP_POLL_MS = 3_000;

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <AppShell />
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
  const setupProgress = overview
    ? getSetupProgress(overview, hasBillingApproved, bootstrapData?.whatsapp)
    : null;

  // Navigation lives in the Shopify admin's own sidebar (App Bridge nav menu),
  // not in a card inside the page. The in-page sidebar was hidden below
  // 1040px — which includes the Shopify mobile app and most laptop admin
  // windows — leaving no way to move between pages at all. Until setup is
  // done, only the pages that setup needs are listed.
  const visibleNavItems = setupProgress?.setupComplete ? navItems : setupNavItems;

  // Moving to another page: show a skeleton in its place at once. A small
  // spinner above the old page read as "nothing happened" when the next page
  // took a second to load.
  const nextPathname = navigation.state === 'loading' ? navigation.location?.pathname : undefined;
  const changingPage = Boolean(nextPathname) && nextPathname !== location.pathname;

  // Admin header loading bar for navigation and merchant-started submissions.
  // Fetcher *loads* are left out: the bootstrap poll would flash it every 3s.
  const fetchers = useFetchers();
  useAdminLoadingBar(
    navigation.state !== 'idle' || fetchers.some((item) => item.state === 'submitting')
  );

  const showSetupTrail =
    setupProgress && !setupProgress.setupComplete && location.pathname !== '/app';

  // No Polaris React Frame or in-iframe wrapper: each route owns its s-page,
  // which handles the page width, padding and admin title bar.
  return (
    <>
      <EmbeddedSessionTokenBoundary />
      {bootstrapData ? (
        // App Bridge's s-app-nav (replaces the React NavMenu). Clicks fire
        // shopify:navigate, which AppProvider hands to React Router.
        <s-app-nav>
          {visibleNavItems.map((item) => (
            <a key={item.to} href={item.to} rel={item.to === '/app' ? 'home' : undefined}>
              {item.label}
            </a>
          ))}
        </s-app-nav>
      ) : null}
      {(shellLoading && location.pathname === '/app') || changingPage ? (
        <s-page heading={pageHeading(nextPathname ?? location.pathname)}>
          <s-section>
            <s-stack alignItems="center" paddingBlock="large-400">
              <s-spinner size="large" accessibilityLabel="Loading page" />
            </s-stack>
          </s-section>
        </s-page>
      ) : (
        <PageBannerContext.Provider
          value={
            showSetupTrail ? (
              <SetupTrail
                pathname={location.pathname}
                done={setupProgress.completedCount}
                total={setupProgress.totalSteps}
                nextStep={setupProgress.nextStep}
              />
            ) : null
          }
        >
          <Outlet
            context={{
              bootstrapData,
              bootstrapError,
              shellLoading,
            }}
          />
        </PageBannerContext.Provider>
      )}
    </>
  );
}

/** Title-bar heading while a page loads: the nav label of the page being opened. */
function pageHeading(pathname: string) {
  const match = navItems
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? 'Recete';
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
  const navigate = useNavigate();
  const info =
    nextStep && nextStep in REQUIRED_STEP_INFO
      ? REQUIRED_STEP_INFO[nextStep as keyof typeof REQUIRED_STEP_INFO]
      : null;
  if (!info) return null;

  const onNextStep = pathname === info.path || pathname.startsWith(`${info.path}/`);

  return onNextStep ? (
    <s-banner tone="info" heading={`Setup step ${done + 1} of ${total}: ${info.title}`}>
      <s-paragraph>When you&apos;re done here, go back to setup for the next step.</s-paragraph>
      <s-button slot="secondary-actions" onClick={() => navigate('/app')}>
        Back to setup
      </s-button>
    </s-banner>
  ) : (
    <s-banner tone="info" heading={`Setup ${done} of ${total} done`}>
      <s-button slot="secondary-actions" onClick={() => navigate(info.path)}>
        {`Next: ${info.title}`}
      </s-button>
    </s-banner>
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
        <s-page heading="Something went wrong" inlineSize="small">
          <s-banner tone="critical" heading={`This page could not be loaded (${error.status})`}>
            <s-paragraph>Reload to try again.</s-paragraph>
            <s-paragraph color="subdued">{message}</s-paragraph>
          </s-banner>
        </s-page>
      </AppProvider>
    );
  }

  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
