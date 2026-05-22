import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { CartIcon, ChatIcon, ViewIcon } from "@shopify/polaris-icons";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { getSetupProgress } from "../lib/setupProgress";
import { fetchMerchantConversations } from "../platform.server";
import { fetchMerchantOverviewFromRequest, type ShopifyMerchantOverview } from "../platform.server";
import { MetricCard, SectionCard } from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const [overview, conversationsResult] = await Promise.all([
    fetchMerchantOverviewFromRequest(request).catch((): ShopifyMerchantOverview => ({
      merchant: { id: "", name: "" },
      shop: "",
      integration: { id: "", provider: "shopify", status: "unknown" },
      subscription: null,
      metrics: { totalOrders: 0, activeUsers: 0, totalProducts: 0, responseRate: 0 },
      analytics: { avgSentiment: 0, returnRate: 0, preventedReturns: 0, totalConversations: 0, resolvedConversations: 0 },
      settings: {},
      integrations: [],
      products: [],
      recentOrders: [],
    })),
    fetchMerchantConversations(request).catch(() => ({ conversations: [] })),
  ]);

  return { overview, conversations: conversationsResult.conversations || [] };
};

export default function DashboardPage() {
  const { overview: data, conversations } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const progress = getSetupProgress(data);
  const { setupComplete } = progress;

  const manualQueue = conversations.filter((c) => c.conversationStatus === "human");
  const humanCount = manualQueue.length;
  const aiCount = conversations.filter((c) => c.conversationStatus === "ai").length;
  const resolvedCount = conversations.filter((c) => c.conversationStatus === "resolved").length;

  const responseValue =
    data.metrics.responseRate > 0 ? `${data.metrics.responseRate}%` : "—";

  if (!setupComplete) {
    return (
      <Page
        title="Dashboard"
        subtitle="Complete setup to unlock daily operations."
        primaryAction={{
          content: "Continue setup",
          onAction: () => navigate("/app"),
          icon: CartIcon as never,
        }}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">Setup is not finished yet</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Dashboard, Conversations, and Analytics unlock once the 3 required setup steps are done.
                  </Text>
                </BlockStack>
                <InlineStack>
                  <Button url="/app" variant="primary" icon={CartIcon as never}>
                    Back to setup
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Dashboard"
      subtitle="Daily view of Recete activity."
      primaryAction={
        humanCount > 0
          ? {
              content: `Handle ${humanCount} escalation${humanCount === 1 ? "" : "s"}`,
              onAction: () => navigate(`/app/conversations/${manualQueue[0].id}`),
              icon: ChatIcon as never,
            }
          : {
              content: "View conversations",
              onAction: () => navigate("/app/conversations"),
              icon: ViewIcon as never,
            }
      }
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">

            {/* ── Escalation alert ────────────────────────────────────────── */}
            {humanCount > 0 ? (
              <Banner
                title={`${humanCount} conversation${humanCount === 1 ? "" : "s"} need${humanCount === 1 ? "s" : ""} your attention`}
                tone="warning"
                action={{
                  content: "Handle next",
                  onAction: () => navigate(`/app/conversations/${manualQueue[0].id}`),
                }}
              >
                <Text as="p" variant="bodyMd">
                  These threads have been escalated to human review.
                </Text>
              </Banner>
            ) : null}

            {/* ── Key metrics ─────────────────────────────────────────────── */}
            <InlineGrid columns={{ xs: 2, sm: 2, lg: 4 }} gap="400">
              <MetricCard
                label="Orders"
                value={data.metrics.totalOrders}
                hint={data.metrics.totalOrders > 0 ? "Orders tracked by Recete." : "No orders yet."}
              />
              <MetricCard
                label="Opted-in customers"
                value={data.metrics.activeUsers}
                hint={data.metrics.activeUsers > 0 ? "Customers ready for messaging." : "No consented customers yet."}
              />
              <MetricCard
                label="Reply rate"
                value={responseValue}
                hint={data.metrics.responseRate > 0 ? "Replies vs. total buyer threads." : "Not available yet."}
              />
              <MetricCard
                label="Conversations"
                value={conversations.length}
                hint={
                  humanCount > 0
                    ? `${humanCount} need${humanCount === 1 ? "s" : ""} manual attention.`
                    : aiCount > 0
                      ? `${aiCount} AI-owned, ${resolvedCount} resolved.`
                      : "No conversations yet."
                }
              />
            </InlineGrid>

            {/* ── Conversation queue ──────────────────────────────────────── */}
            {conversations.length > 0 ? (
              <SectionCard
                title="Conversation queue"
                subtitle="Live status across all buyer threads."
              >
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <Box
                    padding="300"
                    borderRadius="200"
                    background={humanCount > 0 ? "bg-surface-caution" : "bg-surface-secondary"}
                  >
                    <BlockStack gap="100">
                      <Text as="p" variant="headingLg">{humanCount}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Manual queue</Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="100">
                      <Text as="p" variant="headingLg">{aiCount}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">AI-owned</Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="100">
                      <Text as="p" variant="headingLg">{resolvedCount}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Resolved</Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </SectionCard>
            ) : null}

            {/* ── Recent orders ────────────────────────────────────────────── */}
            <SectionCard
              title="Recent orders"
              subtitle="Latest order events seen by Recete."
            >
              {data.recentOrders.length > 0 ? (
                <BlockStack gap="0">
                  {data.recentOrders.slice(0, 8).map((order, index) => (
                    <Box
                      key={order.id}
                      paddingBlock="300"
                      borderBlockStartWidth={index > 0 ? "025" : undefined}
                      borderColor="border-secondary"
                    >
                      <InlineStack align="space-between" blockAlign="center" wrap>
                        <BlockStack gap="025">
                          <Text as="p" variant="bodyMd" fontWeight="medium">
                            {order.external_order_id || order.id}
                          </Text>
                          <Text as="p" variant="bodyXs" tone="subdued">
                            {new Intl.DateTimeFormat("en", {
                              month: "short",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(order.created_at))}
                          </Text>
                        </BlockStack>
                        <Badge
                          tone={
                            order.status === "delivered"
                              ? "success"
                              : order.status === "created"
                                ? "info"
                                : "attention"
                          }
                        >
                          {order.status}
                        </Badge>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              ) : (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No orders visible yet. Once orders flow through Recete, they appear here.
                </Text>
              )}
            </SectionCard>

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
