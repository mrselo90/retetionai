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
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Collapsible,
  Frame,
  InlineGrid,
  InlineStack,
  Icon,
  Link,
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
};

export type AppBootstrapContext = {
  bootstrapData: AppBootstrapData | null;
  bootstrapError: string | null;
  shellLoading: boolean;
};

type SetupStep = {
  label: string;
  status: "complete" | "pending";
  detail: string;
  to: string;
  actionLabel?: string;
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
  const subscriptionTone = subscriptionStatus === "active" ? "success" : "attention";
  const subscriptionLabel = subscriptionStatus === "active" ? "Subscription active" : `Subscription ${subscriptionStatus}`;
  const shellLoading = !bootstrapData && !bootstrapError;
  const showOverviewHero = location.pathname === "/app";
  const isProductSetupDetailView =
    location.pathname.startsWith("/app/products") &&
    new URLSearchParams(location.search).has("product");
  const overview = bootstrapData?.overview;
  const setupSteps: SetupStep[] = overview
    ? [
        {
          label: "Billing approved",
          status: bootstrapData?.subscriptionStatus === "active" ? "complete" : "pending",
          detail:
            bootstrapData?.subscriptionStatus === "active"
              ? "Plan is active."
              : "Approve the app plan in Shopify.",
          to: "/app/billing",
        },
        {
          label: "Catalog ready",
          status: overview.metrics.totalProducts > 0 ? "complete" : "pending",
          detail:
            overview.metrics.totalProducts > 0
              ? `${overview.metrics.totalProducts} products available.`
              : "Add or sync products first.",
          to: "/app/products",
        },
        {
          label: "Messaging configured",
          status: overview.settings?.personaSettings?.bot_name ? "complete" : "pending",
          detail:
            overview.settings?.personaSettings?.bot_name
              ? "Bot settings saved."
              : "Review bot and WhatsApp settings.",
          to: "/app/settings",
        },
        {
          label: "Orders flowing",
          status: overview.metrics.totalOrders > 0 ? "complete" : "pending",
          detail:
            overview.metrics.totalOrders > 0
              ? `${overview.metrics.totalOrders} orders visible.`
              : "Create and fulfill a Shopify test order, then refresh integration status.",
          to: "/app/integrations#orders-flow",
          actionLabel: "Open order flow setup",
        },
      ]
    : [];
  const nextStep = setupSteps.find((step) => step.status === "pending") ?? null;
  const [showLaunchChecklist, setShowLaunchChecklist] = useState(false);

  return (
    <Frame>
      <EmbeddedSessionTokenBoundary />
      <Box background="bg-surface" minHeight="100vh" padding="400">
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <BlockStack gap="400">
            {navigation.state === "loading" ? (
              <InlineStack align="center">
                <Spinner accessibilityLabel="Loading page" size="small" />
              </InlineStack>
            ) : null}

            {showOverviewHero ? (
              <Card padding="500" roundedAbove="sm">
                <BlockStack gap="300">
                  <InlineGrid columns={{ xs: 1, xl: "minmax(0, 1.8fr) 18rem" }} gap="400">
                    <BlockStack gap="300">
                      <Text as="p" variant="bodySm" tone="subdued">
                        Embedded workspace
                      </Text>
                      {shellLoading ? (
                        <SkeletonDisplayText size="medium" />
                      ) : (
                        <Text as="h1" variant="headingLg">
                          {merchantName}
                        </Text>
                      )}
                      <Box maxWidth="34rem">
                        <Text as="p" variant="bodySm" tone="subdued">
                          Compliant retention, catalog readiness, and buyer operations inside Shopify Admin.
                        </Text>
                      </Box>
                      {overview ? (
                        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="200">
                          <Box padding="200" borderWidth="025" borderColor="border-secondary" borderRadius="300">
                            <Text as="p" variant="bodyXs" tone="subdued">Plan</Text>
                            <Text as="p" variant="bodySm" fontWeight="semibold">{subscriptionLabel}</Text>
                          </Box>
                          <Box padding="200" borderWidth="025" borderColor="border-secondary" borderRadius="300">
                            <Text as="p" variant="bodyXs" tone="subdued">Catalog</Text>
                            <Text as="p" variant="bodySm" fontWeight="semibold">
                              {overview.metrics.totalProducts > 0 ? `${overview.metrics.totalProducts} products` : "No products yet"}
                            </Text>
                          </Box>
                          <Box padding="200" borderWidth="025" borderColor="border-secondary" borderRadius="300">
                            <Text as="p" variant="bodyXs" tone="subdued">Orders</Text>
                            <Text as="p" variant="bodySm" fontWeight="semibold">
                              {overview.metrics.totalOrders > 0 ? `${overview.metrics.totalOrders} orders` : "No order flow"}
                            </Text>
                          </Box>
                        </InlineGrid>
                      ) : null}
                    </BlockStack>

                    <BlockStack gap="300">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyXs" tone="subdued">
                          Store
                        </Text>
                        {shellLoading ? (
                          <SkeletonBodyText lines={1} />
                        ) : (
                          <Text as="p" variant="bodySm" fontWeight="semibold" breakWord>
                            {shop}
                          </Text>
                        )}
                      </BlockStack>
                      {shellLoading ? <Spinner accessibilityLabel="Loading merchant shell" size="small" /> : null}
                      {bootstrapError ? (
                        <Text as="p" variant="bodySm" tone="critical">
                          {bootstrapError}
                        </Text>
                      ) : null}
                      <InlineStack gap="200" wrap>
                        <Button url={nextStep?.to || "/app/dashboard"} icon={nextStep ? undefined : ViewIcon} variant="primary">
                          {nextStep ? "Continue setup" : "Open dashboard"}
                        </Button>
                        <Button url="/app/billing" icon={CartIcon} variant="tertiary">
                          Billing
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </InlineGrid>
                </BlockStack>
              </Card>
            ) : null}

            <InlineGrid columns={{ xs: 1, lg: "280px 1fr" }} gap="400">
              <Card padding="300" roundedAbove="sm">
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Merchant workspace
                    </Text>
                  </BlockStack>

                  {setupSteps.length > 0 && !isProductSetupDetailView ? (
                    <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h3" variant="headingSm">
                            Launch progress
                          </Text>
                          <Badge tone={nextStep ? "attention" : "success"}>
                            {nextStep
                              ? `${setupSteps.filter((step) => step.status === "complete").length}/${setupSteps.length}`
                              : "Done"}
                          </Badge>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {nextStep
                            ? `Next: ${nextStep.label}`
                            : "All launch checks are complete."}
                        </Text>
                        <InlineStack align="space-between" blockAlign="center">
                          <Button
                            variant="plain"
                            size="slim"
                            onClick={() => setShowLaunchChecklist((current) => !current)}
                            ariaExpanded={showLaunchChecklist}
                            ariaControls="launch-checklist"
                          >
                            {showLaunchChecklist ? "Hide checklist" : "View checklist"}
                          </Button>
                        </InlineStack>
                        <Collapsible
                          open={showLaunchChecklist}
                          id="launch-checklist"
                          transition={{ duration: "150ms", timingFunction: "ease-in-out" }}
                        >
                          <BlockStack gap="150">
                            {setupSteps.map((step) => (
                              <InlineStack key={step.label} align="space-between" blockAlign="start" gap="200">
                                <BlockStack gap="050">
                                  <Text as="p" variant="bodySm" fontWeight="semibold">
                                    {step.label}
                                  </Text>
                                  <Text as="p" variant="bodyXs" tone="subdued">
                                    {step.detail}
                                  </Text>
                                </BlockStack>
                                <Text
                                  as="p"
                                  variant="bodyXs"
                                  tone={step.status === "complete" ? "success" : "subdued"}
                                  fontWeight="semibold"
                                >
                                  {step.status === "complete" ? "Done" : "Pending"}
                                </Text>
                              </InlineStack>
                            ))}
                          </BlockStack>
                        </Collapsible>
                        {nextStep ? (
                          <Button url={nextStep.to} variant="primary" fullWidth>
                            {nextStep.actionLabel || "Continue setup"}
                          </Button>
                        ) : null}
                      </BlockStack>
                    </Box>
                  ) : null}

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
            <Box paddingInlineStart="200">
              <Text as="p" variant="bodySm">
                Need a deeper setup pass? Use <Link url="/app/settings">Settings</Link> for bot behavior and{" "}
                <Link url="/app/products">Products</Link> for catalog readiness.
              </Text>
            </Box>
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
