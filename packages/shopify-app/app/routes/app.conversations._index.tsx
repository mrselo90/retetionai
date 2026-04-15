import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChatIcon, PersonIcon, SettingsIcon } from "@shopify/polaris-icons";
import { InlineGrid } from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { fetchMerchantConversations } from "../platform.server";
import { ActionCard, EmptyCard, MetricCard, SectionCard, ShellPage, StatePanel } from "../components/shell-ui";

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

function formatConversationDateTime(value?: string | null) {
  if (!value) return "No timestamp";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getConversationTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export default function ConversationsPage() {
  const data = useLoaderData<typeof loader>();
  const conversations = data.conversations || [];
  const sortedConversations = [...conversations].sort((left, right) => {
    const statusWeight = (status?: string | null) => {
      if (status === "human") return 0;
      if (status === "ai") return 1;
      if (status === "resolved") return 2;
      return 3;
    };

    return statusWeight(left.conversationStatus) - statusWeight(right.conversationStatus)
      || getConversationTimestamp(right.lastMessageAt) - getConversationTimestamp(left.lastMessageAt)
      || (right.messageCount || 0) - (left.messageCount || 0);
  });
  const manualQueue = sortedConversations.filter((item) => item.conversationStatus === "human");
  const activeQueue = sortedConversations.filter((item) => item.conversationStatus !== "resolved");
  const resolvedQueue = sortedConversations.filter((item) => item.conversationStatus === "resolved");
  const humanCount = conversations.filter((item) => item.conversationStatus === "human").length;
  const resolvedCount = conversations.filter((item) => item.conversationStatus === "resolved").length;
  const aiCount = conversations.filter((item) => item.conversationStatus === "ai").length;
  const unavailableReason = "unavailableReason" in data ? data.unavailableReason : null;
  const primaryState = unavailableReason
    ? {
        title: "Conversation queue is temporarily unavailable",
        body: "The merchant should avoid making decisions from stale data until the queue loads again.",
        tone: "warning" as const,
      }
    : humanCount > 0
      ? {
          title: "Human review is required",
          body: `${humanCount} conversation${humanCount === 1 ? "" : "s"} are waiting for manual attention.`,
          tone: "warning" as const,
        }
      : conversations.length === 0
        ? {
            title: "No conversations yet",
            body: "This is expected before orders and outreach start flowing through the app.",
            tone: "info" as const,
          }
        : {
            title: "Queue is under control",
            body: "AI-owned and resolved conversations currently outweigh manual escalations.",
            tone: "success" as const,
          };

  return (
    <ShellPage
      title="Conversations"
      subtitle="Buyer conversation queue with sentiment and escalation context inside the embedded app."
      primaryAction={{
        content: manualQueue.length > 0 ? "Handle next conversation" : "Open customers",
        url: manualQueue.length > 0 ? `/app/conversations/${manualQueue[0].id}` : "/app/customers",
        icon: PersonIcon,
      }}
    >
      <StatePanel
        title={primaryState.title}
        description={primaryState.body}
        tone={primaryState.tone === "warning" ? "attention" : primaryState.tone}
        statusLabel={unavailableReason ? "Needs attention" : humanCount > 0 ? "In progress" : conversations.length === 0 ? "Ready" : "Live"}
      />

      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard label="Total" value={conversations.length} hint="Recent conversation threads available to the merchant." />
        <MetricCard label="Human queue" value={humanCount} hint="Threads marked for manual attention." />
        <MetricCard label="AI handled" value={aiCount} hint="Conversations still handled by the bot." />
        <MetricCard label="Resolved" value={resolvedCount} hint="Threads closed with sufficient message history." />
      </InlineGrid>

      <SectionCard
        title="Queue actions"
        subtitle="This screen should help the merchant decide what to handle next, not just list threads."
      >
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <ActionCard
            title="Manual queue"
            description={
              manualQueue.length > 0
                ? `${manualQueue.length} thread${manualQueue.length === 1 ? "" : "s"} need a merchant reply or ownership decision.`
                : "No conversations are waiting for manual ownership right now."
            }
            status={humanCount > 0 ? "failed" : "active"}
            action={{
              content: manualQueue.length > 0 ? "Handle next" : "Review response rules",
              url: manualQueue.length > 0 ? `/app/conversations/${manualQueue[0].id}` : "/app/settings",
              icon: SettingsIcon,
            }}
          />
          <ActionCard
            title="Active AI queue"
            description={
              activeQueue.length > 0
                ? `${activeQueue.length} active thread${activeQueue.length === 1 ? "" : "s"} are still in progress.`
                : "No active AI-owned threads are visible right now."
            }
            status="info"
            action={{
              content: activeQueue.length > 0 ? "Open next active thread" : "Inspect customer health",
              url: activeQueue.length > 0 ? `/app/conversations/${activeQueue[0].id}` : "/app/customers",
              icon: PersonIcon,
            }}
          />
          <ActionCard
            title="Resolved review"
            description={
              resolvedQueue.length > 0
                ? `${resolvedQueue.length} resolved thread${resolvedQueue.length === 1 ? "" : "s"} can be sampled for quality checks.`
                : "Resolved conversations will appear here once the queue starts closing cleanly."
            }
            status={resolvedQueue.length > 0 ? "active" : "pending"}
            action={{
              content: resolvedQueue.length > 0 ? "Review resolved thread" : "Open customers",
              url: resolvedQueue.length > 0 ? `/app/conversations/${resolvedQueue[0].id}` : "/app/customers",
              icon: ChatIcon,
            }}
          />
        </InlineGrid>
      </SectionCard>

      <SectionCard
        title="Manual priority queue"
        subtitle="Human-owned threads should stay above everything else."
      >
        {manualQueue.length > 0 ? (
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {manualQueue.map((conversation) => (
              <ActionCard
                key={conversation.id}
                title={conversation.userName || "Guest user"}
                description={`${conversation.phone || "No phone"} · ${conversation.messageCount} messages · Last message: ${formatConversationDateTime(conversation.lastMessageAt)}`}
                status={conversation.conversationStatus || conversation.sentiment || "ai"}
                action={{ content: "Reply now", url: `/app/conversations/${conversation.id}`, icon: ChatIcon }}
              />
            ))}
          </InlineGrid>
        ) : (
          <EmptyCard
            heading="No manual queue right now"
            description="That is the ideal state. If the merchant still wants to review quality, sample an active or resolved thread below."
            action={{ content: activeQueue.length > 0 ? "Open active thread" : "Check order flow", url: activeQueue.length > 0 ? `/app/conversations/${activeQueue[0].id}` : "/app/integrations" }}
          />
        )}
      </SectionCard>

      <SectionCard
        title="All recent threads"
        subtitle="Keep the full queue available, but sort it behind the priority decision."
      >
        {sortedConversations.length > 0 ? (
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {sortedConversations.map((conversation) => (
              <ActionCard
                key={conversation.id}
                title={conversation.userName || "Guest user"}
                description={`${conversation.phone || "No phone"} · ${conversation.messageCount} messages · Last message: ${formatConversationDateTime(conversation.lastMessageAt)}`}
                status={conversation.conversationStatus || conversation.sentiment || "ai"}
                action={{ content: conversation.conversationStatus === "human" ? "Reply now" : "Open thread", url: `/app/conversations/${conversation.id}`, icon: ChatIcon }}
              />
            ))}
          </InlineGrid>
        ) : (
          <EmptyCard
            heading="No conversation activity yet"
            description="Once orders start flowing into the retention engine, buyer threads will appear here."
            action={{ content: "Check order flow", url: "/app/integrations" }}
          />
        )}
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
