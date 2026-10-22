import type { ReactNode } from 'react';
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { Form, useActionData, useLoaderData, useNavigation } from 'react-router';
import { useEffect, useState } from 'react';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';
import { useActionToast } from '../lib/appBridge';
import { AppPage } from '../components/shell-ui';
import {
  extractPlatformErrorMessage,
  fetchMerchantConversationDetail,
  sendMerchantConversationReply,
  updateMerchantConversationStatus,
} from '../platform.server';

type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const conversationId = params.conversationId;
  if (!conversationId) {
    throw new Response('Conversation not found', { status: 404 });
  }

  try {
    return await fetchMerchantConversationDetail(request, conversationId);
  } catch (error) {
    const status = error instanceof Response ? error.status : 500;
    const message = status === 404 ? 'Conversation not found' : 'Failed to load conversation';
    throw new Response(message, { status });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const conversationId = params.conversationId;
  if (!conversationId) {
    return { ok: false, error: 'Conversation not found.' } satisfies ActionResult;
  }

  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');

  try {
    if (intent === 'reply') {
      const text = String(formData.get('text') || '').trim();
      if (!text) {
        return { ok: false, error: 'Reply message is required.' } satisfies ActionResult;
      }
      await sendMerchantConversationReply(request, conversationId, text);
      return { ok: true, message: 'Reply sent successfully.' } satisfies ActionResult;
    }

    if (intent === 'status') {
      const status = String(formData.get('status') || '').trim() as 'ai' | 'human' | 'resolved';
      await updateMerchantConversationStatus(request, conversationId, status);
      return { ok: true, message: `Conversation moved to ${status}.` } satisfies ActionResult;
    }

    return { ok: false, error: 'Unknown conversation action.' } satisfies ActionResult;
  } catch (error) {
    return {
      ok: false,
      error: await extractPlatformErrorMessage(error, 'Conversation action failed.'),
    } satisfies ActionResult;
  }
};

export default function ConversationDetailPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  useActionToast(actionData?.message, actionData);
  const navigation = useNavigation();
  const conversation = data.conversation;
  const busy = navigation.state !== 'idle';
  const [replyText, setReplyText] = useState('');
  const needsAttention =
    conversation.conversationStatus === 'human' ||
    conversation.status === 'open' ||
    conversation.returnPreventionAttempt?.outcome === 'escalated';

  useEffect(() => {
    if (actionData?.ok && actionData.message?.includes('Reply sent')) {
      setReplyText('');
    }
  }, [actionData]);

  if (navigation.state === 'loading') {
    return (
      <AppPage heading="Conversation">
        <s-section>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-spinner accessibilityLabel="Loading conversation" size="base" />
            <s-text color="subdued">Loading…</s-text>
          </s-stack>
        </s-section>
      </AppPage>
    );
  }

  const statusBadge = (status: string) => {
    if (status === 'human') return <s-badge tone="warning">Needs reply</s-badge>;
    if (status === 'resolved') return <s-badge tone="success">Resolved</s-badge>;
    return <s-badge tone="info">AI handling</s-badge>;
  };

  return (
    <AppPage
      backAction={{ content: 'Conversations', url: '/app/conversations' }}
      heading={conversation.userName || 'Buyer'}
      // s-page has no title-metadata slot, so status sits with the phone number.
      subtitle={
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {statusBadge(conversation.conversationStatus)}
          <s-text color="subdued">{conversation.phone}</s-text>
        </s-stack>
      }
    >
      {busy ? (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-spinner accessibilityLabel="Loading" size="base" />
          <s-text color="subdued">Saving…</s-text>
        </s-stack>
      ) : null}

      <s-query-container>
        <s-grid gridTemplateColumns="@container (inline-size > 768px) 2fr 1fr, 1fr" gap="base">
          {/* ── Main column: alerts + history + reply ─────────────────────── */}
          <s-stack gap="base">
            {needsAttention ? (
              <s-banner
                heading={
                  conversation.conversationStatus === 'human'
                    ? 'This thread needs your reply'
                    : 'Review before leaving'
                }
                tone={conversation.conversationStatus === 'human' ? 'warning' : 'info'}
              >
                <s-paragraph>
                  {conversation.conversationStatus === 'human'
                    ? 'Escalated to human queue. Send a reply or hand back to AI.'
                    : 'Use the controls on the right to manage ownership or send a reply.'}
                </s-paragraph>
              </s-banner>
            ) : null}

            {actionData?.error ? (
              <s-banner heading="Action failed" tone="critical">
                <s-paragraph>{actionData.error}</s-paragraph>
              </s-banner>
            ) : null}

            {/* ── Chat history ──────────────────────────────────────────── */}
            <s-section heading="Message history">
              <s-stack gap="small-100">
                {conversation.history.length === 0 ? (
                  <s-paragraph color="subdued">No messages yet.</s-paragraph>
                ) : null}
                {conversation.history.map((message, index) => {
                  const isBuyer = message.role === 'user';
                  const isMerchant = message.role === 'merchant';
                  const label = isBuyer ? 'Buyer' : isMerchant ? 'You' : 'AI';

                  return (
                    <s-grid
                      key={`${message.timestamp}-${index}`}
                      justifyItems={isBuyer ? 'start' : 'end'}
                    >
                      <s-box maxInlineSize="75%">
                        <s-box
                          background={isBuyer ? 'subdued' : 'base'}
                          border={isBuyer ? undefined : 'base'}
                          borderRadius="base"
                          paddingBlock="small-200"
                          paddingInline="small"
                        >
                          <s-stack gap="small-300">
                            <s-grid gridTemplateColumns="1fr auto" gap="base">
                              <s-text type="strong" color="subdued">
                                {label}
                              </s-text>
                              <s-text color="subdued">
                                {new Date(message.timestamp).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </s-text>
                            </s-grid>
                            <s-paragraph>{message.content}</s-paragraph>
                          </s-stack>
                        </s-box>
                        <s-box paddingBlockStart="small-500">
                          <s-text color="subdued">
                            {new Date(message.timestamp).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </s-text>
                        </s-box>
                      </s-box>
                    </s-grid>
                  );
                })}
              </s-stack>
            </s-section>

            {/* ── Reply form ────────────────────────────────────────────── */}
            <s-section heading="Send a reply">
              <Form method="post">
                <input type="hidden" name="intent" value="reply" />
                <s-stack gap="small">
                  <s-text-area
                    label="Message"
                    name="text"
                    rows={4}
                    value={replyText}
                    onInput={(event) => setReplyText(event.currentTarget.value)}
                    autocomplete="off"
                    placeholder="Type your WhatsApp message…"
                    details="Sends directly to the buyer via WhatsApp."
                  />
                  <s-stack direction="inline">
                    <s-button
                      type="submit"
                      variant="primary"
                      icon="chat"
                      loading={busy}
                      disabled={!replyText.trim()}
                    >
                      Send reply
                    </s-button>
                  </s-stack>
                </s-stack>
              </Form>
            </s-section>
          </s-stack>

          {/* ── Sidebar: summary + ownership ──────────────────────────────── */}
          <s-stack gap="base">
            {/* Thread summary */}
            <s-section heading="Thread details">
              <s-stack gap="small-200">
                <SummaryRow label="Buyer" value={conversation.userName || 'Unknown'} />
                <SummaryRow label="Phone" value={conversation.phone || '—'} />
                {conversation.order?.externalOrderId ? (
                  <SummaryRow label="Order" value={conversation.order.externalOrderId} />
                ) : null}
                <SummaryRow label="Messages" value={String(conversation.history.length)} />
                {conversation.returnPreventionAttempt ? (
                  <SummaryRow
                    label="Return outcome"
                    value={
                      <s-badge
                        tone={
                          conversation.returnPreventionAttempt.outcome === 'prevented'
                            ? 'success'
                            : conversation.returnPreventionAttempt.outcome === 'escalated'
                              ? 'warning'
                              : 'info'
                        }
                      >
                        {conversation.returnPreventionAttempt.outcome}
                      </s-badge>
                    }
                  />
                ) : null}
              </s-stack>
            </s-section>

            {/* Ownership controls */}
            <s-section heading="Ownership">
              <s-stack gap="small">
                <s-paragraph color="subdued">
                  Current:{' '}
                  {conversation.conversationStatus === 'human'
                    ? 'Human'
                    : conversation.conversationStatus === 'resolved'
                      ? 'Resolved'
                      : 'AI'}
                </s-paragraph>
                <s-stack gap="small-200">
                  <OwnershipButton
                    current={conversation.conversationStatus}
                    next="ai"
                    label="Hand to AI"
                    description="Let the bot continue this thread."
                  />
                  <OwnershipButton
                    current={conversation.conversationStatus}
                    next="human"
                    label="Escalate to you"
                    description="Take over and reply manually."
                  />
                  <OwnershipButton
                    current={conversation.conversationStatus}
                    next="resolved"
                    label="Mark resolved"
                    description="Close the thread."
                  />
                </s-stack>
              </s-stack>
            </s-section>
          </s-stack>
        </s-grid>
      </s-query-container>
    </AppPage>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="start">
      <s-text color="subdued">{label}</s-text>
      {typeof value === 'string' ? <s-text type="strong">{value}</s-text> : value}
    </s-grid>
  );
}

function OwnershipButton({
  current,
  next,
  label,
  description,
}: {
  current: 'ai' | 'human' | 'resolved';
  next: 'ai' | 'human' | 'resolved';
  label: string;
  description: string;
}) {
  const isActive = current === next;
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="status" />
      <input type="hidden" name="status" value={next} />
      {/* The intent travels in the hidden inputs, not as the button's submitter value. */}
      <s-stack gap="small-500">
        <s-button
          type="submit"
          variant={isActive ? 'secondary' : 'tertiary'}
          disabled={isActive}
          inlineSize="fill"
        >
          {label}
        </s-button>
        <s-text color="subdued">{description}</s-text>
      </s-stack>
    </Form>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
