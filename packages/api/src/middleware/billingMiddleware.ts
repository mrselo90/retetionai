import { Context, Next } from 'hono';
import { isSubscriptionActive } from '../lib/billing.js';

/**
 * Ensures the merchant has an active or trial subscription before using core features.
 */
export async function requireActiveSubscription(c: Context, next: Next) {
    const merchantId = c.get('merchantId');

    if (!merchantId) {
        return c.json({ error: 'Unauthorized: No merchant ID found in context' }, 401);
    }

    // Exempt internal paths if authenticated via valid API key
    const isInternal = c.get('internalCall');
    if (isInternal) {
        return await next();
    }

    const active = await isSubscriptionActive(merchantId);
    if (!active) {
        return c.json({
            error: 'PaymentRequired',
            message: 'Uygulamanın bu özelliğini kullanmak için aktif bir aboneliğiniz (veya deneme sürümünüz) olması gerekmektedir.'
        }, 402);
    }

    await next();
}
