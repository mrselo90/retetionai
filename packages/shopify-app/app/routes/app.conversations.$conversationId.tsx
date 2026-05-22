import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigate, useNavigation } from "react-router";
import { useEffect, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChatIcon } from "@shopify/polaris-icons";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Spinner,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import {
  fetchMerchantConversationDetail,
  sendMerchantConversationReply,
  updateMerchantConversationStatus,
} from "../platform.server";
import { StatusBadge } from "../components/shell-ui";

type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const conversationId = params.conversationId;
  if (!conversationId) {
    throw new Response("Conversation not found", { status: 404 });
  }

  try {
    return await fetchMerchantConversationDetail(request, conversationId);
  } catch (error) {
    const status = error instanceof Response ? error.status : 500;
    const message = status === 404 ? "Conversation not found" : "Failed to load conversation";
    throw new Response(message, { status });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
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
  const needsAttention =
    conversation.conversationStatus === "human" ||
    conversation.status === "open" ||
    conversation.returnPreventionAttempt?.outcome === "escalated";

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
      title={conversation.userName || "Buyer"}
      subtitle={conversation.phone}
    >
      <Layout>
        {busy ? (
          <Layout.Section>
            <Spinner accessibilityLabel="Loading" size="small" />
          </Layout.Section>
        ) : null}

        {needsAttention ? (
          <Layout.Section>
            <Banner
              tone={conversation.conversationStatus === "human" ? "warning" : "info"}
              title={
                conversation.conversationStatus === "human"
                  ? "This thread needs your reply"
                  : "Review before leaving"
              }
            >
              {conversation.conversationStatus === "human"
                ? "Escalated to human queue. Send a reply or hand back to AI."
                : "Use the controls below to manage ownership or send a reply."}
            </Banner>
          </Layout.Section>
        ) : null}

        {actionData?.error ? (
          <Layout.Section>
            <Banner tone="critical" title="Action failed">
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

        {/* ── Summary + Ownership ─────────────────────────────────────────── */}
        <Layout.Section>
          <Card padding="400">
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center" wrap gap="200">
                <BlockStack gap="050">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {conversation.userName || "Unknown buyer"}
                    </Text>
                    <StatusBadge status={conversation.conversationStatus}>
                      {conversation.conversationStatus === "human"
                        ? "Needs reply"
                        : conversation.conversationStatus === "resolved"
                          ? "Resolved"
                          : "AI handling"}
                    </StatusBadge>
                    {conversation.returnPreventionAttempt ? (
                      <StatusBadge status={conversation.returnPreventionAttempt.outcome}>
                        {conversation.returnPreventionAttempt.outcome}
                      </StatusBadge>
                    ) : null}
                  </InlineStack>
                  <InlineStack gap="300">
                    <Text as="p" variant="bodyXs" tone="subdued">{conversation.phone}</Text>
                    {conversation.order?.externalOrderId ? (
                      <Text as="p" variant="bodyXs" tone="subdued">
                        Order: {conversation.order.externalOrderId}
                      </Text>
                    ) : null}
                    <Text as="p" variant="bodyXs" tone="subdued">
                      {`${conversation.history.length} messages`}
                    </Text>
                  </InlineStack>
                </BlockStack>

                {/* Ownership controls */}
                <InlineStack gap="200" wrap>
                  <StatusForm current={conversation.conversationStatus} next="ai" label="AI owns" />
                  <StatusForm current={conversation.conversationStatus} next="human" label="Escalate" />
                  <StatusForm current={conversation.conversationStatus} next="resolved" label="Resolve" />
                </InlineStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ── Chat history (bubble layout) ───────────────────────────────── */}
        <Layout.Section>
          <Card padding="400">
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Message history</Text>
              <BlockStack gap="200">
                {conversation.history.length === 0 ? (
                  <Text as="p" variant="bodySm" tone="subdued">No messages yet.</Text>
                ) : null}
                {conversation.history.map((message, index) => {
                  const isBuyer = message.role === "user";
                  const isMerchant = message.role === "merchant";
                  const label = isBuyer ? "Buyer" : isMerchant ? "Merchant" : "AI";

                  return (
                    <div
                      key={`${message.timestamp}-${index}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isBuyer ? "flex-start" : "flex-end",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "75%",
                          background: isBuyer
                            ? "var(--p-color-bg-surface-secondary)"
                            : isMerchant
                              ? "var(--p-color-bg-fill-success-secondary)"
                              : "var(--p-color-bg-fill-info-secondary)",
                          borderRadius: "12px",
                          padding: "10px 14px",
                        }}
                      >
                        <BlockStack gap="100">
                          <InlineStack align="space-between" gap="300">
                            <Text as="p" variant="bodyXs" fontWeight="semibold" tone="subdued">
                              {label}
                            </Text>
                            <Text as="p" variant="bodyXs" tone="subdued">
                              {new Date(message.timestamp).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                          </InlineStack>
                          <Text as="p" variant="bodyMd">{message.content}</Text>
                        </BlockStack>
                      </div>
                      <Box paddingBlockStart="025">
                        <Text as="p" variant="bodyXs" tone="subdued">
                          {new Date(message.timestamp).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </Text>
                      </Box>
                    </div>
                  );
                })}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ── Manual reply ────────────────────────────────────────────────── */}
        <Layout.Section>
          <Card padding="400">
            <Form method="post">
              <input type="hidden" name="intent" value="reply" />
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Send a reply</Text>
                <TextField
                  label="Message"
                  name="text"
                  multiline={4}
                  value={replyText}
                  onChange={setReplyText}
                  autoComplete="off"
                  placeholder="Type your WhatsApp message..."
                  helpText="Sends directly to the buyer via WhatsApp."
                />
                <InlineStack>
                  <Button submit variant="primary" icon={ChatIcon} loading={busy} disabled={!replyText.trim()}>
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
