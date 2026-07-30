/**
 * Customer routes (Customer 360 Profiles)
 * Unified view of end-users with orders, conversations, sentiment, segments
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { decryptPhone } from '../lib/encryption.js';
import { logPersonalDataAccess } from '../lib/personalDataAudit.js';
import { getCachedApiResponse, setCachedApiResponse } from '../lib/cache.js';
import { buildCsv } from '../lib/csvExport.js';

const customers = new Hono();
const CUSTOMERS_CACHE_TTL_SECONDS = 15;

/**
 * Segments the list endpoint returns totals for, so the dashboard can label its
 * filter chips without a second round-trip. Kept in sync with the `segment`
 * values written by the RFM job.
 */
const CHIP_SEGMENTS = ['champions', 'loyal', 'promising', 'at_risk', 'lost', 'new'] as const;

/** Export caps. Supabase returns at most 1000 rows per request, so the page size
 *  matches that and the ceiling keeps one click from reading an entire tenant. */
const EXPORT_PAGE_SIZE = 1000;
const EXPORT_MAX_ROWS = 5000;

customers.use('/*', authMiddleware);

/**
 * List customers with aggregated metrics
 * GET /api/customers?page=1&limit=20&segment=&search=
 */
customers.get('/', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const authMethod = c.get('authMethod') as 'jwt' | 'shopify' | 'internal' | undefined;
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const segment = c.req.query('segment');
    const search = c.req.query('search');
    const offset = (page - 1) * limit;
    const cacheKey = `customers:${merchantId}`;
    const cacheParams = {
      page,
      limit,
      segment: segment || 'all',
      search: search || '',
    };
    const cached = await getCachedApiResponse(cacheKey, cacheParams) as {
      customers: any[];
      total: number;
      page: number;
      limit: number;
      segmentCounts?: Record<string, number>;
    } | null;

    if (cached) {
      logPersonalDataAccess({
        merchantId,
        authMethod,
        route: '/api/customers',
        action: 'read',
        resource: 'customer',
        recordCount: cached.customers.length,
      });

      return c.json(cached);
    }

    const serviceClient = getSupabaseServiceClient();

    let query = serviceClient
      .from('users')
      .select('id, name, phone, consent_status, rfm_score, segment, churn_probability, created_at', { count: 'exact' })
      .eq('merchant_id', merchantId);

    if (segment && segment !== 'all') {
      query = query.eq('segment', segment);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return c.json({ error: 'Failed to fetch customers' }, 500);
    }

    const userIds = (users || []).map((u: any) => u.id);

    // Order counts, conversation counts, and the segment totals behind the
    // filter chips. created_at rides along on a query that already runs, so the
    // last-order column costs nothing extra. The segment totals are head-only
    // counts — no rows cross the wire, which matters because a merchant's
    // customer table is unbounded.
    const [orderRows, convCounts, ...segmentTotals] = await Promise.all([
      serviceClient.from('orders').select('user_id, created_at').in('user_id', userIds.length ? userIds : ['']),
      serviceClient.from('conversations').select('user_id').in('user_id', userIds.length ? userIds : ['']),
      ...CHIP_SEGMENTS.map((seg) =>
        serviceClient
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchantId)
          .eq('segment', seg)
      ),
    ]);

    const orderCountMap = new Map<string, number>();
    const lastOrderMap = new Map<string, string>();
    (orderRows.data || []).forEach((o: any) => {
      orderCountMap.set(o.user_id, (orderCountMap.get(o.user_id) || 0) + 1);
      const current = lastOrderMap.get(o.user_id);
      if (o.created_at && (!current || o.created_at > current)) {
        lastOrderMap.set(o.user_id, o.created_at);
      }
    });

    const segmentCounts: Record<string, number> = { all: count || 0 };
    CHIP_SEGMENTS.forEach((seg, i) => {
      segmentCounts[seg] = segmentTotals[i]?.count || 0;
    });

    const convCountMap = new Map<string, number>();
    (convCounts.data || []).forEach((cv: any) => {
      convCountMap.set(cv.user_id, (convCountMap.get(cv.user_id) || 0) + 1);
    });

    const formattedCustomers = (users || []).map((u: any) => {
      let phoneDisplay = '***';
      try { if (u.phone) phoneDisplay = decryptPhone(u.phone); } catch { /* ignore decryption error */ }
      return {
        id: u.id,
        name: u.name || 'İsimsiz',
        phone: phoneDisplay,
        consent: u.consent_status,
        segment: u.segment || 'new',
        rfmScore: u.rfm_score,
        churnProbability: u.churn_probability || 0,
        orderCount: orderCountMap.get(u.id) || 0,
        conversationCount: convCountMap.get(u.id) || 0,
        lastOrderDate: lastOrderMap.get(u.id) || null,
        createdAt: u.created_at,
      };
    });

    const payload = {
      customers: formattedCustomers,
      total: count || 0,
      page,
      limit,
      segmentCounts,
    };

    logPersonalDataAccess({
      merchantId,
      authMethod,
      route: '/api/customers',
      action: 'read',
      resource: 'customer',
      recordCount: formattedCustomers.length,
    });

    await setCachedApiResponse(cacheKey, payload, CUSTOMERS_CACHE_TTL_SECONDS, cacheParams);
    return c.json(payload);
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Export the current customer view as CSV.
 * GET /api/customers/export.csv?segment=&search=
 *
 * Registered before '/:id' on purpose — Hono matches in registration order, so
 * the reverse would make this path resolve as a customer whose id is
 * "export.csv".
 *
 * The value here is the segment and churn columns: a merchant can already pull
 * names and phones out of Shopify, but at_risk / 72% is Recete's own output, and
 * the point of the export is pushing that list into an ad audience or handing it
 * to a colleague. It honours the screen's active filters for the same reason.
 *
 * This writes decrypted phone numbers into a plaintext file, so it is bounded,
 * audited, and never cached.
 */
customers.get('/export.csv', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const authMethod = c.get('authMethod') as 'jwt' | 'shopify' | 'internal' | undefined;
    const segment = c.req.query('segment');
    const search = c.req.query('search');

    const serviceClient = getSupabaseServiceClient();
    const rows: string[][] = [];
    let truncated = false;

    // Paged rather than one open-ended query: a merchant's customer table has no
    // upper bound, and Supabase caps a single response at 1000 rows anyway, so an
    // unpaged read would silently export only the first page.
    for (let offset = 0; offset < EXPORT_MAX_ROWS; offset += EXPORT_PAGE_SIZE) {
      let query = serviceClient
        .from('users')
        .select('id, name, phone, consent_status, segment, churn_probability, created_at')
        .eq('merchant_id', merchantId);

      if (segment && segment !== 'all') query = query.eq('segment', segment);
      if (search) query = query.ilike('name', `%${search}%`);

      const { data: users, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + EXPORT_PAGE_SIZE - 1);

      if (error) return c.json({ error: 'Failed to export customers' }, 500);
      if (!users?.length) break;

      const userIds = users.map((u: any) => u.id);
      const [orderRows, convRows] = await Promise.all([
        serviceClient.from('orders').select('user_id, created_at').in('user_id', userIds),
        serviceClient.from('conversations').select('user_id').in('user_id', userIds),
      ]);

      const orderCount = new Map<string, number>();
      const lastOrder = new Map<string, string>();
      (orderRows.data || []).forEach((o: any) => {
        orderCount.set(o.user_id, (orderCount.get(o.user_id) || 0) + 1);
        const current = lastOrder.get(o.user_id);
        if (o.created_at && (!current || o.created_at > current)) lastOrder.set(o.user_id, o.created_at);
      });

      const convCount = new Map<string, number>();
      (convRows.data || []).forEach((cv: any) => {
        convCount.set(cv.user_id, (convCount.get(cv.user_id) || 0) + 1);
      });

      users.forEach((u: any) => {
        let phone = '';
        try { if (u.phone) phone = decryptPhone(u.phone); } catch { /* leave blank rather than leak ciphertext */ }
        rows.push([
          u.name || '',
          phone,
          u.consent_status || '',
          u.segment || 'new',
          String(orderCount.get(u.id) || 0),
          String(convCount.get(u.id) || 0),
          lastOrder.get(u.id) || '',
          String(Math.round((u.churn_probability || 0) * 100)),
          u.created_at || '',
        ]);
      });

      if (users.length < EXPORT_PAGE_SIZE) break;
      if (rows.length >= EXPORT_MAX_ROWS) {
        // Hitting the cap is not the same as there being more to fetch: a tenant
        // with exactly EXPORT_MAX_ROWS customers is a complete export, and
        // telling them it was capped would send them filtering for rows that do
        // not exist. One head-count settles it, and only in the capped case.
        let probe = serviceClient
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchantId);
        if (segment && segment !== 'all') probe = probe.eq('segment', segment);
        if (search) probe = probe.ilike('name', `%${search}%`);
        const { count: matching } = await probe;
        truncated = (matching || 0) > rows.length;
        break;
      }
    }

    const header = [
      'name', 'phone', 'consent', 'segment', 'orders',
      'conversations', 'last_order_at', 'churn_risk_percent', 'created_at',
    ];
    const csvText = buildCsv(header, rows);

    logPersonalDataAccess({
      merchantId,
      authMethod,
      route: '/api/customers/export.csv',
      action: 'export',
      resource: 'customer',
      recordCount: rows.length,
    });

    return c.body(csvText, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="recete-customers-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
      'X-Export-Row-Count': String(rows.length),
      'X-Export-Truncated': truncated ? '1' : '0',
    });
  } catch {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get single customer detail (360 view)
 * GET /api/customers/:id
 */
customers.get('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const authMethod = c.get('authMethod') as 'jwt' | 'shopify' | 'internal' | undefined;
    const userId = c.req.param('id');
    const cacheKey = `customer:${merchantId}:${userId}`;
    const cached = await getCachedApiResponse(cacheKey) as { customer: any } | null;

    if (cached) {
      logPersonalDataAccess({
        merchantId,
        authMethod,
        route: '/api/customers/:id',
        action: 'read',
        resource: 'customer',
        targetUserId: userId,
        recordCount: 1,
      });

      return c.json(cached);
    }

    const serviceClient = getSupabaseServiceClient();

    const { data: user, error } = await serviceClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('merchant_id', merchantId)
      .single();

    if (error || !user) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    let phoneDisplay = '***';
    try { if (user.phone) phoneDisplay = decryptPhone(user.phone); } catch { /* ignore decryption error */ }

    // Get orders
    const { data: orders } = await serviceClient
      .from('orders')
      .select('id, external_order_id, status, delivery_date, created_at')
      .eq('user_id', userId)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    // Get conversations with sentiment
    const { data: conversations } = await serviceClient
      .from('conversations')
      .select('id, order_id, history, current_state, conversation_status, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    // Get feedback
    const { data: feedback } = await serviceClient
      .from('feedback_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    // Calculate LTV (sum of orders; we don't have amount so use count as proxy)
    const orderCount = orders?.length || 0;
    const totalConversations = conversations?.length || 0;

    // Average sentiment from conversations
    let totalSentiment = 0;
    let sentimentCount = 0;
    (conversations || []).forEach((conv: any) => {
      const history = (conv.history as any[]) || [];
      history.forEach((msg: any) => {
        if (msg.role === 'user') {
          const content = (msg.content || '').toLowerCase();
          if (content.includes('teşekkür') || content.includes('harika') || content.includes('mükemmel') || content.includes('çok iyi')) {
            totalSentiment += 5; sentimentCount++;
          } else if (content.includes('kötü') || content.includes('şikayet') || content.includes('problem') || content.includes('berbat')) {
            totalSentiment += 1; sentimentCount++;
          } else {
            totalSentiment += 3; sentimentCount++;
          }
        }
      });
    });
    const avgSentiment = sentimentCount > 0 ? Math.round((totalSentiment / sentimentCount) * 100) / 100 : 0;

    const lastOrder = orders?.[0];
    const lastConversation = conversations?.[0];

    const payload = {
      customer: {
        id: user.id,
        name: user.name || 'İsimsiz',
        phone: phoneDisplay,
        email: user.email,
        consent: user.consent_status,
        segment: user.segment || 'new',
        rfmScore: user.rfm_score,
        churnProbability: user.churn_probability || 0,
        createdAt: user.created_at,
        metrics: {
          orderCount,
          totalConversations,
          avgSentiment,
          lastOrderDate: lastOrder?.created_at || null,
          lastInteractionDate: lastConversation?.updated_at || null,
        },
        orders: (orders || []).map((o: any) => ({
          id: o.id,
          externalOrderId: o.external_order_id,
          status: o.status,
          deliveryDate: o.delivery_date,
          createdAt: o.created_at,
        })),
        conversations: (conversations || []).map((cv: any) => ({
          id: cv.id,
          orderId: cv.order_id,
          messageCount: ((cv.history as any[]) || []).length,
          status: cv.conversation_status || 'ai',
          lastMessage: ((cv.history as any[]) || []).slice(-1)[0] || null,
          createdAt: cv.created_at,
          updatedAt: cv.updated_at,
        })),
        feedback: feedback || [],
      },
    };

    logPersonalDataAccess({
      merchantId,
      authMethod,
      route: '/api/customers/:id',
      action: 'read',
      resource: 'customer',
      targetUserId: userId,
      recordCount: 1,
    });

    await setCachedApiResponse(cacheKey, payload, CUSTOMERS_CACHE_TTL_SECONDS);
    return c.json(payload);
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default customers;
