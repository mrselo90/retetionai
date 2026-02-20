import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { getSupabaseServiceClient } from '@recete/shared';

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

export default admin;
