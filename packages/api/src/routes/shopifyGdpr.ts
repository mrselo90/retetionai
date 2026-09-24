import { Hono } from 'hono';
import { verifyShopifyGdprWebhook } from '../middleware/shopifyGdprHmac.js';
import { findShopifyIntegration } from '../lib/shopifyIntegrationLookup.js';
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
  // No activeOnly: shop/redact arrives 48h after uninstall, when the
  // integration is no longer active and still has to be found.
  const { integration, error } = await findShopifyIntegration(supabase, shopDomain);

  // Throw rather than return null. A null here reads as "we hold no data for
  // this shop", so the request was acknowledged and never acted on — a GDPR
  // deletion silently skipped. Throwing makes the webhook answer 500 and the job
  // retry, which is what an unanswered data request should do.
  if (error) {
    throw new Error(`Shopify integration lookup failed for GDPR request: ${error.message}`);
  }

  return integration?.merchant_id || null;
}

async function enqueueGdprJob(jobType: ShopifyGdprJobType, payload: ShopifyGdprPayload) {
  const supabase = getSupabaseServiceClient();
  const merchantId = await resolveMerchantId(payload.shop_domain || null);

  if (!merchantId) {
    logger.warn(
      { jobType, shopDomain: payload.shop_domain },
      '[GDPR] No local merchant found for Shopify compliance webhook.'
    );
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
    // 500, not the 200 this used to fall through to. A 200 tells Shopify the
    // request was handled, so a failed enqueue meant a data request that was
    // acknowledged and never acted on. 500 makes Shopify redeliver it.
    return c.text('Failed to enqueue GDPR job', 500);
  }

  return c.text('OK', 200);
});

shopifyGdpr.post('/customers/redact', async (c) => {
  const payload = c.get('parsedGdprBody');

  try {
    await enqueueGdprJob('customers_redact', payload);
  } catch (error) {
    logger.error({ error, payload }, '[GDPR] Failed to enqueue customer redact job.');
    // 500, not the 200 this used to fall through to. A 200 tells Shopify the
    // request was handled, so a failed enqueue meant a data request that was
    // acknowledged and never acted on. 500 makes Shopify redeliver it.
    return c.text('Failed to enqueue GDPR job', 500);
  }

  return c.text('OK', 200);
});

shopifyGdpr.post('/shop/redact', async (c) => {
  const payload = c.get('parsedGdprBody');

  try {
    await enqueueGdprJob('shop_redact', payload);
  } catch (error) {
    logger.error({ error, payload }, '[GDPR] Failed to enqueue shop redact job.');
    // 500, not the 200 this used to fall through to. A 200 tells Shopify the
    // request was handled, so a failed enqueue meant a data request that was
    // acknowledged and never acted on. 500 makes Shopify redeliver it.
    return c.text('Failed to enqueue GDPR job', 500);
  }

  return c.text('OK', 200);
});

export default shopifyGdpr;
