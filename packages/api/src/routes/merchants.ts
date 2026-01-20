/**
 * Merchant routes
 * CRUD operations for merchant profile and settings
 */

import { Hono } from 'hono';
import { getSupabaseServiceClient } from '@glowguide/shared';
import { authMiddleware } from '../middleware/auth';

const merchants = new Hono();

// All routes require authentication
merchants.use('/*', authMiddleware);

/**
 * Get Current Merchant (Protected)
 * GET /api/merchants/me
 */
merchants.get('/me', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    
    const serviceClient = getSupabaseServiceClient();
    const { data: merchant, error } = await serviceClient
      .from('merchants')
      .select('id, name, persona_settings, created_at, updated_at')
      .eq('id', merchantId)
      .single();
    
    if (error || !merchant) {
      return c.json({ error: 'Merchant not found' }, 404);
    }
    
    return c.json({ merchant });
  } catch (error) {
    return c.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Update Current Merchant (Protected)
 * PUT /api/merchants/me
 */
merchants.put('/me', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const body = await c.req.json();
    
    // Validate allowed fields
    const allowedFields = ['name', 'persona_settings'];
    const updates: Record<string, any> = {};
    
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return c.json({ error: 'Name must be a non-empty string' }, 400);
      }
      updates.name = body.name.trim();
    }
    
    if (body.persona_settings !== undefined) {
      if (typeof body.persona_settings !== 'object' || Array.isArray(body.persona_settings)) {
        return c.json({ error: 'persona_settings must be an object' }, 400);
      }
      updates.persona_settings = body.persona_settings;
    }
    
    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400);
    }
    
    const serviceClient = getSupabaseServiceClient();
    const { data: merchant, error } = await serviceClient
      .from('merchants')
      .update(updates)
      .eq('id', merchantId)
      .select('id, name, persona_settings, created_at, updated_at')
      .single();
    
    if (error) {
      return c.json({ error: 'Failed to update merchant' }, 500);
    }
    
    return c.json({ merchant });
  } catch (error) {
    return c.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Get Merchant API Keys (Protected)
 * GET /api/merchants/me/api-keys
 * Returns list of API key hashes (for display purposes, not the actual keys)
 */
merchants.get('/me/api-keys', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    
    const serviceClient = getSupabaseServiceClient();
    const { data: merchant, error } = await serviceClient
      .from('merchants')
      .select('api_keys')
      .eq('id', merchantId)
      .single();
    
    if (error || !merchant) {
      return c.json({ error: 'Merchant not found' }, 404);
    }
    
    const apiKeys = (merchant.api_keys as string[]) || [];
    
    // Return key count and last 8 chars of each hash for identification
    const keyList = apiKeys.map((hash, index) => ({
      id: index,
      hash: hash.substring(0, 8) + '...', // Show only first 8 chars
      created_at: null, // TODO: Add created_at tracking if needed
    }));
    
    return c.json({ 
      apiKeys: keyList,
      count: activeKeys.length,
      maxKeys: 5
    });
  } catch (error) {
    return c.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Get Dashboard Statistics (Protected)
 * GET /api/merchants/me/stats
 * Returns KPIs and recent activity for dashboard
 */
merchants.get('/me/stats', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const serviceClient = getSupabaseServiceClient();
    
    // Get current month start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    // Total Orders (this month)
    const { count: ordersCount } = await serviceClient
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .gte('created_at', monthStart);
    
    // Active Users (users with consent_status = 'active')
    const { count: activeUsersCount } = await serviceClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('consent_status', 'active');
    
    // Messages Sent (this month) - from scheduled_tasks via users
    // Get user IDs for this merchant first
    const { data: merchantUsers } = await serviceClient
      .from('users')
      .select('id')
      .eq('merchant_id', merchantId);
    
    const userIds = merchantUsers?.map(u => u.id) || [];
    
    let messagesCount = 0;
    if (userIds.length > 0) {
      const { count } = await serviceClient
        .from('scheduled_tasks')
        .select('*', { count: 'exact', head: true })
        .in('user_id', userIds)
        .eq('status', 'completed')
        .gte('created_at', monthStart);
      messagesCount = count || 0;
    }
    
    // Total Products
    const { count: productsCount } = await serviceClient
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);
    
    // Response Rate (conversations with at least 2 messages / total conversations)
    // Get conversations via user_id
    let conversations: any[] = [];
    if (userIds.length > 0) {
      const { data } = await serviceClient
        .from('conversations')
        .select('id, history')
        .in('user_id', userIds);
      conversations = data || [];
    }
    
    // Calculate message count from history array
    const conversationsWithCounts = conversations.map(c => ({
      id: c.id,
      messageCount: Array.isArray(c.history) ? c.history.length : 0,
    }));
    
    const totalConversations = conversationsWithCounts.length;
    const conversationsWithResponse = conversationsWithCounts.filter(c => c.messageCount >= 2).length;
    const responseRate = totalConversations > 0 
      ? Math.round((conversationsWithResponse / totalConversations) * 100) 
      : 0;
    
    // Recent Orders (last 5)
    const { data: recentOrders } = await serviceClient
      .from('orders')
      .select('id, external_order_id, status, created_at, delivery_date')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Recent Conversations (last 5) - via user_id
    let recentConversations: any[] = [];
    if (userIds.length > 0) {
      const { data } = await serviceClient
        .from('conversations')
        .select('id, user_id, updated_at, history, current_state')
        .in('user_id', userIds)
        .order('updated_at', { ascending: false })
        .limit(5);
      
      recentConversations = (data || []).map(c => ({
        id: c.id,
        user_id: c.user_id,
        last_message_at: c.updated_at,
        message_count: Array.isArray(c.history) ? c.history.length : 0,
        status: c.current_state || 'active',
      }));
    }
    
    // Critical Alerts
    const alerts: Array<{ type: string; message: string; severity: 'error' | 'warning' | 'info' }> = [];
    
    // Check integrations status
    const { data: integrations } = await serviceClient
      .from('integrations')
      .select('id, provider, status, auth_data')
      .eq('merchant_id', merchantId);
    
    integrations?.forEach((integration) => {
      if (integration.status === 'error') {
        alerts.push({
          type: 'integration_error',
          message: `${integration.provider} entegrasyonunda hata var`,
          severity: 'error',
        });
      }
    });
    
    // Check if no integrations
    if (!integrations || integrations.length === 0) {
      alerts.push({
        type: 'no_integration',
        message: 'Henüz entegrasyon eklenmemiş',
        severity: 'warning',
      });
    }
    
    // Check if no products
    if (productsCount === 0) {
      alerts.push({
        type: 'no_products',
        message: 'Henüz ürün eklenmemiş',
        severity: 'info',
      });
    }
    
    return c.json({
      kpis: {
        totalOrders: ordersCount || 0,
        activeUsers: activeUsersCount || 0,
        messagesSent: messagesCount || 0,
        totalProducts: productsCount || 0,
        responseRate,
      },
      recentActivity: {
        orders: recentOrders || [],
        conversations: recentConversations || [],
      },
      alerts,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return c.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default merchants;
