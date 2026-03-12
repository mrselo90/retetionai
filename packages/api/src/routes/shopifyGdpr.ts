import { Hono } from 'hono';
import { verifyShopifyGdprWebhook } from '../middleware/shopifyGdprHmac.js';
import { getSupabaseServiceClient, logger } from '@recete/shared';
import { addGdprJob } from '../queues.js';
import type { ShopifyGdprJobType } from '../lib/shopifyGdprJobs.js';

type ShopifyGdprPayload = {
  shop_domain?: string | null;
  customer?: {
    id?: string | number | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

const shopifyGdpr = new Hono<{ Variables: { parsedGdprBody: ShopifyGdprPayload } }>();

shopifyGdpr.use('/*', verifyShopifyGdprWebhook as any);

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

async function enqueueGdprJob(jobType: ShopifyGdprJobType, payload: ShopifyGdprPayload) {
  const supabase = getSupabaseServiceClient();
  const merchantId = await resolveMerchantId(payload.shop_domain || null);

  if (!merchantId) {
    logger.warn({ jobType, shopDomain: payload.shop_domain }, '[GDPR] No local merchant found for Shopify compliance webhook.');
    return;
  }

  const { data: jobRecord, error } = await supabase
    .from('gdpr_jobs')
    .insert({
      merchant_id: merchantId,
      job_type: jobType,
      payload,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !jobRecord?.id) {
    throw new Error(`Failed to persist GDPR job: ${error?.message || 'missing job id'}`);
  }

  await addGdprJob({
    gdprJobId: jobRecord.id,
    merchantId,
  });

  logger.info(
    { gdprJobId: jobRecord.id, merchantId, jobType, shopDomain: payload.shop_domain },
    '[GDPR] Shopify compliance job persisted and enqueued.'
  );
}

shopifyGdpr.post('/customers/data_request', async (c) => {
  const payload = c.get('parsedGdprBody');

  try {
    await enqueueGdprJob('customers_data_request', payload);
  } catch (error) {
    logger.error({ error, payload }, '[GDPR] Failed to enqueue customer data request job.');
  }

  return c.text('OK', 200);
});

shopifyGdpr.post('/customers/redact', async (c) => {
  const payload = c.get('parsedGdprBody');

  try {
    await enqueueGdprJob('customers_redact', payload);
  } catch (error) {
    logger.error({ error, payload }, '[GDPR] Failed to enqueue customer redact job.');
  }

  return c.text('OK', 200);
});

shopifyGdpr.post('/shop/redact', async (c) => {
  const payload = c.get('parsedGdprBody');

  try {
    await enqueueGdprJob('shop_redact', payload);
  } catch (error) {
    logger.error({ error, payload }, '[GDPR] Failed to enqueue shop redact job.');
  }

  return c.text('OK', 200);
});

export default shopifyGdpr;
