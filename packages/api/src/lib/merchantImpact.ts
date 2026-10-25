/**
 * What Recete did for a merchant over the last N days, as plain counts.
 *
 * There is no comparison group yet, so nothing here claims Recete caused an
 * outcome: "ordered again after a message" is a count of customers, not of
 * sales Recete made. The panel says so next to the numbers.
 */
import { getSupabaseServiceClient } from '@recete/shared';

export const IMPACT_WINDOWS = [7, 30, 90] as const;

export interface MerchantImpact {
  days: number;
  since: string;
  replies: {
    customerMessages: number;
    answeredByAi: number;
    /** Sent when the AI could not answer ("the team will get back to you"). */
    fallbacks: number;
    byTeam: number;
    /** Delivery and read receipts, for AI answers only. */
    delivered: number;
    read: number;
  };
  handoffs: number;
  postPurchase: { sent: number; byType: Record<string, number> };
  returns: { requests: number; handedToTeam: number; laterReturned: number };
  consent: { optIns: number; optOuts: number };
  reorders: { repeatBuyers: number; afterMessage: number };
}

export function normalizeImpactDays(value: unknown): number {
  const days = Number(value);
  return (IMPACT_WINDOWS as readonly number[]).includes(days) ? days : 30;
}

interface OrderRow { user_id: string; created_at: string }

/**
 * Customers with an order in the window who had ordered before it, and of
 * those, how many had a Recete conversation started before that order.
 */
export function countReorders(
  windowOrders: OrderRow[],
  allOrders: OrderRow[],
  firstConversationAt: Map<string, number>,
): { repeatBuyers: number; afterMessage: number } {
  // Timestamps are compared as numbers: Postgres drops trailing zeros from
  // the fraction, so the strings don't sort.
  const firstOrderAt = new Map<string, number>();
  for (const order of allOrders) {
    const at = Date.parse(order.created_at);
    const first = firstOrderAt.get(order.user_id);
    if (first === undefined || at < first) firstOrderAt.set(order.user_id, at);
  }

  const repeat = new Set<string>();
  const after = new Set<string>();
  for (const order of windowOrders) {
    const at = Date.parse(order.created_at);
    const first = firstOrderAt.get(order.user_id);
    if (first === undefined || first >= at) continue;
    repeat.add(order.user_id);
    const talked = firstConversationAt.get(order.user_id);
    if (talked !== undefined && talked < at) after.add(order.user_id);
  }
  return { repeatBuyers: repeat.size, afterMessage: after.size };
}

function chunks<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function getMerchantImpact(merchantId: string, days: number): Promise<MerchantImpact> {
  const db = getSupabaseServiceClient();
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();

  const [inbound, outbound, handoffs, scheduled, attempts, optIns, optOuts, windowOrders] =
    await Promise.all([
      db.from('whatsapp_inbound_events')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .neq('status', 'ignored')
        .gte('received_at', since),
      db.from('whatsapp_outbound_events')
        .select('message_kind, delivered_at, read_at')
        .eq('merchant_id', merchantId)
        .eq('status', 'sent')
        .in('message_kind', ['ai_primary', 'ai_fallback', 'manual'])
        .gte('requested_at', since)
        .limit(20_000),
      // The AI's handoffs stamp escalation_requested_at; the team's own
      // "take over" and the guardrails stamp escalated_at.
      db.from('conversations')
        .select('id, users!inner(merchant_id)', { count: 'exact', head: true })
        .eq('users.merchant_id', merchantId)
        .or(`escalation_requested_at.gte."${since}",escalated_at.gte."${since}"`),
      db.from('scheduled_tasks')
        .select('task_type, users!inner(merchant_id)')
        .eq('users.merchant_id', merchantId)
        .eq('status', 'completed')
        .gte('execute_at', since)
        .lte('execute_at', now.toISOString())
        .limit(20_000),
      db.from('return_prevention_attempts')
        .select('outcome, orders(status)')
        .eq('merchant_id', merchantId)
        .gte('created_at', since)
        .limit(5_000),
      db.from('users')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .eq('consent_status', 'opt_in')
        .gte('consent_updated_at', since),
      db.from('users')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .eq('consent_status', 'opt_out')
        .gte('consent_updated_at', since),
      db.from('orders')
        .select('user_id, created_at')
        .eq('merchant_id', merchantId)
        .neq('status', 'cancelled')
        .not('user_id', 'is', null)
        .gte('created_at', since)
        .limit(20_000),
    ]);

  for (const result of [inbound, outbound, handoffs, scheduled, attempts, optIns, optOuts, windowOrders]) {
    if (result.error) throw result.error;
  }

  const replies = { customerMessages: inbound.count || 0, answeredByAi: 0, fallbacks: 0, byTeam: 0, delivered: 0, read: 0 };
  for (const row of (outbound.data || []) as any[]) {
    if (row.message_kind === 'ai_primary') {
      replies.answeredByAi += 1;
      if (row.delivered_at) replies.delivered += 1;
      if (row.read_at) replies.read += 1;
    } else if (row.message_kind === 'ai_fallback') {
      replies.fallbacks += 1;
    } else {
      replies.byTeam += 1;
    }
  }

  const byType: Record<string, number> = {};
  for (const row of (scheduled.data || []) as any[]) {
    byType[row.task_type] = (byType[row.task_type] || 0) + 1;
  }

  const returns = { requests: 0, handedToTeam: 0, laterReturned: 0 };
  for (const row of (attempts.data || []) as any[]) {
    returns.requests += 1;
    if (row.outcome === 'escalated') returns.handedToTeam += 1;
    if (row.outcome === 'returned' || row.orders?.status === 'returned') returns.laterReturned += 1;
  }

  const recentOrders = (windowOrders.data || []) as OrderRow[];
  const buyerIds = [...new Set(recentOrders.map((o) => o.user_id))];
  const allOrders: OrderRow[] = [];
  const firstConversationAt = new Map<string, number>();
  for (const ids of chunks(buyerIds)) {
    const [orders, conversations] = await Promise.all([
      db.from('orders')
        .select('user_id, created_at')
        .eq('merchant_id', merchantId)
        .neq('status', 'cancelled')
        .in('user_id', ids),
      db.from('conversations')
        .select('user_id, created_at')
        .in('user_id', ids),
    ]);
    if (orders.error) throw orders.error;
    if (conversations.error) throw conversations.error;
    allOrders.push(...((orders.data || []) as OrderRow[]));
    for (const row of (conversations.data || []) as OrderRow[]) {
      const at = Date.parse(row.created_at);
      const first = firstConversationAt.get(row.user_id);
      if (first === undefined || at < first) firstConversationAt.set(row.user_id, at);
    }
  }

  return {
    days,
    since,
    replies,
    handoffs: handoffs.count || 0,
    postPurchase: { sent: Object.values(byType).reduce((sum, n) => sum + n, 0), byType },
    returns,
    consent: { optIns: optIns.count || 0, optOuts: optOuts.count || 0 },
    reorders: countReorders(recentOrders, allOrders, firstConversationAt),
  };
}
