import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChatIcon, PersonIcon } from "@shopify/polaris-icons";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { fetchMerchantConversations } from "../platform.server";
import { MetricCard, ShellPage } from "../components/shell-ui";

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
    <ShellPage
      title="Conversations"
      subtitle="Buyer threads and escalations."
      primaryAction={
        firstHuman
          ? { content: `Handle next (${humanCount})`, url: `/app/conversations/${firstHuman.id}`, icon: ChatIcon }
          : { content: "View customers", url: "/app/customers", icon: PersonIcon }
      }
    >
      {/* ── Alert banner when human queue is non-empty ──────────────────── */}
      {humanCount > 0 && !unavailableReason ? (
        <Card padding="400" roundedAbove="sm" background="bg-surface-caution">
          <InlineStack align="space-between" blockAlign="center" wrap gap="300">
            <BlockStack gap="050">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                {`${humanCount} thread${humanCount === 1 ? "" : "s"} need${humanCount === 1 ? "s" : ""} your reply`}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Escalated to human — buyer is waiting.
              </Text>
            </BlockStack>
            {firstHuman ? (
              <Button url={`/app/conversations/${firstHuman.id}`} variant="primary" icon={ChatIcon}>
                Handle next
              </Button>
            ) : null}
          </InlineStack>
        </Card>
      ) : null}

      {unavailableReason ? (
        <Card padding="400" roundedAbove="sm" background="bg-surface-caution">
          <Text as="p" variant="bodyMd">{unavailableReason}</Text>
        </Card>
      ) : null}

      {/* ── Metrics ─────────────────────────────────────────────────────── */}
      <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
        <MetricCard label="Total" value={conversations.length} hint="All tracked threads." />
        <MetricCard label="Needs reply" value={humanCount} hint="Threads in human queue." />
        <MetricCard label="AI handling" value={aiCount} hint="Conversations still owned by bot." />
        <MetricCard label="Resolved" value={resolvedCount} hint="Closed threads." />
      </InlineGrid>

      {/* ── Conversation list ────────────────────────────────────────────── */}
      <Card padding="0" roundedAbove="sm">
        {sorted.length === 0 ? (
          <Box padding="500">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="semibold">No conversations yet</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Threads appear here after orders flow through Recete and buyers start responding.
              </Text>
            </BlockStack>
          </Box>
        ) : (
          <BlockStack gap="0">
            {sorted.map((conversation, index) => (
              <Box
                key={conversation.id}
                padding="400"
                borderBlockStartWidth={index > 0 ? "025" : undefined}
                borderColor="border-secondary"
              >
                <InlineStack align="space-between" blockAlign="center" wrap gap="300">
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
                      <Text as="p" variant="bodyXs" tone="subdued">
                        {conversation.phone || "No phone"}
                      </Text>
                      <Text as="p" variant="bodyXs" tone="subdued">
                        {`${conversation.messageCount ?? 0} messages`}
                      </Text>
                      {conversation.lastMessageAt ? (
                        <Text as="p" variant="bodyXs" tone="subdued">
                          {formatRelativeTime(conversation.lastMessageAt)}
                        </Text>
                      ) : null}
                    </InlineStack>
                  </BlockStack>
                  <Button
                    url={`/app/conversations/${conversation.id}`}
                    variant={conversation.conversationStatus === "human" ? "primary" : "tertiary"}
                    icon={ChatIcon}
                    size="slim"
                  >
                    {conversation.conversationStatus === "human" ? "Reply" : "Open"}
                  </Button>
                </InlineStack>
              </Box>
            ))}
          </BlockStack>
        )}
      </Card>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
