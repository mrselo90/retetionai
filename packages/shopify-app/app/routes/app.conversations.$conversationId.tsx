import type { ReactNode } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigate, useNavigation } from "react-router";
import { useEffect, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChatIcon } from "@shopify/polaris-icons";
import {
  Badge,
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

  const statusBadge = (status: string) => {
    if (status === "human") return <Badge tone="attention">Needs reply</Badge>;
    if (status === "resolved") return <Badge tone="success">Resolved</Badge>;
    return <Badge tone="info">AI handling</Badge>;
  };

  return (
    <Page
      backAction={{ content: "Conversations", onAction: () => navigate("/app/conversations") }}
      title={conversation.userName || "Buyer"}
      subtitle={conversation.phone}
      titleMetadata={statusBadge(conversation.conversationStatus)}
    >
      {busy ? (
        <Box paddingBlockEnd="400">
          <InlineStack gap="200" blockAlign="center">
            <Spinner accessibilityLabel="Loading" size="small" />
            <Text as="p" variant="bodySm" tone="subdued">Saving…</Text>
          </InlineStack>
        </Box>
      ) : null}

      <Layout>
        {/* ── Main column: alerts + history + reply ─────────────────────── */}
        <Layout.Section>
          <BlockStack gap="400">

            {needsAttention ? (
              <Banner
                title={
                  conversation.conversationStatus === "human"
                    ? "This thread needs your reply"
                    : "Review before leaving"
                }
                tone={conversation.conversationStatus === "human" ? "warning" : "info"}
              >
                <Text as="p" variant="bodyMd">
                  {conversation.conversationStatus === "human"
                    ? "Escalated to human queue. Send a reply or hand back to AI."
                    : "Use the controls on the right to manage ownership or send a reply."}
                </Text>
              </Banner>
            ) : null}

            {actionData?.error ? (
              <Banner title="Action failed" tone="critical">
                <Text as="p" variant="bodyMd">{actionData.error}</Text>
              </Banner>
            ) : null}

            {actionData?.message ? (
              <Banner tone="success">
                <Text as="p" variant="bodyMd">{actionData.message}</Text>
              </Banner>
            ) : null}

            {/* ── Chat history ──────────────────────────────────────────── */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Message history</Text>
                <BlockStack gap="300">
                  {conversation.history.length === 0 ? (
                    <Text as="p" variant="bodySm" tone="subdued">No messages yet.</Text>
                  ) : null}
                  {conversation.history.map((message, index) => {
                    const isBuyer = message.role === "user";
                    const isMerchant = message.role === "merchant";
                    const label = isBuyer ? "Buyer" : isMerchant ? "You" : "AI";

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
                            borderRadius: isBuyer
                              ? "4px 12px 12px 12px"
                              : "12px 4px 12px 12px",
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
                        <Box paddingBlockStart="050">
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

            {/* ── Reply form ────────────────────────────────────────────── */}
            <Card>
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
                    placeholder="Type your WhatsApp message…"
                    helpText="Sends directly to the buyer via WhatsApp."
                  />
                  <InlineStack>
                    <Button
                      submit
                      variant="primary"
                      icon={ChatIcon as never}
                      loading={busy}
                      disabled={!replyText.trim()}
                    >
                      Send reply
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Form>
            </Card>

          </BlockStack>
        </Layout.Section>

        {/* ── Sidebar: summary + ownership ──────────────────────────────── */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">

            {/* Thread summary */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Thread details</Text>
                <BlockStack gap="200">
                  <SummaryRow label="Buyer" value={conversation.userName || "Unknown"} />
                  <SummaryRow label="Phone" value={conversation.phone || "—"} />
                  {conversation.order?.externalOrderId ? (
                    <SummaryRow label="Order" value={conversation.order.externalOrderId} />
                  ) : null}
                  <SummaryRow label="Messages" value={String(conversation.history.length)} />
                  {conversation.returnPreventionAttempt ? (
                    <SummaryRow
                      label="Return outcome"
                      value={
                        <Badge
                          tone={
                            conversation.returnPreventionAttempt.outcome === "prevented"
                              ? "success"
                              : conversation.returnPreventionAttempt.outcome === "escalated"
                                ? "attention"
                                : "info"
                          }
                        >
                          {conversation.returnPreventionAttempt.outcome}
                        </Badge>
                      }
                    />
                  ) : null}
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Ownership controls */}
            <Card>
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Ownership</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Current: {conversation.conversationStatus === "human" ? "Human" : conversation.conversationStatus === "resolved" ? "Resolved" : "AI"}
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  <OwnershipButton current={conversation.conversationStatus} next="ai" label="Hand to AI" description="Let the bot continue this thread." />
                  <OwnershipButton current={conversation.conversationStatus} next="human" label="Escalate to you" description="Take over and reply manually." />
                  <OwnershipButton current={conversation.conversationStatus} next="resolved" label="Mark resolved" description="Close the thread." />
                </BlockStack>
              </BlockStack>
            </Card>

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | ReactNode;
}) {
  return (
    <InlineStack align="space-between" blockAlign="start" gap="300" wrap>
      <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
      {typeof value === "string" ? (
        <Text as="p" variant="bodySm" fontWeight="semibold">{value}</Text>
      ) : (
        value
      )}
    </InlineStack>
  );
}

function OwnershipButton({
  current,
  next,
  label,
  description,
}: {
  current: "ai" | "human" | "resolved";
  next: "ai" | "human" | "resolved";
  label: string;
  description: string;
}) {
  const isActive = current === next;
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="status" />
      <input type="hidden" name="status" value={next} />
      <BlockStack gap="050">
        <Button
          submit
          variant={isActive ? "secondary" : "tertiary"}
          disabled={isActive}
          fullWidth
          textAlign="left"
        >
          {label}
        </Button>
        <Text as="p" variant="bodyXs" tone="subdued">{description}</Text>
      </BlockStack>
    </Form>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
