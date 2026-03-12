import { Hono } from 'hono';
import { verifyShopifyGdprWebhook } from '../middleware/shopifyGdprHmac.js';
import { getSupabaseServiceClient, logger } from '@recete/shared';
import { permanentlyDeleteMerchantData } from '../lib/dataDeletion.js';
import { normalizeAndHashPhone } from '../lib/phoneLookup.js';
import { exportUserData } from '../lib/dataExport.js';

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
            const supabase = getSupabaseServiceClient();
            const shopDomain = payload.shop_domain;
            const customerId = payload.customer?.id?.toString() || null;
            const customerEmail = typeof payload.customer?.email === 'string'
                ? payload.customer.email.trim().toLowerCase()
                : null;
            const customerPhone = typeof payload.customer?.phone === 'string'
                ? payload.customer.phone.trim()
                : null;

            let phoneLookupHash: string | null = null;
            if (customerPhone) {
                try {
                    phoneLookupHash = normalizeAndHashPhone(customerPhone).phoneLookupHash;
                } catch (phoneError) {
                    logger.warn({ phoneError, shopDomain, customerPhone }, '[GDPR] Customer data request phone normalization failed.');
                }
            }

            if (!shopDomain || (!customerId && !customerEmail && !phoneLookupHash)) {
                logger.warn({ payload }, '[GDPR] Customer data request missing shop or customer identifiers.');
                return;
            }

            const { data: integration } = await supabase
                .from('integrations')
                .select('merchant_id')
                .eq('provider', 'shopify')
                .contains('auth_data', { shop: shopDomain })
                .maybeSingle();

            if (!integration?.merchant_id) {
                logger.warn({ shopDomain }, '[GDPR] Customer data request shop not found locally.');
                return;
            }

            const userFilters: Array<{ field: 'shopify_customer_id' | 'email' | 'phone_lookup_hash'; value: string }> = [];
            if (customerId) {
                userFilters.push({ field: 'shopify_customer_id', value: customerId });
            }
            if (customerEmail) {
                userFilters.push({ field: 'email', value: customerEmail });
            }
            if (phoneLookupHash) {
                userFilters.push({ field: 'phone_lookup_hash', value: phoneLookupHash });
            }

            let matchedUserId: string | null = null;
            for (const filter of userFilters) {
                const { data: user } = await supabase
                    .from('users')
                    .select('id')
                    .eq('merchant_id', integration.merchant_id)
                    .eq(filter.field, filter.value)
                    .maybeSingle();

                if (user?.id) {
                    matchedUserId = user.id;
                    break;
                }
            }

            if (!matchedUserId) {
                logger.warn({ shopDomain, customerId, customerEmail }, '[GDPR] Customer data request did not match any local users.');
                return;
            }

            const exportPayload = await exportUserData(matchedUserId);
            const { error: persistError, data: persistedExport } = await supabase
                .from('gdpr_exports')
                .insert({
                    merchant_id: integration.merchant_id,
                    user_id: matchedUserId,
                    source: 'shopify_customers_data_request',
                    shop_domain: shopDomain,
                    status: 'ready',
                    payload: exportPayload,
                    requested_at: new Date().toISOString(),
                })
                .select('id')
                .single();

            if (persistError) {
                logger.error(
                    { persistError, shopDomain, merchantId: integration.merchant_id, userId: matchedUserId },
                    '[GDPR] Customer data request export could not be persisted.'
                );
                return;
            }

            logger.info(
                {
                    shopDomain,
                    merchantId: integration.merchant_id,
                    userId: matchedUserId,
                    gdprExportId: persistedExport?.id,
                },
                '[GDPR] Customer data request export prepared and persisted.'
            );
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
            const customerId = payload.customer?.id?.toString() || null;
            const customerEmail = typeof payload.customer?.email === 'string'
                ? payload.customer.email.trim().toLowerCase()
                : null;
            const customerPhone = typeof payload.customer?.phone === 'string'
                ? payload.customer.phone.trim()
                : null;

            logger.info({ shopDomain, customerId, customerEmail }, '[GDPR] Müşteri spesifik silme isteği işleniyor.');

            if (shopDomain && (customerId || customerEmail || customerPhone)) {
                // Find the merchant via the Shopify integration
                const { data: integration } = await supabase
                    .from('integrations')
                    .select('merchant_id')
                    .eq('provider', 'shopify')
                    .contains('auth_data', { shop: shopDomain })
                    .maybeSingle();

                if (integration?.merchant_id) {
                    const userFilters: Array<{ field: 'shopify_customer_id' | 'email' | 'phone_lookup_hash'; value: string }> = [];
                    if (customerId) {
                        userFilters.push({ field: 'shopify_customer_id', value: customerId });
                    }
                    if (customerEmail) {
                        userFilters.push({ field: 'email', value: customerEmail });
                    }
                    let normalizedPhone: string | null = null;
                    if (customerPhone) {
                        try {
                            const phoneLookup = normalizeAndHashPhone(customerPhone);
                            normalizedPhone = phoneLookup.normalizedPhone;
                            userFilters.push({ field: 'phone_lookup_hash', value: phoneLookup.phoneLookupHash });
                        } catch (phoneError) {
                            logger.warn({ phoneError, shopDomain, customerPhone }, '[GDPR] Telefon normalize edilemedi; phone lookup atlanıyor.');
                        }
                    }

                    let userIds: string[] = [];
                    for (const filter of userFilters) {
                        const { data: matchedUsers, error: userLookupError } = await supabase
                            .from('users')
                            .select('id')
                            .eq('merchant_id', integration.merchant_id)
                            .eq(filter.field, filter.value)
                            .limit(50);

                        if (userLookupError) {
                            logger.warn({ userLookupError, filter, shopDomain }, '[GDPR] users lookup failed during customer redact.');
                            continue;
                        }

                        const matchedIds = (matchedUsers || []).map((user: any) => user.id).filter(Boolean);
                        userIds = [...new Set([...userIds, ...matchedIds])];
                    }

                    if (userIds.length === 0) {
                        logger.warn({ shopDomain, customerId, customerEmail }, '[GDPR] Customer redact request did not match any local users.');
                        return;
                    }

                    if (normalizedPhone) {
                        await supabase
                            .from('whatsapp_inbound_events')
                            .delete()
                            .eq('merchant_id', integration.merchant_id)
                            .eq('from_phone', normalizedPhone);
                    }

                    await supabase
                        .from('whatsapp_outbound_events')
                        .delete()
                        .eq('merchant_id', integration.merchant_id)
                        .in('user_id', userIds);

                    await supabase
                        .from('conversations')
                        .delete()
                        .eq('merchant_id', integration.merchant_id)
                        .in('user_id', userIds);

                    if (customerId) {
                        await supabase
                            .from('external_events')
                            .delete()
                            .eq('merchant_id', integration.merchant_id)
                            .contains('payload', { customer: { shopify_customer_id: customerId } });
                    }

                    if (customerEmail) {
                        await supabase
                            .from('external_events')
                            .delete()
                            .eq('merchant_id', integration.merchant_id)
                            .contains('payload', { customer: { email: customerEmail } });
                    }

                    if (normalizedPhone) {
                        await supabase
                            .from('external_events')
                            .delete()
                            .eq('merchant_id', integration.merchant_id)
                            .contains('payload', { customer: { phone: normalizedPhone } });
                    }

                    await supabase
                        .from('users')
                        .delete()
                        .eq('merchant_id', integration.merchant_id)
                        .in('id', userIds);

                    logger.info({ shopDomain, customerId, customerEmail, merchantId: integration.merchant_id, userIds }, '[GDPR] Müşteri verisi silindi.');
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
