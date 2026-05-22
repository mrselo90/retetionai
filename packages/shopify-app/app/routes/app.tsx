import { forwardRef, useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
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
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  AppProvider as PolarisAppProvider,
  BlockStack,
  Box,
  Card,
  Frame,
  InlineGrid,
  InlineStack,
  Icon,
  SkeletonBodyText,
  SkeletonDisplayText,
  Spinner,
  Text,
} from "@shopify/polaris";
import enPolarisTranslations from "@shopify/polaris/locales/en.json";

const AppLink = forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { url?: string }
>(function AppLink({ url, href, children, ...rest }, ref) {
  const to = url ?? href ?? "";
  if (to.startsWith("http") || to.startsWith("//")) {
    return <a ref={ref} href={to} {...rest}>{children}</a>;
  }
  return <RemixLink ref={ref} to={to} {...rest}>{children}</RemixLink>;
});
import {
  CatalogIcon,
  ChartVerticalIcon,
  ChatIcon,
  ConnectIcon,
  CreditCardIcon,
  HomeIcon,
  PersonIcon,
  SettingsIcon,
  ViewIcon,
} from "@shopify/polaris-icons";

import { EmbeddedSessionTokenBoundary } from "../components/EmbeddedSessionTokenBoundary";
import { isBillingReady, normalizeSubscriptionStatus } from "../lib/billingStatus";
import { getSetupProgress } from "../lib/setupProgress";
import type { AppBridgeWithIdToken } from "../lib/sessionToken.client";
import type { ShopifyMerchantOverview } from "../platform.server";

const navigationSections = [
  {
    title: "Setup",
    items: [
      { to: "/app", label: "Overview", hint: "First steps", icon: HomeIcon },
      { to: "/app/billing", label: "Billing", hint: "Plan approval", icon: CreditCardIcon },
      { to: "/app/products", label: "Products", hint: "Catalog setup", icon: CatalogIcon },
      { to: "/app/settings", label: "Settings", hint: "Bot behavior", icon: SettingsIcon },
      { to: "/app/integrations", label: "Integrations", hint: "Service health", icon: ConnectIcon },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/app/dashboard", label: "Dashboard", hint: "Daily activity", icon: ViewIcon },
      { to: "/app/conversations", label: "Conversations", hint: "Escalations", icon: ChatIcon },
      { to: "/app/customers", label: "Customers", hint: "Buyer context", icon: PersonIcon },
      { to: "/app/analytics", label: "Analytics", hint: "Performance", icon: ChartVerticalIcon },
    ],
  },
] as const;

function isDocumentRequest(request: Request) {
  if (request.method.toUpperCase() !== "GET") return false;

  const secFetchDest = request.headers.get("Sec-Fetch-Dest")?.toLowerCase();
  if (secFetchDest === "document" || secFetchDest === "iframe") return true;

  const accept = request.headers.get("Accept")?.toLowerCase() || "";
  return accept.includes("text/html");
}

function getStoreHandle(shop: string) {
  return shop.replace(/\.myshopify\.com$/i, "");
}

function getEmbeddedAdminUrl(requestUrl: URL, shop: string) {
  const storeHandle = getStoreHandle(shop);
  const appHandle = process.env.SHOPIFY_MANAGED_PRICING_APP_HANDLE?.trim() || "blackeagle";
  const embeddedPath = requestUrl.pathname.replace(/\.data$/i, "");
  return `https://admin.shopify.com/store/${storeHandle}/apps/${appHandle}${embeddedPath}${requestUrl.search}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop")?.trim() || "";
  const isEmbeddedRequest =
    url.searchParams.has("host") ||
    url.searchParams.get("embedded") === "1" ||
    url.searchParams.has("id_token");

  if (shop && !isEmbeddedRequest && isDocumentRequest(request)) {
    throw redirect(getEmbeddedAdminUrl(url, shop));
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
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
  const { apiKey, initialShop } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enPolarisTranslations} linkComponent={AppLink}>
        <AppShell initialShop={initialShop} />
      </PolarisAppProvider>
    </AppProvider>
  );
}

function AppShell({ initialShop }: { initialShop: string }) {
  const location = useLocation();
  const navigation = useNavigation();
  const shopify = useAppBridge() as AppBridgeWithIdToken;

  const fetcher = useFetcher<AppBootstrapData>();
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    const load = () => {
      if (fetcher.state === "idle") {
        fetcher.load(`/app/bootstrap${location.search}`);
      }
    };

    load();

    const interval = window.setInterval(load, BOOTSTRAP_POLL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [location.search]);

  useEffect(() => {
    if (fetcher.data && !hasLoadedOnce) {
      setHasLoadedOnce(true);
    }
  }, [fetcher.data, hasLoadedOnce]);

  const bootstrapData = fetcher.data ?? null;
  const bootstrapError =
    fetcher.state === "idle" && hasLoadedOnce && !fetcher.data
      ? "Bootstrap returned empty data"
      : null;

  const navButtonVariant = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`)
      ? "primary"
      : "tertiary";

  const subscriptionStatus = bootstrapData?.subscriptionStatus || "loading";
  // Subscription status is informational — keep computation but no longer rendered in sidebar.
  void normalizeSubscriptionStatus(subscriptionStatus);
  const hasBillingApproved = bootstrapData?.billingApproved ?? isBillingReady(subscriptionStatus);
  const activePlanName = bootstrapData?.activePlanName ?? null;
  const shellLoading = !bootstrapData && !bootstrapError;
  const overview = bootstrapData?.overview;
  const themeEmbedEnabled = bootstrapData?.themeEmbedEnabled ?? false;
  const setupProgress = overview ? getSetupProgress(overview, hasBillingApproved, themeEmbedEnabled) : null;
  // setupIncomplete drives sidebar simplification: when true we hide ops nav and
  // show a single "Back to setup" link instead of disabled stubs.
  const setupIncomplete = setupProgress ? !setupProgress.setupComplete : true;

  return (
    <Frame>
      <EmbeddedSessionTokenBoundary />
      {/* Hide sidebar on mobile — it stacks above content on xs/sm/md which hurts usability */}
      <style>{`
        @media (max-width: 1039px) { .recete-sidebar { display: none !important; } }
      `}</style>
      <Box background="bg-surface" minHeight="100vh" padding={{ xs: "200", sm: "300", md: "400" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <BlockStack gap="400">
            {navigation.state === "loading" ? (
              <InlineStack align="center">
                <Spinner accessibilityLabel="Loading page" size="small" />
              </InlineStack>
            ) : null}

            <InlineGrid columns={{ xs: 1, lg: "240px 1fr" }} gap="400">
              {/* Sidebar: hidden on mobile (xs/sm/md), visible only on lg+ */}
              <div className="recete-sidebar">
              <Card padding="300" roundedAbove="sm">
                <BlockStack gap="300">
                  {setupIncomplete ? (
                    /* During setup: only show a single "Back to setup" link.
                       No disabled nav stubs, no duplicate progress, no extra headings. */
                    location.pathname !== "/app" ? (
                      <AppLink
                        url="/app"
                        style={{ textDecoration: "none", color: "inherit", display: "block" }}
                      >
                        <Box
                          padding="200"
                          borderWidth="025"
                          borderColor="border-brand"
                          borderRadius="200"
                          background="bg-surface-secondary"
                        >
                          <InlineStack gap="200" blockAlign="center">
                            <Icon source={HomeIcon} tone="base" />
                            <BlockStack gap="050">
                              <Text as="p" variant="bodySm" fontWeight="semibold">
                                Back to setup
                              </Text>
                              <Text as="p" variant="bodyXs" tone="subdued">
                                Finish the 3 required steps to unlock everything.
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>
                      </AppLink>
                    ) : (
                      <Box padding="200">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" fontWeight="semibold">
                            Setup
                          </Text>
                          <Text as="p" variant="bodyXs" tone="subdued">
                            Finish setup to unlock Dashboard, Conversations, and more.
                          </Text>
                        </BlockStack>
                      </Box>
                    )
                  ) : (
                    /* Setup complete: full navigation sections */
                    <>
                      {navigationSections.map((section) => (
                        <BlockStack key={section.title} gap="150">
                          <Text as="p" variant="bodyXs" tone="subdued">
                            {section.title}
                          </Text>
                          <BlockStack gap="100">
                            {section.items.map((item) => {
                              const active = navButtonVariant(item.to) === "primary";
                              return (
                                <AppLink
                                  key={item.to}
                                  url={item.to}
                                  style={{
                                    textDecoration: "none",
                                    color: "inherit",
                                    display: "block",
                                  }}
                                >
                                  <Box
                                    padding="200"
                                    borderWidth={active ? "025" : undefined}
                                    borderColor={active ? "border-brand" : undefined}
                                    borderRadius="200"
                                    background={active ? "bg-surface-secondary" : "bg-surface"}
                                  >
                                    <InlineStack blockAlign="start" gap="200">
                                      <InlineStack gap="150" blockAlign="start">
                                        <Icon source={item.icon} tone={active ? "base" : "subdued"} />
                                        {active ? (
                                          <Box
                                            minWidth="4px"
                                            minHeight="2rem"
                                            borderRadius="full"
                                            background="bg-fill-brand"
                                          />
                                        ) : null}
                                        <BlockStack gap="050">
                                          <Text as="p" variant="bodySm" fontWeight="semibold">
                                            {item.label}
                                          </Text>
                                          <Text as="p" variant="bodyXs" tone="subdued">
                                            {item.hint}
                                          </Text>
                                        </BlockStack>
                                      </InlineStack>
                                    </InlineStack>
                                  </Box>
                                </AppLink>
                              );
                            })}
                          </BlockStack>
                        </BlockStack>
                      ))}
                      {activePlanName ? (
                        <Box
                          paddingBlockStart="200"
                          borderBlockStartWidth="025"
                          borderColor="border-secondary"
                        >
                          <Text as="p" variant="bodyXs" tone="subdued">
                            {activePlanName}
                          </Text>
                        </Box>
                      ) : null}
                    </>
                  )}
                </BlockStack>
              </Card>
              </div>

              <Box>
                {shellLoading && location.pathname === "/app" ? (
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
              </Box>
            </InlineGrid>
          </BlockStack>
        </div>
      </Box>
    </Frame>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    const message =
      typeof error.data === "object" &&
      error.data !== null &&
      "error" in error.data &&
      typeof error.data.error === "string"
        ? error.data.error
        : error.statusText || "Unexpected route error";

    return (
      <AppProvider embedded apiKey="">
        <PolarisAppProvider i18n={enPolarisTranslations} linkComponent={AppLink}>
          <Frame>
            <Box background="bg-surface-secondary" minHeight="100vh" padding="400">
              <div style={{ maxWidth: "840px", margin: "0 auto" }}>
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
