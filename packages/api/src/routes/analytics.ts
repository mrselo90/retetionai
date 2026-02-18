/**
 * Analytics routes
 * Dashboard statistics and analytics
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseServiceClient } from '@glowguide/shared';
import { getCache, setCache } from '../lib/cache.js';

const analytics = new Hono();

// All routes require authentication
analytics.use('/*', authMiddleware);

/**
 * Get Analytics Dashboard Data
 * GET /api/analytics/dashboard?startDate=...&endDate=...
 */
analytics.get('/dashboard', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const startDate = c.req.query('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = c.req.query('endDate') || new Date().toISOString();

    // Check cache first (5 minute cache)
    const cacheKey = `${merchantId}:${startDate}:${endDate}`;
    const cached = await getCache<any>('analytics_dashboard', cacheKey);
    if (cached) {
      return c.json(cached);
    }

    const serviceClient = getSupabaseServiceClient();

    // Get merchant's users
    const { data: merchantUsers } = await serviceClient
      .from('users')
      .select('id')
      .eq('merchant_id', merchantId);

    const userIds = merchantUsers?.map((u) => u.id) || [];

    // Get 30 days ago date
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Optimize: Fetch all conversations from last 30 days at once
    const { data: recentConversations } = userIds.length > 0 
      ? await serviceClient
          .from('conversations')
          .select('user_id, updated_at, history')
          .in('user_id', userIds)
          .gte('updated_at', thirtyDaysAgo.toISOString())
      : { data: [] };

    // Optimize: Fetch all scheduled tasks from last 30 days at once
    const { data: recentTasks } = userIds.length > 0
      ? await serviceClient
          .from('scheduled_tasks')
          .select('user_id, executed_at')
          .in('user_id', userIds)
          .eq('status', 'completed')
          .gte('executed_at', thirtyDaysAgo.toISOString())
      : { data: [] };

    // Build DAU and Message Volume data in memory
    const dauMap = new Map<string, Set<string>>();
    const messageMap = new Map<string, { sent: number; received: number }>();

    // Initialize all 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      dauMap.set(dateStr, new Set());
      messageMap.set(dateStr, { sent: 0, received: 0 });
    }

    // Process conversations (for DAU and received messages)
    (recentConversations || []).forEach((conv: any) => {
      const updatedDate = new Date(conv.updated_at);
      updatedDate.setHours(0, 0, 0, 0);
      const dateStr = updatedDate.toISOString().split('T')[0];
      
      if (dauMap.has(dateStr)) {
        dauMap.get(dateStr)!.add(conv.user_id);
        
        // Count received messages
        const history = (conv.history as any[]) || [];
        const receivedCount = history.filter((msg) => msg.role === 'user').length;
        const current = messageMap.get(dateStr)!;
        messageMap.set(dateStr, { ...current, received: current.received + receivedCount });
      }
    });

    // Process scheduled tasks (for sent messages)
    (recentTasks || []).forEach((task: any) => {
      const executedDate = new Date(task.executed_at);
      executedDate.setHours(0, 0, 0, 0);
      const dateStr = executedDate.toISOString().split('T')[0];
      
      if (messageMap.has(dateStr)) {
        const current = messageMap.get(dateStr)!;
        messageMap.set(dateStr, { ...current, sent: current.sent + 1 });
      }
    });

    // Convert maps to arrays
    const dauData: Array<{ date: string; count: number }> = [];
    const messageVolume: Array<{ date: string; sent: number; received: number }> = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      dauData.push({
        date: dateStr,
        count: dauMap.get(dateStr)?.size || 0,
      });

      const msgData = messageMap.get(dateStr) || { sent: 0, received: 0 };
      messageVolume.push({
        date: dateStr,
        ...msgData,
      });
    }

    // Average Sentiment - last 30 days
    const { data: analyticsEvents } = await serviceClient
      .from('analytics_events')
      .select('sentiment_score, created_at')
      .eq('merchant_id', merchantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('sentiment_score', 'is', null);

    const avgSentiment = analyticsEvents && analyticsEvents.length > 0
      ? analyticsEvents.reduce((sum, e) => sum + (Number(e.sentiment_score) || 0), 0) / analyticsEvents.length
      : 0;

    // Interaction Rate (users with at least 1 conversation / total users)
    const { count: totalUsers } = await serviceClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);

    const { count: usersWithConversations } = await serviceClient
      .from('conversations')
      .select('user_id', { count: 'exact', head: true })
      .in('user_id', userIds);

    const interactionRate = totalUsers && totalUsers > 0
      ? Math.round((usersWithConversations || 0) / totalUsers * 100)
      : 0;

    // Return Rate (orders with status 'returned' / total orders)
    const { count: totalOrders } = await serviceClient
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);

    const { count: returnedOrders } = await serviceClient
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('status', 'returned');

    const returnRate = totalOrders && totalOrders > 0
      ? Math.round((returnedOrders || 0) / totalOrders * 100)
      : 0;

    const result = {
      period: {
        startDate,
        endDate,
      },
      dau: dauData,
      messageVolume,
      metrics: {
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        interactionRate,
        returnRate,
        totalUsers: totalUsers || 0,
        totalOrders: totalOrders || 0,
      },
    };

    // Cache for 5 minutes (300 seconds)
    await setCache('analytics_dashboard', cacheKey, result, 300);

    return c.json(result);
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * ROI Dashboard
 * GET /api/analytics/roi
 * Returns saved returns, repeat purchases, and ROI metrics
 */
analytics.get('/roi', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const serviceClient = getSupabaseServiceClient();

    // Get merchant's users
    const { data: merchantUsers } = await serviceClient
      .from('users')
      .select('id')
      .eq('merchant_id', merchantId);

    const userIds = (merchantUsers || []).map((u: any) => u.id);

    if (userIds.length === 0) {
      return c.json({
        roi: {
          savedReturns: 0,
          repeatPurchases: 0,
          totalConversations: 0,
          resolvedConversations: 0,
          messagesTotal: 0,
          avgSentiment: 0,
          interactionRate: 0,
        },
      });
    }

    // Saved returns: conversations that started with complaint and are now resolved
    const { data: allConversations } = await serviceClient
      .from('conversations')
      .select('id, history, current_state, conversation_status')
      .in('user_id', userIds);

    let savedReturns = 0;
    let totalMessageCount = 0;
    const conversationsTotal = allConversations?.length || 0;
    const resolvedCount = allConversations?.filter((cv: any) => cv.conversation_status === 'resolved').length || 0;

    (allConversations || []).forEach((conv: any) => {
      const history = (conv.history as any[]) || [];
      totalMessageCount += history.length;

      // A "saved return" is a conversation that contains complaint keywords early
      // but ends with positive keywords
      if (history.length >= 2) {
        const firstUserMsg = history.find((m: any) => m.role === 'user');
        const lastUserMsg = [...history].reverse().find((m: any) => m.role === 'user');
        if (firstUserMsg && lastUserMsg) {
          const first = (firstUserMsg.content || '').toLowerCase();
          const last = (lastUserMsg.content || '').toLowerCase();
          const hadComplaint = first.includes('kötü') || first.includes('şikayet') || first.includes('problem') || first.includes('iade');
          const endedPositive = last.includes('teşekkür') || last.includes('sağol') || last.includes('harika') || last.includes('anladım');
          if (hadComplaint && endedPositive) savedReturns++;
        }
      }
    });

    // Repeat purchases: users with conversations who have >1 order
    const { data: repeatData } = await serviceClient
      .from('orders')
      .select('user_id')
      .eq('merchant_id', merchantId)
      .in('user_id', userIds);

    const ordersByUser = new Map<string, number>();
    (repeatData || []).forEach((o: any) => {
      ordersByUser.set(o.user_id, (ordersByUser.get(o.user_id) || 0) + 1);
    });

    // Users with conversations
    const usersWithConvs = new Set((allConversations || []).map((cv: any) => cv.user_id));
    let repeatPurchases = 0;
    ordersByUser.forEach((count, uid) => {
      if (usersWithConvs.has(uid) && count > 1) repeatPurchases++;
    });

    // Avg sentiment from analytics_events
    const { data: sentimentEvents } = await serviceClient
      .from('analytics_events')
      .select('sentiment_score')
      .eq('merchant_id', merchantId)
      .not('sentiment_score', 'is', null);

    const avgSentiment = sentimentEvents && sentimentEvents.length > 0
      ? sentimentEvents.reduce((sum: number, e: any) => sum + (Number(e.sentiment_score) || 0), 0) / sentimentEvents.length
      : 0;

    const interactionRate = userIds.length > 0
      ? Math.round((usersWithConvs.size / userIds.length) * 100)
      : 0;

    return c.json({
      roi: {
        savedReturns,
        repeatPurchases,
        totalConversations: conversationsTotal,
        resolvedConversations: resolvedCount,
        messagesTotal: totalMessageCount,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        interactionRate,
        usersWithConversations: usersWithConvs.size,
        totalUsers: userIds.length,
      },
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default analytics;
