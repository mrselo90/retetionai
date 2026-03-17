import { useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
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
  ProgressBar,
  SkeletonBodyText,
  SkeletonDisplayText,
  Spinner,
  Text,
} from "@shopify/polaris";
import enPolarisTranslations from "@shopify/polaris/locales/en.json";
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

type AppBridgeWithIdToken = {
  idToken?: () => Promise<string>;
};

export type AppBootstrapData = {
  merchantName: string;
  overview: ShopifyMerchantOverview;
  shop: string;
  subscriptionStatus: string;
};

export function useAppBootstrapData() {
  return useOutletContext<AppBootstrapData | null>();
}

async function fetchBootstrapData(
  shopify: AppBridgeWithIdToken,
  search: string,
): Promise<AppBootstrapData> {
  if (typeof shopify.idToken !== "function") {
    throw new Error("Shopify App Bridge session token API is unavailable.");
  }

  const sessionToken = (await shopify.idToken())?.trim();
  if (!sessionToken) {
    throw new Error("Missing Shopify session token for embedded bootstrap.");
  }

  const response = await window.fetch(`/app/bootstrap${search}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Embedded bootstrap failed with ${response.status}`);
  }

  return (await response.json()) as AppBootstrapData;
}

export default function App() {
  const { apiKey, initialShop } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enPolarisTranslations}>
        <AppShell initialShop={initialShop} />
      </PolarisAppProvider>
    </AppProvider>
  );
}

function AppShell({ initialShop }: { initialShop: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();
  const shopify = useAppBridge() as AppBridgeWithIdToken;
  const [bootstrapData, setBootstrapData] = useState<AppBootstrapData | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const navButtonVariant = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`)
      ? "primary"
      : "tertiary";

  useEffect(() => {
    let cancelled = false;

    void fetchBootstrapData(shopify, location.search)
      .then((data) => {
        if (cancelled) return;
        setBootstrapData(data);
        setBootstrapError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load merchant data.";
        setBootstrapError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [location.search, shopify]);

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
            {navigation.state !== "idle" ? <ProgressBar progress={75} size="small" /> : null}

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
                        onClick={() => navigate("/app/billing")}
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
                          onClick={() => navigate(item.to)}
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
                          onClick={() => navigate(item.to)}
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
                  <Outlet context={bootstrapData} />
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
