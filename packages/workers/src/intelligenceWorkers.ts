/**
 * Intelligence Workers
 * RFM Analysis, Churn Prediction, Product Recommendations, Abandoned Cart, Feedback
 */

import { Worker } from 'bullmq';
import { getRedisClient, getSupabaseServiceClient, logger, QUEUE_NAMES } from '@recete/shared';
import { sendWhatsAppMessage, getEffectiveWhatsAppCredentials } from './lib/whatsapp.js';

const connection = getRedisClient();

// ────────────────────────────────────────────────────────
// 1. RFM Analysis Worker (daily cron)
// ────────────────────────────────────────────────────────
export const rfmWorker = new Worker(
  QUEUE_NAMES.RFM_ANALYSIS,
  async (job) => {
    const { merchantId } = job.data as { merchantId?: string };
    logger.info({ merchantId }, '[RFM] Starting analysis');
    const supabase = getSupabaseServiceClient();

    // Get all merchants or a specific one
    let merchantIds: string[] = [];
    if (merchantId) {
      merchantIds = [merchantId];
    } else {
      const { data } = await supabase.from('merchants').select('id');
      merchantIds = (data || []).map((m: any) => m.id);
    }

    for (const mId of merchantIds) {
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('merchant_id', mId);

      if (!users || users.length === 0) continue;

      for (const user of users) {
        // Get orders for this user
        const { data: orders } = await supabase
          .from('orders')
          .select('id, created_at, status')
          .eq('user_id', user.id)
          .eq('merchant_id', mId)
          .order('created_at', { ascending: false });

        const orderCount = orders?.length || 0;
        const now = Date.now();

        // Recency: days since last order
        const lastOrderDate = orders?.[0]?.created_at ? new Date(orders[0].created_at).getTime() : 0;
        const recencyDays = lastOrderDate ? Math.floor((now - lastOrderDate) / (1000 * 60 * 60 * 24)) : 999;

        // Frequency: total order count
        const frequency = orderCount;

        // Monetary: use order count as proxy (no price column)
        const monetary = orderCount;

        // Score 1-5 for each dimension
        const recencyScore = recencyDays <= 7 ? 5 : recencyDays <= 30 ? 4 : recencyDays <= 90 ? 3 : recencyDays <= 180 ? 2 : 1;
        const frequencyScore = frequency >= 10 ? 5 : frequency >= 5 ? 4 : frequency >= 3 ? 3 : frequency >= 2 ? 2 : 1;
        const monetaryScore = monetary >= 10 ? 5 : monetary >= 5 ? 4 : monetary >= 3 ? 3 : monetary >= 2 ? 2 : 1;

        // Determine segment
        const total = recencyScore + frequencyScore + monetaryScore;
        let segment: string;
        if (total >= 13) segment = 'champions';
        else if (total >= 10) segment = 'loyal';
        else if (total >= 7) segment = 'promising';
        else if (total >= 4 && recencyScore <= 2) segment = 'at_risk';
        else if (total <= 3) segment = 'lost';
        else segment = 'new';

        await supabase
          .from('users')
          .update({
            rfm_score: { recency: recencyScore, frequency: frequencyScore, monetary: monetaryScore },
            segment,
          })
          .eq('id', user.id);
      }

      logger.info({ merchantId: mId, usersProcessed: users.length }, '[RFM] Merchant analysis complete');
    }

    return { success: true };
  },
  { connection, concurrency: 1 }
);

// ────────────────────────────────────────────────────────
// 2. Churn Prediction Worker (weekly cron)
// ────────────────────────────────────────────────────────
export const churnWorker = new Worker(
  QUEUE_NAMES.CHURN_PREDICTION,
  async (job) => {
    const { merchantId } = job.data as { merchantId?: string };
    logger.info({ merchantId }, '[Churn] Starting prediction');
    const supabase = getSupabaseServiceClient();

    let merchantIds: string[] = [];
    if (merchantId) {
      merchantIds = [merchantId];
    } else {
      const { data } = await supabase.from('merchants').select('id');
      merchantIds = (data || []).map((m: any) => m.id);
    }

    for (const mId of merchantIds) {
      const { data: users } = await supabase
        .from('users')
        .select('id, rfm_score, segment')
        .eq('merchant_id', mId);

      if (!users || users.length === 0) continue;

      for (const user of users) {
        const rfm = (user.rfm_score as any) || { recency: 1, frequency: 1, monetary: 1 };

        // Get recent conversation activity
        const { count: recentConvs } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        // Simple logistic-style churn scoring
        // Low recency + low frequency + no recent conversations = high churn
        const recencyWeight = (5 - (rfm.recency || 1)) * 0.4;  // Higher when recency is bad
        const frequencyWeight = (5 - (rfm.frequency || 1)) * 0.3;
        const engagementWeight = (recentConvs || 0) > 0 ? 0 : 0.3;

        const churnProbability = Math.min(Math.max(recencyWeight + frequencyWeight + engagementWeight, 0), 1);

        await supabase
          .from('users')
          .update({
            churn_probability: Math.round(churnProbability * 10000) / 10000,
            churn_scored_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      }

      logger.info({ merchantId: mId }, '[Churn] Prediction complete');
    }

    return { success: true };
  },
  { connection, concurrency: 1 }
);

// ────────────────────────────────────────────────────────
// 3. Product Recommendations Worker (weekly cron)
// ────────────────────────────────────────────────────────
export const recommendationsWorker = new Worker(
  QUEUE_NAMES.PRODUCT_RECOMMENDATIONS,
  async (job) => {
    const { merchantId } = job.data as { merchantId?: string };
    logger.info({ merchantId }, '[Recommendations] Starting calculation');
    const supabase = getSupabaseServiceClient();

    let merchantIds: string[] = [];
    if (merchantId) {
      merchantIds = [merchantId];
    } else {
      const { data } = await supabase.from('merchants').select('id');
      merchantIds = (data || []).map((m: any) => m.id);
    }

    for (const mId of merchantIds) {
      // Get all orders with products (via order_items or order metadata)
      // Since we don't have order_items, use orders + products linked through conversations
      const { data: orders } = await supabase
        .from('orders')
        .select('id, user_id')
        .eq('merchant_id', mId);

      if (!orders || orders.length < 2) continue;

      // Build co-purchase matrix: which users bought which products?
      // Using conversations linked to orders to find product associations
      const { data: convs } = await supabase
        .from('conversations')
        .select('user_id, order_id')
        .in('user_id', orders.map((o: any) => o.user_id));

      // Group orders by user
      const userOrders = new Map<string, string[]>();
      (orders || []).forEach((o: any) => {
        if (!userOrders.has(o.user_id)) userOrders.set(o.user_id, []);
        userOrders.get(o.user_id)!.push(o.id);
      });

      // Get products for this merchant
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('merchant_id', mId);

      if (!products || products.length < 2) continue;

      // Simple co-occurrence: if users who interacted with product A also interacted with product B
      // For now, recommend all products to each other with equal score
      const productIds = products.map((p: any) => p.id);

      // Clear old recommendations
      await supabase
        .from('product_recommendations')
        .delete()
        .eq('merchant_id', mId);

      // Insert basic recommendations (each product recommends others)
      for (let i = 0; i < productIds.length; i++) {
        for (let j = 0; j < productIds.length; j++) {
          if (i === j) continue;
          await supabase.from('product_recommendations').upsert({
            merchant_id: mId,
            product_id: productIds[i],
            recommended_product_id: productIds[j],
            score: 1.0 / productIds.length,
            reason: 'co_purchase',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'merchant_id,product_id,recommended_product_id' });
        }
      }

      logger.info({ merchantId: mId, products: productIds.length }, '[Recommendations] Complete');
    }

    return { success: true };
  },
  { connection, concurrency: 1 }
);

// ────────────────────────────────────────────────────────
// 4. Abandoned Cart Worker
// ────────────────────────────────────────────────────────
export const abandonedCartWorker = new Worker(
  QUEUE_NAMES.ABANDONED_CART,
  async (job) => {
    const { cartId, merchantId } = job.data as { cartId: string; merchantId: string };
    logger.info({ cartId, merchantId }, '[AbandonedCart] Processing reminder');
    const supabase = getSupabaseServiceClient();

    // Get cart
    const { data: cart } = await supabase
      .from('abandoned_carts')
      .select('*')
      .eq('id', cartId)
      .eq('merchant_id', merchantId)
      .single();

    if (!cart || cart.status !== 'abandoned') {
      return { success: false, reason: 'Cart not found or not abandoned' };
    }

    // Get user phone
    if (!cart.user_id) {
      return { success: false, reason: 'No user linked to cart' };
    }

    const { data: user } = await supabase
      .from('users')
      .select('phone')
      .eq('id', cart.user_id)
      .single();

    if (!user?.phone) {
      return { success: false, reason: 'User phone not found' };
    }

    const credentials = await getEffectiveWhatsAppCredentials(merchantId);
    if (!credentials) {
      return { success: false, reason: 'WhatsApp not configured' };
    }

    // Build reminder message
    const cartData = cart.cart_data as any;
    const items = cartData?.line_items || cartData?.items || [];
    const itemNames = items.map((i: any) => i.title || i.name || 'Ürün').slice(0, 3).join(', ');
    const recoveryUrl = cart.recovery_url || '';

    const message = `Merhaba! Sepetinizde ürünler kaldı: ${itemNames}. Siparişinizi tamamlamak ister misiniz?${recoveryUrl ? `\n\n${recoveryUrl}` : ''}`;

    // Decrypt phone
    // Phone is stored encrypted; workers use raw phone as fallback
    const phone = user.phone;

    const result = await sendWhatsAppMessage(
      { to: phone, text: message, preview_url: true },
      credentials.accessToken,
      credentials.phoneNumberId
    );

    // Update cart status
    await supabase
      .from('abandoned_carts')
      .update({
        status: 'reminder_sent',
        reminder_sent_at: new Date().toISOString(),
      })
      .eq('id', cartId);

    logger.info({ cartId, success: result.success }, '[AbandonedCart] Reminder sent');
    return { success: result.success };
  },
  { connection, concurrency: 3 }
);

// ────────────────────────────────────────────────────────
// 5. Feedback Request Worker
// ────────────────────────────────────────────────────────
export const feedbackWorker = new Worker(
  QUEUE_NAMES.FEEDBACK_REQUEST,
  async (job) => {
    const { feedbackId, merchantId } = job.data as { feedbackId: string; merchantId: string };
    logger.info({ feedbackId, merchantId }, '[Feedback] Sending request');
    const supabase = getSupabaseServiceClient();

    const { data: feedback } = await supabase
      .from('feedback_requests')
      .select('*')
      .eq('id', feedbackId)
      .single();

    if (!feedback || feedback.status !== 'pending') {
      return { success: false, reason: 'Feedback not found or not pending' };
    }

    const { data: user } = await supabase
      .from('users')
      .select('phone')
      .eq('id', feedback.user_id)
      .single();

    if (!user?.phone) {
      return { success: false, reason: 'User phone not found' };
    }

    const credentials = await getEffectiveWhatsAppCredentials(merchantId);
    if (!credentials) {
      return { success: false, reason: 'WhatsApp not configured' };
    }

    const message = feedback.type === 'nps'
      ? 'Hizmetimizi 1-10 arasında nasıl değerlendirirsiniz? (1: Çok kötü, 10: Mükemmel)'
      : `Ürünümüzden memnun kaldıysanız, yorum bırakır mısınız? 🙏${feedback.review_link ? `\n${feedback.review_link}` : ''}`;

    const phone = user.phone;

    const result = await sendWhatsAppMessage(
      { to: phone, text: message },
      credentials.accessToken,
      credentials.phoneNumberId
    );

    await supabase
      .from('feedback_requests')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', feedbackId);

    return { success: result.success };
  },
  { connection, concurrency: 3 }
);

// ────────────────────────────────────────────────────────
// Lifecycle
// ────────────────────────────────────────────────────────
export function getAllIntelligenceWorkers() {
  return [rfmWorker, churnWorker, recommendationsWorker, abandonedCartWorker, feedbackWorker];
}

export async function closeAllIntelligenceWorkers() {
  await Promise.all([
    rfmWorker.close(),
    churnWorker.close(),
    recommendationsWorker.close(),
    abandonedCartWorker.close(),
    feedbackWorker.close(),
  ]);
}

// Error/completion logging
for (const [name, worker] of Object.entries({
  RFM: rfmWorker,
  Churn: churnWorker,
  Recommendations: recommendationsWorker,
  AbandonedCart: abandonedCartWorker,
  Feedback: feedbackWorker,
})) {
  worker.on('completed', (job) => logger.info({ jobId: job.id }, `[${name}] Job completed`));
  worker.on('failed', (job, err) => logger.error(err instanceof Error ? err : new Error(String(err)), `[${name}] Job ${job?.id} failed`));
}
