import { getSupabaseServiceClient, logger } from '@recete/shared';
import { permanentlyDeleteMerchantData } from './dataDeletion.js';
import { normalizeAndHashPhone } from './phoneLookup.js';
import { exportUserData } from './dataExport.js';

export type ShopifyGdprJobType =
  | 'customers_data_request'
  | 'customers_redact'
  | 'shop_redact';

type ShopifyCustomerPayload = {
  id?: string | number | null;
  email?: string | null;
  phone?: string | null;
};

type ShopifyGdprPayload = {
  shop_domain?: string | null;
  customer?: ShopifyCustomerPayload | null;
};

async function resolveMerchantId(shopDomain?: string | null): Promise<string | null> {
  if (!shopDomain) return null;
  const supabase = getSupabaseServiceClient();
  const { data: integration } = await supabase
    .from('integrations')
    .select('merchant_id')
    .eq('provider', 'shopify')
    .contains('auth_data', { shop: shopDomain })
    .maybeSingle();

  return integration?.merchant_id || null;
}

async function resolveUserIds(
  merchantId: string,
  customer?: ShopifyCustomerPayload | null,
): Promise<{ userIds: string[]; normalizedPhone: string | null }> {
  const supabase = getSupabaseServiceClient();
  const customerId = customer?.id?.toString() || null;
  const customerEmail =
    typeof customer?.email === 'string' ? customer.email.trim().toLowerCase() : null;
  const customerPhone = typeof customer?.phone === 'string' ? customer.phone.trim() : null;

  const userFilters: Array<{
    field: 'shopify_customer_id' | 'email' | 'phone_lookup_hash';
    value: string;
  }> = [];

  if (customerId) userFilters.push({ field: 'shopify_customer_id', value: customerId });
  if (customerEmail) userFilters.push({ field: 'email', value: customerEmail });

  let normalizedPhone: string | null = null;
  if (customerPhone) {
    try {
      const phoneLookup = normalizeAndHashPhone(customerPhone);
      normalizedPhone = phoneLookup.normalizedPhone;
      userFilters.push({ field: 'phone_lookup_hash', value: phoneLookup.phoneLookupHash });
    } catch (phoneError) {
      logger.warn({ phoneError, merchantId, customerPhone }, '[GDPR] Phone normalization failed while resolving user ids.');
    }
  }

  let userIds: string[] = [];
  for (const filter of userFilters) {
    const { data: matchedUsers, error } = await supabase
      .from('users')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq(filter.field, filter.value)
      .limit(50);

    if (error) {
      logger.warn({ error, merchantId, filter }, '[GDPR] Failed resolving users for GDPR job.');
      continue;
    }

    const ids = (matchedUsers || []).map((user: { id: string }) => user.id).filter(Boolean);
    userIds = [...new Set([...userIds, ...ids])];
  }

  return { userIds, normalizedPhone };
}

async function processCustomersDataRequest(jobId: string, merchantId: string, payload: ShopifyGdprPayload) {
  const supabase = getSupabaseServiceClient();
  const shopDomain = payload.shop_domain || null;
  const customer = payload.customer || null;
  const { userIds } = await resolveUserIds(merchantId, customer);

  if (userIds.length === 0) {
    logger.warn({ jobId, shopDomain }, '[GDPR] Customer data request did not match any local users.');
    return;
  }

  const matchedUserId = userIds[0];
  const exportPayload = await exportUserData(matchedUserId);

  const { error: persistError } = await supabase
    .from('gdpr_exports')
    .insert({
      merchant_id: merchantId,
      user_id: matchedUserId,
      source: 'shopify_customers_data_request',
      shop_domain: shopDomain,
      status: 'ready',
      payload: exportPayload,
      requested_at: new Date().toISOString(),
    });

  if (persistError) {
    throw new Error(`Failed to persist GDPR export: ${persistError.message}`);
  }
}

async function processCustomersRedact(jobId: string, merchantId: string, payload: ShopifyGdprPayload) {
  const supabase = getSupabaseServiceClient();
  const shopDomain = payload.shop_domain || null;
  const customer = payload.customer || null;
  const customerId = customer?.id?.toString() || null;
  const customerEmail =
    typeof customer?.email === 'string' ? customer.email.trim().toLowerCase() : null;

  const { userIds, normalizedPhone } = await resolveUserIds(merchantId, customer);
  if (userIds.length === 0) {
    logger.warn({ jobId, shopDomain, customerId, customerEmail }, '[GDPR] Customer redact request did not match any local users.');
    return;
  }

  if (normalizedPhone) {
    await supabase
      .from('whatsapp_inbound_events')
      .delete()
      .eq('merchant_id', merchantId)
      .eq('from_phone', normalizedPhone);
  }

  await supabase
    .from('whatsapp_outbound_events')
    .delete()
    .eq('merchant_id', merchantId)
    .in('user_id', userIds);

  await supabase
    .from('conversations')
    .delete()
    .eq('merchant_id', merchantId)
    .in('user_id', userIds);

  if (customerId) {
    await supabase
      .from('external_events')
      .delete()
      .eq('merchant_id', merchantId)
      .contains('payload', { customer: { shopify_customer_id: customerId } });
  }

  if (customerEmail) {
    await supabase
      .from('external_events')
      .delete()
      .eq('merchant_id', merchantId)
      .contains('payload', { customer: { email: customerEmail } });
  }

  if (normalizedPhone) {
    await supabase
      .from('external_events')
      .delete()
      .eq('merchant_id', merchantId)
      .contains('payload', { customer: { phone: normalizedPhone } });
  }

  await supabase
    .from('users')
    .delete()
    .eq('merchant_id', merchantId)
    .in('id', userIds);
}

async function processShopRedact(merchantId: string) {
  await permanentlyDeleteMerchantData(merchantId);
}

export async function processShopifyGdprJob(
  jobId: string,
  jobType: ShopifyGdprJobType,
  payload: ShopifyGdprPayload,
  merchantId?: string | null,
) {
  const supabase = getSupabaseServiceClient();
  const resolvedMerchantId = merchantId || (await resolveMerchantId(payload.shop_domain || null));

  if (!resolvedMerchantId) {
    logger.warn({ jobId, jobType, shopDomain: payload.shop_domain }, '[GDPR] No merchant found for job.');
    return;
  }

  switch (jobType) {
    case 'customers_data_request':
      await processCustomersDataRequest(jobId, resolvedMerchantId, payload);
      return;
    case 'customers_redact':
      await processCustomersRedact(jobId, resolvedMerchantId, payload);
      return;
    case 'shop_redact':
      await processShopRedact(resolvedMerchantId);
      return;
    default:
      await supabase
        .from('gdpr_jobs')
        .update({
          status: 'failed',
          last_error: `Unsupported GDPR job type: ${jobType}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      throw new Error(`Unsupported GDPR job type: ${jobType}`);
  }
}
