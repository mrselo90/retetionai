import { forwardRef, useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Link as RemixLink,
  Outlet,
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
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  InlineStack,
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
  CartIcon,
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
import type { AppBridgeWithIdToken } from "../lib/sessionToken.client";
import type { ShopifyMerchantOverview } from "../platform.server";

const primaryNavigation = [
  { to: "/app", label: "Overview", hint: "Launch status", icon: HomeIcon },
  { to: "/app/dashboard", label: "Dashboard", hint: "Daily operations", icon: ViewIcon },
  { to: "/app/products", label: "Products", hint: "Catalog and scraping", icon: CatalogIcon },
  { to: "/app/integrations", label: "Integrations", hint: "Connected services", icon: ConnectIcon },
  { to: "/app/conversations", label: "Conversations", hint: "Live message operations", icon: ChatIcon },
  { to: "/app/customers", label: "Customers", hint: "Buyer health and segments", icon: PersonIcon },
];

const secondaryNavigation = [
  { to: "/app/analytics", label: "Analytics", hint: "Performance signals", icon: ChartVerticalIcon },
  { to: "/app/billing", label: "Billing", hint: "Plans and approval", icon: CreditCardIcon },
  { to: "/app/settings", label: "Settings", hint: "Bot and WhatsApp", icon: SettingsIcon },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    initialShop: new URL(request.url).searchParams.get("shop") || "",
  };
};

export type AppBootstrapData = {
  merchantName: string;
  overview: ShopifyMerchantOverview;
  shop: string;
  subscriptionStatus: string;
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

  const merchantName = bootstrapData?.merchantName || "Loading merchant";
  const shop = bootstrapData?.shop || initialShop || "Embedded Shopify store";
  const subscriptionStatus = bootstrapData?.subscriptionStatus || "loading";
  const shellLoading = !bootstrapData && !bootstrapError;

  return (
    <>
      <EmbeddedSessionTokenBoundary />
      <Box background="bg-surface-secondary" minHeight="100vh" padding="400">
        <div style={{ maxWidth: "1440px", margin: "0 auto" }}>
          <BlockStack gap="400">
            {navigation.state !== "idle" ? (
              <InlineStack align="center">
                <Spinner accessibilityLabel="Loading page" size="small" />
              </InlineStack>
            ) : null}

            <Card padding="500">
              <BlockStack gap="400">
                <InlineGrid columns={{ xs: 1, lg: "2fr 1fr" }} gap="500">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Shopify merchant console
                    </Text>
                    {shellLoading ? (
                      <SkeletonDisplayText size="medium" />
                    ) : (
                      <Text as="h1" variant="headingLg">
                        {merchantName}
                      </Text>
                    )}
                    <Box maxWidth="560px">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Embedded command center for compliant WhatsApp retention,
                        billing, product readiness, and buyer operations.
                      </Text>
                    </Box>
                  </BlockStack>

                  <BlockStack gap="300">
                    <InlineStack gap="200" wrap>
                      <Badge tone="info">{shop}</Badge>
                      <Badge tone={subscriptionStatus === "active" ? "success" : "attention"}>
                        {`Subscription: ${subscriptionStatus}`}
                      </Badge>
                    </InlineStack>
                    {shellLoading ? <Spinner accessibilityLabel="Loading merchant shell" size="small" /> : null}
                    {bootstrapError ? (
                      <Text as="p" variant="bodySm" tone="critical">
                        {bootstrapError}
                      </Text>
                    ) : null}
                    <InlineStack gap="200" wrap>
                      <Button
                        url="/app/billing"
                        icon={CartIcon}
                        variant="primary"
                      >
                        Review billing
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </InlineGrid>
              </BlockStack>
            </Card>

            <InlineGrid columns={{ xs: 1, lg: "280px 1fr" }} gap="400">
              <Card padding="500">
                <BlockStack gap="500">
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingLg">
                      Merchant navigation
                    </Text>
                    <Box maxWidth="20rem">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Shopify merchants should operate from this embedded shell.
                        Non-Shopify and admin flows stay outside.
                      </Text>
                    </Box>
                  </BlockStack>

                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Core
                    </Text>
                    <BlockStack gap="200">
                      {primaryNavigation.map((item) => (
                        <Button
                          key={item.to}
                          fullWidth
                          textAlign="left"
                          icon={item.icon}
                          variant={navButtonVariant(item.to)}
                          url={item.to}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </BlockStack>
                  </BlockStack>

                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Control
                    </Text>
                    <BlockStack gap="200">
                      {secondaryNavigation.map((item) => (
                        <Button
                          key={item.to}
                          fullWidth
                          textAlign="left"
                          icon={item.icon}
                          variant={navButtonVariant(item.to)}
                          url={item.to}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </BlockStack>
              </Card>

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
    </>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
