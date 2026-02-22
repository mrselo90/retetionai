import { Context, Next } from 'hono';
import * as crypto from 'crypto';

export const verifyShopifyGdprWebhook = async (c: Context<{ Variables: { parsedGdprBody: any } }>, next: Next) => {
    const hmacHeader = c.req.header('x-shopify-hmac-sha256');

    if (!hmacHeader) {
        return c.json({ error: 'Missing HMAC header' }, 401);
    }

    try {
        const rawBody = await c.req.text();
        const secret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET || '';

        const generatedHash = crypto
            .createHmac('sha256', secret)
            .update(rawBody, 'utf8')
            .digest('base64');

        if (generatedHash !== hmacHeader) {
            console.warn('⚠️ Geçersiz Shopify GDPR Webhook isteği engellendi.');
            return c.json({ error: 'Unauthorized - Invalid HMAC' }, 401);
        }

        const jsonBody = JSON.parse(rawBody);
        c.set('parsedGdprBody', jsonBody);

        await next();
    } catch (error) {
        console.error('⚠️ GDPR Webhook Parse Hatası:', error);
        return c.json({ error: 'Bad Request' }, 400);
    }
};
