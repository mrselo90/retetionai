/**
 * Events from packages/wa-worker, the process holding every store's linked
 * WhatsApp session. POST /internal/wa-worker/events, signed with
 * x-wa-worker-secret (WA_WORKER_SECRET), called over loopback.
 *
 * The worker knows nothing about customers or orders. It reports what happened
 * on the line and this route turns it into Recete's own records:
 *
 *   inbound      a customer wrote -> whatsapp_inbound_events + inbound queue
 *                (the same path the Meta webhook used, so the assistant,
 *                opt-out handling and delivery-template replies are unchanged)
 *   own_message  the merchant typed on their own phone -> the conversation,
 *                and the thread is handed to the human like a dashboard reply
 *   receipt      delivered / read -> whatsapp_outbound_events
 *   connection   the line connected, dropped or was unlinked -> logged
 *
 * Idempotent on (merchant, WhatsApp message id): the worker retries anything
 * it could not deliver, so a repeat must be harmless. A non-2xx answer makes
 * the worker park the event and retry; answer 2xx only once it is stored.
 */

import { Hono } from 'hono';
import * as crypto from 'crypto';
import { getSupabaseServiceClient, logger, WHATSAPP_PROVIDER } from '@recete/shared';
import { addWhatsAppInboundJob } from '../queues.js';
import { addMessageToConversation, findUserByPhone } from '../lib/conversation.js';

type WorkerEvent = {
  type: 'inbound' | 'own_message' | 'receipt' | 'connection';
  merchantId: string;
  messageId?: string;
  phone?: string | null;
  lid?: string | null;
  chatJid?: string;
  pushName?: string;
  body?: string;
  timestamp?: string;
  messageType?: 'text' | 'image';
  media?: string;
  mimeType?: string;
  messageIds?: string[];
  status?: string;
  lastError?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secretMatches(provided: string | undefined): boolean {
  const expected = process.env.WA_WORKER_SECRET?.trim();
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isoOrNow(value: string | undefined): string {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

async function queueInbound(inboundEventId: string, merchantId: string) {
  const serviceClient = getSupabaseServiceClient();
  await addWhatsAppInboundJob({ inboundEventId, merchantId });
  await serviceClient
    .from('whatsapp_inbound_events')
    .update({ status: 'queued', queued_at: new Date().toISOString() })
    .eq('id', inboundEventId);
}

async function handleInbound(ev: WorkerEvent): Promise<{ status: number; result: string }> {
  const body = ev.body?.trim() || '';
  // A photo may come without a caption; its download keys are what matter.
  const isImage = ev.messageType === 'image' && Boolean(ev.media);
  if (!ev.messageId || (!body && !isImage)) {
    return { status: 400, result: 'messageId and body (or an image) required' };
  }

  // The number when WhatsApp disclosed it, otherwise the exact chat JID (an
  // @lid). A LID is never stored as if it were a phone number; replies to it
  // go back to the JID, which the worker accepts as a recipient.
  const from = ev.phone || ev.chatJid;
  if (!from) return { status: 400, result: 'phone or chatJid required' };

  const serviceClient = getSupabaseServiceClient();
  const timestamp = isoOrNow(ev.timestamp);
  const { data: inserted, error } = await serviceClient
    .from('whatsapp_inbound_events')
    .insert({
      merchant_id: ev.merchantId,
      provider: WHATSAPP_PROVIDER,
      external_message_id: ev.messageId,
      from_phone: from,
      phone_number_id: null,
      message_type: isImage ? 'image' : 'text',
      message_text: body || null,
      payload: {
        provider: WHATSAPP_PROVIDER,
        message: {
          from,
          messageId: ev.messageId,
          timestamp,
          text: body || undefined,
          type: isImage ? 'image' : 'text',
          // Keys to fetch the photo from WhatsApp through the worker when AI
          // vision needs it (aiVision.ts); the image itself is not stored.
          ...(isImage
            ? {
                image: {
                  providerMediaId: ev.media,
                  mimeType: ev.mimeType || undefined,
                  caption: body || undefined,
                },
              }
            : {}),
        },
        chatJid: ev.chatJid ?? null,
        lid: ev.lid ?? null,
        pushName: ev.pushName ?? null,
      },
      status: 'received',
      received_at: timestamp,
    })
    .select('id')
    .single();

  if (error) {
    if ((error as { code?: string }).code !== '23505') {
      logger.error({ error, merchantId: ev.merchantId }, 'wa-worker: failed to store inbound');
      return { status: 500, result: 'store_failed' };
    }
    // Seen before. If the earlier attempt stored it but never queued it, this
    // retry is the chance to finish the job.
    const { data: existing } = await serviceClient
      .from('whatsapp_inbound_events')
      .select('id, status')
      .eq('merchant_id', ev.merchantId)
      .eq('provider', WHATSAPP_PROVIDER)
      .eq('external_message_id', ev.messageId)
      .maybeSingle();
    if (existing?.status === 'received') {
      try {
        await queueInbound(existing.id as string, ev.merchantId);
        return { status: 200, result: 'requeued' };
      } catch (queueError) {
        logger.error({ queueError, merchantId: ev.merchantId }, 'wa-worker: requeue failed');
        return { status: 500, result: 'queue_failed' };
      }
    }
    return { status: 200, result: 'duplicate' };
  }

  try {
    await queueInbound(inserted!.id as string, ev.merchantId);
    return { status: 200, result: 'queued' };
  } catch (queueError) {
    // Stored with status 'received'; the worker's retry lands on the
    // duplicate branch above and queues it then.
    logger.error({ queueError, merchantId: ev.merchantId }, 'wa-worker: failed to queue inbound');
    return { status: 500, result: 'queue_failed' };
  }
}

/**
 * A message sent from the linked number but not by Recete: the merchant
 * answered on their phone. Without this the dashboard showed only one side of
 * the thread, and the assistant could answer something already handled.
 */
async function handleOwnMessage(ev: WorkerEvent): Promise<{ status: number; result: string }> {
  const body = ev.body?.trim();
  if (!ev.messageId || !body) return { status: 400, result: 'messageId and body required' };

  const serviceClient = getSupabaseServiceClient();

  // Recete's own send, echoed back from another device of the account.
  const { data: ours } = await serviceClient
    .from('whatsapp_outbound_events')
    .select('id')
    .eq('merchant_id', ev.merchantId)
    .eq('provider_message_id', ev.messageId)
    .limit(1);
  if (ours && ours.length > 0) return { status: 200, result: 'own_send' };

  // The echo can beat the outbox's provider_message_id update, and scheduled
  // messages do not go through the outbox at all: the same text from this line
  // in the last few minutes is ours too.
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: recentSame } = await serviceClient
    .from('whatsapp_outbound_events')
    .select('id')
    .eq('merchant_id', ev.merchantId)
    .eq('message_text', body)
    .gte('requested_at', since)
    .limit(1);
  if (recentSame && recentSame.length > 0) return { status: 200, result: 'own_send' };

  if (!ev.phone) return { status: 200, result: 'ignored_no_phone' };
  const user = await findUserByPhone(ev.phone, ev.merchantId);
  if (!user) return { status: 200, result: 'ignored_unknown_customer' };

  // Only an existing thread: a message to someone who never had one should not
  // manufacture a conversation.
  const { data: conversation } = await serviceClient
    .from('conversations')
    .select('id, conversation_status, history')
    .eq('merchant_id', ev.merchantId)
    .eq('user_id', user.userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conversation) return { status: 200, result: 'ignored_no_conversation' };

  // Scheduled messages are mirrored into history as the assistant without an
  // outbox row; if the last assistant turn has this exact text, it is ours.
  const history = Array.isArray(conversation.history) ? conversation.history : [];
  const recent = history.slice(-5) as Array<{ role?: string; content?: string }>;
  if (recent.some((m) => m?.content?.trim() === body)) {
    return { status: 200, result: 'already_in_history' };
  }

  await addMessageToConversation(conversation.id as string, 'merchant', body);
  if (conversation.conversation_status !== 'human') {
    await serviceClient
      .from('conversations')
      .update({
        conversation_status: 'human',
        escalated_at: new Date().toISOString(),
        escalation_reason: 'merchant_reply_phone',
      })
      .eq('id', conversation.id);
  }
  return { status: 200, result: 'recorded' };
}

async function handleReceipt(ev: WorkerEvent): Promise<{ status: number; result: string }> {
  const ids = (ev.messageIds ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return { status: 200, result: 'no_ids' };
  if (ev.status !== 'delivered' && ev.status !== 'read') {
    return { status: 200, result: 'ignored_status' };
  }

  const serviceClient = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const stamp = (column: 'delivered_at' | 'read_at') =>
    serviceClient
      .from('whatsapp_outbound_events')
      .update({ [column]: now })
      .eq('merchant_id', ev.merchantId)
      .in('provider_message_id', ids)
      .is(column, null);

  // Read implies delivered; both keep their first timestamp.
  const { error: deliveredError } = await stamp('delivered_at');
  if (deliveredError) return { status: 500, result: 'store_failed' };
  if (ev.status === 'read') {
    const { error: readError } = await stamp('read_at');
    if (readError) return { status: 500, result: 'store_failed' };
  }
  return { status: 200, result: 'recorded' };
}

const waWorker = new Hono();

waWorker.post('/events', async (c) => {
  if (!secretMatches(c.req.header('x-wa-worker-secret'))) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const ev = (await c.req.json().catch(() => null)) as WorkerEvent | null;
  if (!ev || typeof ev.type !== 'string' || !UUID.test(ev.merchantId ?? '')) {
    return c.json({ error: 'type and merchantId required' }, 400);
  }

  // A store deleted since the event was parked: nothing to attach it to, and
  // answering 5xx would make the worker retry it forever.
  const { data: merchant, error: merchantError } = await getSupabaseServiceClient()
    .from('merchants')
    .select('id')
    .eq('id', ev.merchantId)
    .maybeSingle();
  if (merchantError) return c.json({ error: 'lookup_failed' }, 500);
  if (!merchant) return c.json({ ok: true, result: 'unknown_merchant' }, 200);

  try {
    let outcome: { status: number; result: string };
    switch (ev.type) {
      case 'inbound':
        outcome = await handleInbound(ev);
        break;
      case 'own_message':
        outcome = await handleOwnMessage(ev);
        break;
      case 'receipt':
        outcome = await handleReceipt(ev);
        break;
      case 'connection':
        logger.warn(
          { merchantId: ev.merchantId, status: ev.status, lastError: ev.lastError ?? null },
          'wa-worker: WhatsApp line state changed'
        );
        outcome = { status: 200, result: 'logged' };
        break;
      default:
        outcome = { status: 400, result: 'unknown type' };
    }
    return c.json(
      { ok: outcome.status < 300, result: outcome.result },
      outcome.status as 200 | 400 | 500
    );
  } catch (error) {
    logger.error({ error, type: ev.type, merchantId: ev.merchantId }, 'wa-worker event failed');
    return c.json({ error: 'internal' }, 500);
  }
});

export default waWorker;
