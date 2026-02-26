import { Hono } from 'hono';
import { verifyShopifyGdprWebhook } from '../middleware/shopifyGdprHmac.js';
import { getSupabaseServiceClient, logger } from '@recete/shared';
import { permanentlyDeleteMerchantData } from '../lib/dataDeletion.js';

// Tamamen İzole Route
const shopifyGdpr = new Hono<{ Variables: { parsedGdprBody: any } }>();

// Tüm GDPR rotaları için HMAC Middleware'imizi zorunlu kılıyoruz
shopifyGdpr.use('/*', verifyShopifyGdprWebhook as any);

/**
 * 1. Müşteri Verisi Talep Etme (customers/data_request)
 * Shopify, mağaza sahibinin veya müşterinin bir veri panosu talep etmesi halinde bunu tetikler.
 */
shopifyGdpr.post('/customers/data_request', async (c) => {
    const payload = c.get('parsedGdprBody');

    // Arka Plan İşlemi (Macrotask - Yanıtın ağa basılmasını kesinlikle engellemez)
    setTimeout(async () => {
        try {
            // Burada sadece olay günlüğüne (logger) yazmak genelde yeterlidir.
            logger.info({ payload }, '[GDPR] Müşteri veri talebi alındı.');
        } catch (error) {
            // Korumalı Hata Yönetimi: Hata olursa bile sessizce logla, uygulamayı çökertme.
            logger.error({ error, payload }, '[GDPR] Müşteri veri talebi işlenirken hata oluştu.');
        }
    }, 0);

    // 5 Saniye Kuralı: Shopify'a anında 200 OK yanıtını dönüyoruz.
    return c.text('OK', 200);
});

/**
 * 2. Müşteri Verilerini Silme (customers/redact)
 * Müşteri verilerinin silinmesi istendiğinde tetiklenir. Kişisel tanımlanabilir veriler (PII) temizlenmelidir.
 */
shopifyGdpr.post('/customers/redact', async (c) => {
    const payload = c.get('parsedGdprBody');

    setTimeout(async () => {
        try {
            const supabase = getSupabaseServiceClient();
            const shopDomain = payload.shop_domain;
            const customerId = payload.customer?.id?.toString();

            logger.info({ shopDomain, customerId }, '[GDPR] Müşteri spesifik silme isteği işleniyor.');

            if (customerId && shopDomain) {
                // Find the merchant via the Shopify integration
                const { data: integration } = await supabase
                    .from('integrations')
                    .select('merchant_id')
                    .eq('provider', 'shopify')
                    .contains('auth_data', { shop: shopDomain })
                    .maybeSingle();

                if (integration?.merchant_id) {
                    // Anonymize PII in the 'users' table (real table, encrypted phone stored here)
                    const { error: usersError } = await supabase
                        .from('users')
                        .update({
                            name: 'Redacted',
                            phone: null,
                        })
                        .eq('merchant_id', integration.merchant_id)
                        .eq('shopify_customer_id', customerId);

                    if (usersError) {
                        logger.warn({ usersError, shopDomain, customerId }, '[GDPR] users tablosu güncellenirken hata (shopify_customer_id kolonu olmayabilir).');
                    }

                    // If no direct shopify_customer_id column on users, try via orders
                    const { data: orderUsers } = await supabase
                        .from('orders')
                        .select('user_id')
                        .eq('merchant_id', integration.merchant_id)
                        .eq('external_order_id', customerId)
                        .limit(100);

                    if (orderUsers && orderUsers.length > 0) {
                        const userIds = orderUsers.map((o: any) => o.user_id).filter(Boolean);
                        if (userIds.length > 0) {
                            await supabase
                                .from('users')
                                .update({ name: 'Redacted', phone: null })
                                .in('id', userIds);
                        }
                    }

                    logger.info({ shopDomain, customerId, merchantId: integration.merchant_id }, '[GDPR] Müşteri verisi anonimleştirildi.');
                } else {
                    logger.warn({ shopDomain, customerId }, '[GDPR] Merchant bulunamadı, müşteri verisi silinemedi.');
                }
            }
        } catch (error) {
            logger.error({ error, payload }, '[GDPR] Spesifik müşteri silme (redact) işleminde hata oluştu.');
        }
    }, 0);

    return c.text('OK', 200);
});

/**
 * 3. Mağaza Silindiğinde Verileri Silme (shop/redact)
 * Mağaza 48 saat sonra uygulamayı yüklemediğinde tetiklenir. Mağazaya ait tüm müşteri verileri uçurulmalıdır.
 */
shopifyGdpr.post('/shop/redact', async (c) => {
    const payload = c.get('parsedGdprBody');

    setTimeout(async () => {
        try {
            const supabase = getSupabaseServiceClient();
            const shopDomain = payload.shop_domain;

            logger.info({ shopDomain }, '[GDPR] Mağaza kalıcı olarak silindi. Tüm verileri temizleniyor.');

            if (shopDomain) {
                // Entegrasyon tablosundan satıcıyı (merchant_id) buluyoruz
                const { data: integration } = await supabase
                    .from('integrations')
                    .select('merchant_id')
                    .eq('provider', 'shopify')
                    .contains('auth_data', { shop: shopDomain })
                    .maybeSingle();

                if (integration?.merchant_id) {
                    // Satıcıya (Merchant) ait TÜM verileri (orders, users, products, conversations, merchants, integrations vb.) siler.
                    await permanentlyDeleteMerchantData(integration.merchant_id);
                    logger.info({ shopDomain, merchantId: integration.merchant_id }, '[GDPR] Mağazaya ait tüm veriler (Vendor Data) başarıyla silindi.');
                } else {
                    logger.warn({ shopDomain }, '[GDPR] Mağaza silme isteği geldi ancak veritabanında eşleşen entegrasyon bulunamadı. Veri silinemedi.');
                    // NOTE: 'customers' tablosu şemada mevcut değil; silme işlemi yapılmıyor.
                    // Bu durum Shopify'a 200 OK döndürerek loglanır.
                }
            }
        } catch (error) {
            logger.error({ error, payload }, '[GDPR] Mağaza bazlı silme (shop/redact) işleminde hata oluştu.');
        }
    }, 0);

    return c.text('OK', 200);
});

export default shopifyGdpr;
