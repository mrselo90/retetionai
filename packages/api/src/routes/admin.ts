import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { getSupabaseServiceClient, getRedisClient } from '@recete/shared';
import { getQueueStats } from '../queues.js';
import { getPlatformAiSettings, updatePlatformAiSettings } from '../lib/runtimeModelSettings.js';

const admin = new Hono();

// All admin routes require standard auth PLUS super admin privileges
admin.use('/*', authMiddleware);
admin.use('/*', adminAuthMiddleware);

/**
 * Get Global Platform Statistics
 * GET /api/admin/stats
 */
admin.get('/stats', async (c) => {
    const serviceClient = getSupabaseServiceClient();

    try {
        // We run multiple count queries in parallel for performance.
        // In a real huge production app, we would cache this or use a materialized view.
        const [
            { count: totalMerchants },
            { count: totalUsers },
            { count: totalOrders },
            { count: totalConversations }
        ] = await Promise.all([
            serviceClient.from('merchants').select('*', { count: 'exact', head: true }),
            serviceClient.from('users').select('*', { count: 'exact', head: true }),
            serviceClient.from('orders').select('*', { count: 'exact', head: true }),
            serviceClient.from('conversations').select('*', { count: 'exact', head: true })
        ]);

        return c.json({
            stats: {
                totalMerchants: totalMerchants || 0,
                totalUsers: totalUsers || 0,
                totalOrders: totalOrders || 0,
                totalConversations: totalConversations || 0
            }
        });
    } catch (error) {
        console.error('Failed to fetch admin stats:', error);
        return c.json({ error: 'Failed to fetch global stats' }, 500);
    }
});

/**
 * Get All Merchants List
 * GET /api/admin/merchants
 */
admin.get('/merchants', async (c) => {
    const serviceClient = getSupabaseServiceClient();

    const fullSelect = `
        id,
        name,
        created_at,
        is_super_admin,
        settings,
        integrations (provider, status)
    `;
    const selectWithoutSettings = `
        id,
        name,
        created_at,
        is_super_admin,
        integrations (provider, status)
    `;
    const minimalSelect = `
        id,
        name,
        created_at,
        is_super_admin
    `;

    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const resultFull = await serviceClient
            .from('merchants')
            .select(fullSelect)
            .order('created_at', { ascending: false });

        if (!resultFull.error) {
            const merchants = resultFull.data ?? [];
            const enriched = await attachAiUsageMTD(serviceClient, merchants, monthStart);
            return c.json({ merchants: enriched });
        }

        const resultWithoutSettings = await serviceClient
            .from('merchants')
            .select(selectWithoutSettings)
            .order('created_at', { ascending: false });

        if (!resultWithoutSettings.error) {
            const merchants = (resultWithoutSettings.data || []).map((m: any) => ({
                ...m,
                settings: undefined,
            }));
            const enriched = await attachAiUsageMTD(serviceClient, merchants, monthStart);
            return c.json({ merchants: enriched });
        }

        const resultMinimal = await serviceClient
            .from('merchants')
            .select(minimalSelect)
            .order('created_at', { ascending: false });

        if (resultMinimal.error) throw resultMinimal.error;

        const merchants = (resultMinimal.data || []).map((m: any) => ({
            ...m,
            settings: undefined,
            integrations: [],
        }));
        const enriched = await attachAiUsageMTD(serviceClient, merchants, monthStart);
        return c.json({ merchants: enriched });
    } catch (error) {
        console.error('Failed to fetch all merchants:', error);
        return c.json({ error: 'Failed to fetch merchants list' }, 500);
    }
});

async function attachAiUsageMTD(serviceClient: ReturnType<typeof getSupabaseServiceClient>, merchants: any[], monthStartIso: string) {
    const merchantIds = merchants.map((m: any) => m.id).filter(Boolean);
    if (!merchantIds.length) return merchants;
    const { data: usageRows, error } = await serviceClient
        .from('ai_usage_events')
        .select('merchant_id, model, total_tokens, estimated_cost_usd')
        .in('merchant_id', merchantIds)
        .gte('created_at', monthStartIso);

    if (error) {
        if (error.code !== '42P01' && error.code !== '42703') {
            console.warn('Failed to load ai_usage_events for admin merchants:', error);
        }
        return merchants.map((m: any) => ({
            ...m,
            ai_usage_mtd: {
                total_tokens: 0,
                estimated_cost_usd: 0,
                top_model: null,
                by_model: [],
            },
        }));
    }

    const agg = new Map<string, {
        totalTokens: number;
        totalCostUsd: number;
        byModel: Map<string, { tokens: number; costUsd: number }>;
    }>();

    for (const row of (usageRows || []) as any[]) {
        const merchantId = row.merchant_id as string;
        const model = String(row.model || 'unknown');
        const totalTokens = Number(row.total_tokens || 0);
        const costUsd = Number(row.estimated_cost_usd || 0);
        const entry = agg.get(merchantId) || { totalTokens: 0, totalCostUsd: 0, byModel: new Map() };
        entry.totalTokens += totalTokens;
        entry.totalCostUsd += costUsd;
        const byModel = entry.byModel.get(model) || { tokens: 0, costUsd: 0 };
        byModel.tokens += totalTokens;
        byModel.costUsd += costUsd;
        entry.byModel.set(model, byModel);
        agg.set(merchantId, entry);
    }

    return merchants.map((m: any) => {
        const a = agg.get(m.id);
        if (!a) {
            return {
                ...m,
                ai_usage_mtd: {
                    total_tokens: 0,
                    estimated_cost_usd: 0,
                    top_model: null,
                    by_model: [],
                },
            };
        }
        const byModel = [...a.byModel.entries()]
            .map(([model, v]) => ({ model, total_tokens: v.tokens, estimated_cost_usd: Number(v.costUsd.toFixed(6)) }))
            .sort((x, y) => y.total_tokens - x.total_tokens);
        return {
            ...m,
            ai_usage_mtd: {
                total_tokens: a.totalTokens,
                estimated_cost_usd: Number(a.totalCostUsd.toFixed(6)),
                top_model: byModel[0]?.model || null,
                by_model: byModel,
            },
        };
    });
}

/**
 * System Health
 * GET /api/admin/system-health
 */
admin.get('/system-health', async (c) => {
    try {
        const redisInfo = await getRedisClient().info('server');
        const queueStats = await getQueueStats();

        return c.json({
            status: 'healthy',
            redis: {
                connected: getRedisClient().status === 'ready',
                uptime: redisInfo.match(/uptime_in_seconds:(\d+)/)?.[1] || 'unknown'
            },
            queues: queueStats
        });
    } catch (error) {
        console.error('Failed to fetch system health:', error);
        return c.json({ error: 'Failed to fetch system health' }, 500);
    }
});

/**
 * Get / Update global AI model settings (super admin)
 */
admin.get('/ai-settings', async (c) => {
    try {
        const settings = await getPlatformAiSettings();
        return c.json({ settings });
    } catch (error) {
        console.error('Failed to fetch AI settings:', error);
        return c.json({ error: 'Failed to fetch AI settings' }, 500);
    }
});

admin.put('/ai-settings', async (c) => {
    try {
        const body = await c.req.json();
        const defaultLlmModel = typeof body.default_llm_model === 'string' ? body.default_llm_model.trim() : '';
        const allowedLlmModels = Array.isArray(body.allowed_llm_models)
            ? body.allowed_llm_models.map((x: unknown) => String(x)).filter(Boolean)
            : undefined;
        const conversationMemoryMode = body.conversation_memory_mode === 'full' ? 'full' : 'last_n';
        const conversationMemoryCount =
            typeof body.conversation_memory_count === 'number' ? body.conversation_memory_count : 10;
        if (!defaultLlmModel) {
            return c.json({ error: 'default_llm_model is required' }, 400);
        }
        const settings = await updatePlatformAiSettings({
            default_llm_model: defaultLlmModel,
            allowed_llm_models: allowedLlmModels,
            conversation_memory_mode: conversationMemoryMode,
            conversation_memory_count: conversationMemoryCount,
        });
        return c.json({ settings });
    } catch (error) {
        console.error('Failed to update AI settings:', error);
        return c.json({
            error: 'Failed to update AI settings',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, 500);
    }
});

/**
 * Merchant Impersonation
 * POST /api/admin/impersonate
 */
admin.post('/impersonate', async (c) => {
    const serviceClient = getSupabaseServiceClient();

    try {
        const body = await c.req.json();
        const { targetUserId } = body;

        if (!targetUserId) {
            return c.json({ error: 'Target user ID is required' }, 400);
        }

        // We ensure the target actually exists
        const { data: user, error: userError } = await serviceClient.auth.admin.getUserById(targetUserId);

        if (userError || !user) {
            return c.json({ error: 'Target user not found' }, 404);
        }

        // Use Supabase Admin API to generate a link or custom token.
        // We capture the request Origin to properly redirect to the frontend callback
        const origin = c.req.header('Origin') || c.req.header('Referer')?.split('/').slice(0, 3).join('/') || 'https://platform.recete.ai';
        const redirectTo = `${origin}/auth/callback`;

        const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
            type: 'magiclink',
            email: user.user.email as string,
            options: {
                redirectTo,
            }
        });

        if (linkError) {
            console.error('Magic link generation failed:', linkError);
            return c.json({ error: 'Failed to generate impersonation token' }, 500);
        }

        // Return the magic link to the frontend so it can redirect the current tab
        return c.json({ impersonationUrl: linkData.properties.action_link });
    } catch (error) {
        console.error('Impersonation error:', error);
        return c.json({ error: 'Failed to setup impersonation' }, 500);
    }
});
/**
 * Set Merchant Capped Amount
 * POST /api/admin/set-capped-amount
 */
admin.post('/set-capped-amount', async (c) => {
    const serviceClient = getSupabaseServiceClient();

    try {
        const body = await c.req.json();
        const { merchantId, cappedAmount } = body;

        if (!merchantId || cappedAmount === undefined) {
            return c.json({ error: 'merchantId and cappedAmount are required' }, 400);
        }

        // Validate cappedAmount is a positive number
        if (typeof cappedAmount !== 'number' || cappedAmount <= 0) {
            return c.json({ error: 'cappedAmount must be a positive number' }, 400);
        }

        const { error } = await serviceClient
            .from('merchants')
            .update({
                // Assuming the db has a capped_amount column now, or store in a jsonb config.
                // Default implementation stores it in metadata/config depending on your DB architecture.
                // Or ideally, this triggers a logic to re-subscribe the user in Shopify with the new Cap.
                // But usually, modifying Capped Amount requires user approval on Shopify!
                // Let's store it locally and we'd trigger a billing flow.
                settings: { capped_amount: cappedAmount } // Example fallback
            })
            // Realistically you should update the DB and then email/notify merchant to accept new charge!
            .eq('id', merchantId);

        if (error) {
            console.error('Failed to update capped amount:', error);
            return c.json({ error: 'Failed to update merchant' }, 500);
        }

        return c.json({ success: true, message: `Capped amount set to ${cappedAmount} for merchant ${merchantId}. They must approve the new charge.` });
    } catch (error) {
        console.error('Update capped amount error:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

export default admin;
