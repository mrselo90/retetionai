import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChatIcon, PersonIcon } from "@shopify/polaris-icons";
import {
  Avatar,
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  ResourceItem,
  ResourceList,
  Text,
} from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { fetchMerchantConversations } from "../platform.server";
import { MetricCard } from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);

  try {
    return await fetchMerchantConversations(request);
  } catch (error) {
    return {
      conversations: [],
      unavailableReason:
        error instanceof Error ? error.message : "Conversation data is unavailable.",
    };
  }
};

function formatRelativeTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function statusTone(status?: string | null): "attention" | "success" | "info" | undefined {
  if (status === "human") return "attention";
  if (status === "resolved") return "success";
  return "info";
}

function statusLabel(status?: string | null) {
  if (status === "human") return "Needs reply";
  if (status === "resolved") return "Resolved";
  return "AI handling";
}

export default function ConversationsPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const conversations = data.conversations || [];
  const unavailableReason = "unavailableReason" in data ? data.unavailableReason : null;

  // Sort: human first, then by recency
  const sorted = [...conversations].sort((a, b) => {
    const weight = (s?: string | null) => (s === "human" ? 0 : s === "ai" ? 1 : 2);
    const wDiff = weight(a.conversationStatus) - weight(b.conversationStatus);
    if (wDiff !== 0) return wDiff;
    return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
  });

  const humanCount = conversations.filter((c) => c.conversationStatus === "human").length;
  const aiCount = conversations.filter((c) => c.conversationStatus === "ai").length;
  const resolvedCount = conversations.filter((c) => c.conversationStatus === "resolved").length;
  const firstHuman = sorted.find((c) => c.conversationStatus === "human");

  return (
    <Page
      title="Conversations"
      subtitle="Buyer threads and escalations."
      primaryAction={
        firstHuman
          ? {
              content: `Handle next (${humanCount})`,
              onAction: () => navigate(`/app/conversations/${firstHuman.id}`),
              icon: ChatIcon as never,
            }
          : {
              content: "View customers",
              onAction: () => navigate("/app/customers"),
              icon: PersonIcon as never,
            }
      }
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">

            {/* ── Escalation alert ────────────────────────────────────────── */}
            {humanCount > 0 && !unavailableReason ? (
              <Banner
                title={`${humanCount} thread${humanCount === 1 ? "" : "s"} need${humanCount === 1 ? "s" : ""} your reply`}
                tone="warning"
                action={
                  firstHuman
                    ? { content: "Handle next", onAction: () => navigate(`/app/conversations/${firstHuman.id}`) }
                    : undefined
                }
              >
                <Text as="p" variant="bodyMd">Escalated to human — buyer is waiting.</Text>
              </Banner>
            ) : null}

            {unavailableReason ? (
              <Banner title="Conversations unavailable" tone="critical">
                <Text as="p" variant="bodyMd">{unavailableReason}</Text>
              </Banner>
            ) : null}

            {/* ── Metrics ─────────────────────────────────────────────────── */}
            <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
              <MetricCard label="Total" value={conversations.length} hint="All tracked threads." />
              <MetricCard label="Needs reply" value={humanCount} hint="Threads in human queue." />
              <MetricCard label="AI handling" value={aiCount} hint="Conversations owned by bot." />
              <MetricCard label="Resolved" value={resolvedCount} hint="Closed threads." />
            </InlineGrid>

            {/* ── Conversation list ────────────────────────────────────────── */}
            <Card padding="0">
              <ResourceList
                resourceName={{ singular: "conversation", plural: "conversations" }}
                items={sorted}
                emptyState={
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" fontWeight="semibold" alignment="center">
                      No conversations yet
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                      Threads appear here after orders flow through Recete and buyers start responding.
                    </Text>
                  </BlockStack>
                }
                renderItem={(conversation) => {
                  const isHuman = conversation.conversationStatus === "human";
                  const relativeTime = formatRelativeTime(conversation.lastMessageAt);

                  return (
                    <ResourceItem
                      id={conversation.id}
                      url={`/app/conversations/${conversation.id}`}
                      media={
                        <Avatar
                          customer
                          size="md"
                          name={conversation.userName || "Unknown"}
                        />
                      }
                      accessibilityLabel={`View conversation with ${conversation.userName || "Unknown buyer"}`}
                      shortcutActions={[
                        {
                          content: isHuman ? "Reply" : "Open",
                          url: `/app/conversations/${conversation.id}`,
                        },
                      ]}
                    >
                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text as="p" variant="bodyMd" fontWeight="semibold">
                            {conversation.userName || "Unknown buyer"}
                          </Text>
                          <Badge tone={statusTone(conversation.conversationStatus)}>
                            {statusLabel(conversation.conversationStatus)}
                          </Badge>
                        </InlineStack>
                        <InlineStack gap="300">
                          {conversation.phone ? (
                            <Text as="p" variant="bodyXs" tone="subdued">
                              {conversation.phone}
                            </Text>
                          ) : null}
                          <Text as="p" variant="bodyXs" tone="subdued">
                            {`${conversation.messageCount ?? 0} messages`}
                          </Text>
                          {relativeTime ? (
                            <Text as="p" variant="bodyXs" tone="subdued">
                              {relativeTime}
                            </Text>
                          ) : null}
                        </InlineStack>
                      </BlockStack>
                    </ResourceItem>
                  );
                }}
              />
            </Card>

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
