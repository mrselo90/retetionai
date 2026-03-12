import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigate, useNavigation } from "react-router";
import { useEffect, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ArrowLeftIcon, ChatIcon, PersonIcon } from "@shopify/polaris-icons";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  fetchMerchantConversationDetail,
  sendMerchantConversationReply,
  updateMerchantConversationStatus,
} from "../platform.server";
import { DetailRows, MetricCard, StatusBadge } from "../components/shell-ui";

type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const conversationId = params.conversationId;
  if (!conversationId) {
    throw new Response("Conversation not found", { status: 404 });
  }

  return fetchMerchantConversationDetail(request, conversationId);
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const conversationId = params.conversationId;
  if (!conversationId) {
    return { ok: false, error: "Conversation not found." } satisfies ActionResult;
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  try {
    if (intent === "reply") {
      const text = String(formData.get("text") || "").trim();
      if (!text) {
        return { ok: false, error: "Reply message is required." } satisfies ActionResult;
      }
      await sendMerchantConversationReply(request, conversationId, text);
      return { ok: true, message: "Reply sent successfully." } satisfies ActionResult;
    }

    if (intent === "status") {
      const status = String(formData.get("status") || "").trim() as "ai" | "human" | "resolved";
      await updateMerchantConversationStatus(request, conversationId, status);
      return { ok: true, message: `Conversation moved to ${status}.` } satisfies ActionResult;
    }

    return { ok: false, error: "Unknown conversation action." } satisfies ActionResult;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Conversation action failed.",
    } satisfies ActionResult;
  }
};

export default function ConversationDetailPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const conversation = data.conversation;
  const busy = navigation.state !== "idle";
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    if (actionData?.ok && actionData.message?.includes("Reply sent")) {
      setReplyText("");
    }
  }, [actionData]);

  if (navigation.state === "loading") {
    return (
      <SkeletonPage title="Conversation" primaryAction>
        <Layout>
          <Layout.Section>
            <Card padding="500">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={6} />
            </Card>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page
      backAction={{ content: "Conversations", onAction: () => navigate("/app/conversations") }}
      fullWidth
      title={conversation.userName}
      subtitle={conversation.phone}
      primaryAction={{ content: "Back to queue", onAction: () => navigate("/app/conversations"), icon: ArrowLeftIcon }}
    >
      <Layout>
        <Layout.Section>
          {busy ? <ProgressBar progress={72} size="small" /> : null}
        </Layout.Section>

        {actionData?.error ? (
          <Layout.Section>
            <Banner tone="critical">
              <Text as="p" variant="bodyMd">{actionData.error}</Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {actionData?.message ? (
          <Layout.Section>
            <Banner tone="success">
              <Text as="p" variant="bodyMd">{actionData.message}</Text>
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <MetricCard label="Messages" value={conversation.history.length} hint="Full thread length for this buyer conversation." />
            <MetricCard label="Conversation mode" value={conversation.conversationStatus} hint="Whether AI, human, or resolved owns the thread now." />
            <MetricCard label="Order" value={conversation.order?.externalOrderId || "No order"} hint="Linked order reference when available." />
            <MetricCard label="Current state" value={conversation.status} hint="Platform state machine value for the current conversation." />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card padding="500">
            <BlockStack gap="400">
              <InlineStack align="space-between" gap="300" wrap>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">Conversation controls</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Review the thread, switch ownership, and send a manual WhatsApp reply from this panel.
                  </Text>
                </BlockStack>
                <InlineStack gap="200" wrap>
                  <StatusBadge status={conversation.conversationStatus}>{conversation.conversationStatus}</StatusBadge>
                  {conversation.returnPreventionAttempt ? (
                    <StatusBadge status={conversation.returnPreventionAttempt.outcome}>
                      {conversation.returnPreventionAttempt.outcome}
                    </StatusBadge>
                  ) : null}
                </InlineStack>
              </InlineStack>

              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <Card padding="500">
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">Buyer summary</Text>
                    <DetailRows
                      rows={[
                        { label: "Buyer", value: conversation.userName },
                        { label: "Phone", value: conversation.phone },
                        { label: "Order", value: conversation.order?.externalOrderId || "No linked order" },
                        { label: "Updated", value: new Date(conversation.updatedAt).toLocaleString("en-GB") },
                      ]}
                    />
                  </BlockStack>
                </Card>

                <Card padding="500">
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">Ownership</Text>
                    <InlineStack gap="200" wrap>
                      <StatusForm current={conversation.conversationStatus} next="ai" label="AI owns thread" />
                      <StatusForm current={conversation.conversationStatus} next="human" label="Escalate to human" />
                      <StatusForm current={conversation.conversationStatus} next="resolved" label="Mark resolved" />
                    </InlineStack>
                  </BlockStack>
                </Card>
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="500">
            <BlockStack gap="400">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={ChatIcon} />
                <Text as="h2" variant="headingLg">Message history</Text>
              </InlineStack>

              <BlockStack gap="300">
                {conversation.history.map((message, index) => {
                  const tone =
                    message.role === "user"
                      ? "bg-surface-secondary"
                      : message.role === "merchant"
                        ? "bg-fill-success-secondary"
                        : "bg-fill-info-secondary";
                  return (
                    <Card key={`${message.timestamp}-${index}`} background={tone as never} padding="500">
                      <BlockStack gap="200">
                        <InlineStack align="space-between" gap="300">
                          <InlineStack gap="200" blockAlign="center">
                            <Icon source={PersonIcon} />
                            <Text as="p" variant="bodyMd" fontWeight="semibold">
                              {message.role === "user"
                                ? "Buyer"
                                : message.role === "merchant"
                                  ? "Merchant"
                                  : "AI assistant"}
                            </Text>
                          </InlineStack>
                          <Text as="p" variant="bodySm" tone="subdued">
                            {new Date(message.timestamp).toLocaleString("en-GB")}
                          </Text>
                        </InlineStack>
                        <Text as="p" variant="bodyMd">
                          {message.content}
                        </Text>
                      </BlockStack>
                    </Card>
                  );
                })}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="500">
            <Form method="post">
              <input type="hidden" name="intent" value="reply" />
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Manual reply</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Send a WhatsApp message directly to the buyer from inside the embedded shell.
                </Text>
                <TextField
                  label="Reply text"
                  name="text"
                  multiline={5}
                  value={replyText}
                  onChange={setReplyText}
                  autoComplete="off"
                />
                <InlineStack>
                  <Button submit variant="primary" loading={busy} disabled={!replyText.trim()}>
                    Send reply
                  </Button>
                </InlineStack>
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function StatusForm({
  current,
  next,
  label,
}: {
  current: "ai" | "human" | "resolved";
  next: "ai" | "human" | "resolved";
  label: string;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="status" />
      <input type="hidden" name="status" value={next} />
      <Button submit variant={current === next ? "secondary" : "primary"} disabled={current === next}>
        {label}
      </Button>
    </Form>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
