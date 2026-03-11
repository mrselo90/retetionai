import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChatIcon, PersonIcon, SettingsIcon } from "@shopify/polaris-icons";
import { InlineGrid } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { fetchMerchantConversations } from "../platform.server";
import { ActionCard, EmptyCard, MetricCard, SectionCard, ShellPage } from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    return await fetchMerchantConversations(session.shop);
  } catch (error) {
    return {
      conversations: [],
      unavailableReason:
        error instanceof Error ? error.message : "Conversation data is unavailable.",
    };
  }
};

export default function ConversationsPage() {
  const data = useLoaderData<typeof loader>();
  const conversations = data.conversations || [];
  const humanCount = conversations.filter((item) => item.conversationStatus === "human").length;
  const resolvedCount = conversations.filter((item) => item.conversationStatus === "resolved").length;
  const aiCount = conversations.filter((item) => item.conversationStatus === "ai").length;

  return (
    <ShellPage
      title="Conversations"
      subtitle="Buyer conversation queue with sentiment and escalation context inside the embedded app."
      primaryAction={{ content: "Open customers", url: "/app/customers", icon: PersonIcon }}
    >
      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard label="Total" value={conversations.length} hint="Recent conversation threads available to the merchant." />
        <MetricCard label="Human queue" value={humanCount} hint="Threads marked for manual attention." />
        <MetricCard label="AI handled" value={aiCount} hint="Conversations still handled by the bot." />
        <MetricCard label="Resolved" value={resolvedCount} hint="Threads closed with sufficient message history." />
      </InlineGrid>

      {"unavailableReason" in data && data.unavailableReason ? (
        <SectionCard title="Data issue">
          {data.unavailableReason}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Operator guidance"
        subtitle="Merchants should quickly understand whether the queue is healthy or needs hands-on review."
      >
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <ActionCard
            title="Escalation handling"
            description="Human queue and negative sentiment are the first warning signals merchants should scan."
            status={humanCount > 0 ? "failed" : "active"}
            action={{ content: "Review settings", url: "/app/settings", icon: SettingsIcon }}
          />
          <ActionCard
            title="Customer context"
            description="Customer screen should be the next stop when a conversation looks risky or high-value."
            status="info"
            action={{ content: "Open customers", url: "/app/customers", icon: PersonIcon }}
          />
        </InlineGrid>
      </SectionCard>

      <SectionCard
        title="Recent threads"
        subtitle="A concise list is better than an unstructured dump. Detail views can come next."
      >
        {conversations.length > 0 ? (
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {conversations.map((conversation) => (
              <ActionCard
                key={conversation.id}
                title={conversation.userName || "Guest user"}
                description={`${conversation.phone || "No phone"} · ${conversation.messageCount} messages`}
                status={conversation.conversationStatus || conversation.sentiment || "ai"}
                action={{ content: "Open thread", url: `/app/conversations/${conversation.id}`, icon: ChatIcon }}
              />
            ))}
          </InlineGrid>
        ) : (
          <EmptyCard
            heading="No conversation activity yet"
            description="Once orders start flowing into the retention engine, buyer threads will appear here."
            action={{ content: "Review integrations", url: "/app/integrations" }}
          />
        )}
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
