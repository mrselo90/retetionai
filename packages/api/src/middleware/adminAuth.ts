import { Context, Next } from 'hono';
import { getSupabaseServiceClient } from '@recete/shared';

/**
 * Admin Auth Middleware
 * Must be used AFTER authMiddleware.
 * Ensures the authenticated merchant has the is_super_admin flag set to true.
 */
export async function adminAuthMiddleware(c: Context, next: Next) {
    const merchantId = c.get('merchantId');

    if (!merchantId) {
        return c.json({ error: 'Unauthorized: Missing authentication context' }, 401);
    }

    try {
        const supabase = getSupabaseServiceClient();

        const { data: merchant, error } = await supabase
            .from('merchants')
            .select('is_super_admin')
            .eq('id', merchantId)
            .single();

        if (error || !merchant) {
            return c.json({ error: 'Forbidden: Cannot verify admin status' }, 403);
        }

        if (merchant.is_super_admin !== true) {
            return c.json({ error: 'Forbidden: Requires Super Admin privileges' }, 403);
        }

        // User is super admin, proceed
        await next();
    } catch (err) {
        console.error('Admin Auth Middleware exception:', err);
        return c.json({ error: 'Internal Server Error' }, 500);
    }
}
