/**
 * Merchant routes
 * CRUD operations for merchant profile and settings
 */

import { Hono } from 'hono';
import { getSupabaseServiceClient } from '@recete/shared';
import { authMiddleware } from '../middleware/auth.js';
import { getMerchantBotInfo, setMerchantBotInfoKey } from '../lib/botInfo.js';
import { SYSTEM_GUARDRAILS, type CustomGuardrail } from '../lib/guardrails.js';

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
      .select('id, name, persona_settings, notification_phone, created_at, updated_at')
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
    const allowedFields = ['name', 'persona_settings', 'notification_phone'];
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

    if (body.notification_phone !== undefined) {
      // Allow empty string to clear the field
      updates.notification_phone = body.notification_phone?.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400);
    }

    const serviceClient = getSupabaseServiceClient();
    const { data: merchant, error } = await serviceClient
      .from('merchants')
      .update(updates)
      .eq('id', merchantId)
      .select('id, name, persona_settings, notification_phone, created_at, updated_at')
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
 * Get Guardrails (system read-only + merchant custom)
 * GET /api/merchants/me/guardrails
 */
merchants.get('/me/guardrails', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const serviceClient = getSupabaseServiceClient();
    const { data: merchant, error } = await serviceClient
      .from('merchants')
      .select('guardrail_settings')
      .eq('id', merchantId)
      .single();

    if (error) {
      const message =
        error.code === '42703'
          ? 'Guardrails column missing. Run DB migration 008_merchant_guardrails.sql in Supabase.'
          : error.message;
      return c.json({ error: 'Failed to load guardrails', message }, 500);
    }
    if (!merchant) {
      return c.json({ error: 'Merchant not found' }, 404);
    }

    const settings = (merchant.guardrail_settings as { custom_guardrails?: CustomGuardrail[] }) ?? {};
    const customGuardrails = Array.isArray(settings.custom_guardrails) ? settings.custom_guardrails : [];

    return c.json({
      system_guardrails: SYSTEM_GUARDRAILS,
      custom_guardrails: customGuardrails,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Update Custom Guardrails
 * PUT /api/merchants/me/guardrails
 * Body: { custom_guardrails: CustomGuardrail[] }
 */
merchants.put('/me/guardrails', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const body = (await c.req.json()) as { custom_guardrails?: unknown[] };

    if (!body || !Array.isArray(body.custom_guardrails)) {
      return c.json({ error: 'custom_guardrails must be an array' }, 400);
    }

    const normalized: CustomGuardrail[] = [];
    for (let i = 0; i < body.custom_guardrails.length; i++) {
      const r = body.custom_guardrails[i] as Record<string, unknown>;
      if (!r || typeof r.name !== 'string' || r.name.trim() === '') {
        return c.json({ error: `custom_guardrails[${i}].name is required and must be a non-empty string` }, 400);
      }
      const apply_to = r.apply_to as string;
      if (apply_to !== 'user_message' && apply_to !== 'ai_response' && apply_to !== 'both') {
        return c.json({ error: `custom_guardrails[${i}].apply_to must be user_message, ai_response, or both` }, 400);
      }
      const match_type = r.match_type as string;
      if (match_type !== 'keywords' && match_type !== 'phrase') {
        return c.json({ error: `custom_guardrails[${i}].match_type must be keywords or phrase` }, 400);
      }
      let value: string[] | string;
      if (match_type === 'phrase') {
        value = typeof r.value === 'string' ? r.value.trim() : (Array.isArray(r.value) ? String((r.value as unknown[])[0] ?? '').trim() : '');
        if (!value) {
          return c.json({ error: `custom_guardrails[${i}].value must be a non-empty string for phrase` }, 400);
        }
      } else {
        const raw = r.value;
        if (Array.isArray(raw)) {
          value = raw.map((v) => (typeof v === 'string' ? v.trim() : String(v).trim())).filter(Boolean);
        } else if (typeof raw === 'string') {
          value = raw.split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          return c.json({ error: `custom_guardrails[${i}].value must be a string (comma-separated) or array of strings for keywords` }, 400);
        }
        if (value.length === 0) {
          return c.json({ error: `custom_guardrails[${i}].value must have at least one keyword` }, 400);
        }
      }
      const action = r.action as string;
      if (action !== 'block' && action !== 'escalate') {
        return c.json({ error: `custom_guardrails[${i}].action must be block or escalate` }, 400);
      }
      const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `custom-${Date.now()}-${i}`;
      normalized.push({
        id,
        name: (r.name as string).trim(),
        description: typeof r.description === 'string' ? (r.description as string).trim() : undefined,
        apply_to: apply_to as 'user_message' | 'ai_response' | 'both',
        match_type: match_type as 'keywords' | 'phrase',
        value,
        action: action as 'block' | 'escalate',
        suggested_response: typeof r.suggested_response === 'string' ? (r.suggested_response as string).trim() : undefined,
      });
    }

    const serviceClient = getSupabaseServiceClient();
    const { data: merchant, error } = await serviceClient
      .from('merchants')
      .update({ guardrail_settings: { custom_guardrails: normalized } })
      .eq('id', merchantId)
      .select('guardrail_settings')
      .single();

    if (error) {
      const message =
        error.code === '42703'
          ? 'Guardrails column missing. Run DB migration 008_merchant_guardrails.sql in Supabase.'
          : error.message || 'Failed to update guardrails';
      return c.json({ error: 'Failed to update guardrails', message }, 500);
    }

    const settings = (merchant?.guardrail_settings as { custom_guardrails?: CustomGuardrail[] }) ?? {};
    return c.json({
      system_guardrails: SYSTEM_GUARDRAILS,
      custom_guardrails: Array.isArray(settings.custom_guardrails) ? settings.custom_guardrails : [],
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Get Bot Info (AI guidelines, brand, recipes overview)
 * GET /api/merchants/me/bot-info
 */
merchants.get('/me/bot-info', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const botInfo = await getMerchantBotInfo(merchantId);
    return c.json({ botInfo });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Set Bot Info: one key or bulk
 * PUT /api/merchants/me/bot-info
 * Body (one key): { key: string, value: string }
 * Body (bulk): { botInfo: Record<string, string> } — e.g. { botInfo: { brand_guidelines: '...', bot_boundaries: '...' } }
 * Suggested keys: brand_guidelines, bot_boundaries, recipe_overview, custom_instructions
 */
merchants.put('/me/bot-info', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const body = await c.req.json() as { key?: string; value?: string; botInfo?: Record<string, string> };

    if (body.botInfo && typeof body.botInfo === 'object') {
      for (const [key, value] of Object.entries(body.botInfo)) {
        if (key.trim()) await setMerchantBotInfoKey(merchantId, key.trim(), typeof value === 'string' ? value : '');
      }
    } else if (typeof body.key === 'string' && body.key.trim() !== '') {
      const value = typeof body.value === 'string' ? body.value : '';
      await setMerchantBotInfoKey(merchantId, body.key.trim(), value);
    } else {
      return c.json({ error: 'Provide either { key, value } or { botInfo: { ... } }' }, 400);
    }

    const botInfo = await getMerchantBotInfo(merchantId);
    return c.json({ botInfo });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

merchants.get('/me/api-keys', async (c) => {
  return c.json({
    error: 'API key feature removed',
    message: 'Merchant API keys are no longer supported. Use Shopify session tokens or internal service auth.',
  }, 410);
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
