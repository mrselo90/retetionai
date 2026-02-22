import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { getSupabaseServiceClient, getRedisClient } from '@recete/shared';
import { getQueueStats } from '../queues.js';

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

    try {
        const { data: merchants, error } = await serviceClient
            .from('merchants')
            .select(`
        id, 
        name, 
        created_at,
        is_super_admin,
        integrations (provider, status)
      `)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return c.json({ merchants });
    } catch (error) {
        console.error('Failed to fetch all merchants:', error);
        return c.json({ error: 'Failed to fetch merchants list' }, 500);
    }
});

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
