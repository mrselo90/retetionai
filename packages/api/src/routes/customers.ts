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

const customers = new Hono();
const CUSTOMERS_CACHE_TTL_SECONDS = 15;
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

    // Get order counts and conversation counts in batch
    const [orderCounts, convCounts] = await Promise.all([
      serviceClient.from('orders').select('user_id').in('user_id', userIds.length ? userIds : ['']),
      serviceClient.from('conversations').select('user_id').in('user_id', userIds.length ? userIds : ['']),
    ]);

    const orderCountMap = new Map<string, number>();
    (orderCounts.data || []).forEach((o: any) => {
      orderCountMap.set(o.user_id, (orderCountMap.get(o.user_id) || 0) + 1);
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
        createdAt: u.created_at,
      };
    });

    const payload = {
      customers: formattedCustomers,
      total: count || 0,
      page,
      limit,
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
