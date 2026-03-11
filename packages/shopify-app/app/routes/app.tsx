import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  ProgressBar,
  Text,
} from "@shopify/polaris";
import {
  CartIcon,
  CatalogIcon,
  ChartVerticalIcon,
  ChatIcon,
  ConnectIcon,
  CreditCardIcon,
  HomeIcon,
  PersonIcon,
  ProfileIcon,
  SettingsIcon,
  ViewIcon,
} from "@shopify/polaris-icons";

import { authenticate } from "../shopify.server";
import { fetchMerchantOverview } from "../platform.server";

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
  const { session } = await authenticate.admin(request);
  const overview = await fetchMerchantOverview(session.shop);
  const legacyDashboardUrl =
    process.env.LEGACY_DASHBOARD_URL?.trim() || "http://localhost:3000";
  const classicPortalHref = new URL("/en/dashboard", legacyDashboardUrl);
  classicPortalHref.searchParams.set("shop", session.shop);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    classicPortalHref: classicPortalHref.toString(),
    shop: session.shop,
    merchantName: overview.merchant.name || session.shop.replace(".myshopify.com", ""),
    subscriptionStatus:
      overview.subscription?.status ||
      overview.merchant.subscription_status ||
      "inactive",
  };
};

export default function App() {
  const { apiKey, classicPortalHref, merchantName, shop, subscriptionStatus } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();

  const navButtonVariant = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`)
      ? "primary"
      : "tertiary";

  return (
    <AppProvider embedded apiKey={apiKey}>
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
                    <Text as="h1" variant="headingLg">
                      {merchantName}
                    </Text>
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
                    <InlineStack gap="200" wrap>
                      <Button
                        url={classicPortalHref}
                        target="_top"
                        icon={ProfileIcon}
                        variant="secondary"
                      >
                        Classic portal
                      </Button>
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

                  <BlockStack gap="300">
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

                  <BlockStack gap="300">
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
                <Outlet />
              </Box>
            </InlineGrid>
          </BlockStack>
        </div>
      </Box>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
