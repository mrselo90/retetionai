/**
 * Upsell logic utilities
 * Satisfaction detection and product recommendations
 */

import { getSupabaseServiceClient } from '@glowguide/shared';
import { getOpenAIClient } from './openaiClient.js';

export interface SatisfactionResult {
  satisfied: boolean;
  confidence: number; // 0-1
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface ProductRecommendation {
  productId: string;
  productName: string;
  productUrl: string;
  reason: string; // Why this product is recommended
}

/**
 * Detect satisfaction from user message
 */
export async function detectSatisfaction(
  message: string
): Promise<SatisfactionResult> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cheap for sentiment
      messages: [
        {
          role: 'system',
          content: `You are a sentiment analyzer. Analyze the user's message and determine if they are satisfied with the product.
Respond with JSON: { "satisfied": true/false, "confidence": 0.0-1.0, "sentiment": "positive"/"neutral"/"negative" }`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(
      response.choices[0]?.message?.content || '{}'
    ) as SatisfactionResult;

    return result;
  } catch (error) {
    console.error('Satisfaction detection error:', error);
    // Default to neutral
    return {
      satisfied: false,
      confidence: 0.5,
      sentiment: 'neutral',
    };
  }
}

/**
 * Get complementary products for an order
 * Simple rule-based: Get other products from same merchant
 * In production, this would use product relationships, categories, etc.
 */
export async function getComplementaryProducts(
  orderId: string,
  merchantId: string,
  limit: number = 3
): Promise<ProductRecommendation[]> {
  const serviceClient = getSupabaseServiceClient();

  // Get order products (from order items or external_order_id)
  // For MVP, we'll get all products from merchant (excluding order products if we had order_items table)
  // Since we don't have order_items, we'll just get top products

  const { data: products, error } = await serviceClient
    .from('products')
    .select('id, name, url')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit + 5); // Get more to filter

  if (error || !products || products.length === 0) {
    return [];
  }

  // For MVP, return top products with generic reasons
  // In production, use product categories, tags, or ML-based recommendations
  const recommendations: ProductRecommendation[] = products.slice(0, limit).map(
    (product, index) => ({
      productId: product.id,
      productName: product.name,
      productUrl: product.url,
      reason:
        index === 0
          ? 'Size özel önerilen ürünümüz'
          : index === 1
          ? 'Bu ürünle birlikte kullanabileceğiniz tamamlayıcı ürün'
          : 'Sizin için seçtiğimiz özel ürün',
    })
  );

  return recommendations;
}

/**
 * Generate upsell message
 */
export async function generateUpsellMessage(
  recommendations: ProductRecommendation[],
  merchantName: string,
  personaSettings?: any
): Promise<string> {
  if (recommendations.length === 0) {
    return '';
  }

  // Build product list
  const productList = recommendations
    .map((rec, index) => `${index + 1}. ${rec.productName}`)
    .join('\n');

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful sales assistant for ${merchantName}.
Generate a friendly, non-pushy upsell message recommending these products:
${productList}

Keep it short (2-3 sentences), friendly, and focus on value to the customer.
Respond in Turkish unless the user writes in another language.`,
        },
        {
          role: 'user',
          content: 'Generate an upsell message',
        },
      ],
      temperature: personaSettings?.temperature || 0.7,
      max_tokens: 150,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Upsell message generation error:', error);
    // Fallback message
    return `Harika! Size özel önerilerimiz var:\n\n${productList}\n\nDetaylar için linklere tıklayabilirsiniz.`;
  }
}

/**
 * Check if an upsell is eligible to be sent (does NOT check satisfaction)
 * Rules:
 * - Order must be delivered (T+14 check-in)
 * - User hasn't opted out
 * - Not already sent upsell for this order
 */
export async function checkEligibility(
  merchantId: string,
  userId: string,
  orderId: string
): Promise<boolean> {
  return isUpsellEligible(userId, orderId, merchantId);
}

async function isUpsellEligible(
  userId: string,
  orderId: string,
  merchantId: string
): Promise<boolean> {
  const serviceClient = getSupabaseServiceClient();

  // Check user consent
  const { data: user } = await serviceClient
    .from('users')
    .select('consent_status')
    .eq('id', userId)
    .single();

  if (user?.consent_status === 'opt_out') {
    return false;
  }

  // Check if upsell already sent (check scheduled_tasks)
  const { data: existingUpsell } = await serviceClient
    .from('scheduled_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('order_id', orderId)
    .eq('task_type', 'upsell')
    .eq('status', 'completed')
    .single();

  if (existingUpsell) {
    return false; // Already sent
  }

  // Check order status
  const { data: order } = await serviceClient
    .from('orders')
    .select('status, delivery_date')
    .eq('id', orderId)
    .single();

  if (order?.status !== 'delivered' || !order.delivery_date) {
    return false; // Not delivered yet
  }

  // Check if enough time has passed (T+14)
  const deliveryDate = new Date(order.delivery_date);
  const daysSinceDelivery =
    (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceDelivery < 14) {
    return false; // Too early
  }

  return true;
}

/**
 * Decide whether to send an upsell for a given message.
 * (Compatibility wrapper used by tests + higher-level flows.)
 */
export async function shouldSendUpsell(
  merchantId: string,
  userId: string,
  orderId: string,
  userMessage: string
): Promise<boolean> {
  const satisfaction = await detectSatisfaction(userMessage);
  if (!satisfaction.satisfied || satisfaction.confidence < 0.7) {
    return false;
  }
  return isUpsellEligible(userId, orderId, merchantId);
}

/**
 * Generate an upsell package (message + recommendations).
 * Note: This does not send or schedule; it only prepares content.
 */
export async function generateUpsell(
  merchantId: string,
  userId: string,
  orderId: string
): Promise<{ message: string; recommendations: ProductRecommendation[] }> {
  // Eligibility check (no satisfaction here; caller decides)
  const eligible = await isUpsellEligible(userId, orderId, merchantId);
  if (!eligible) {
    return { message: '', recommendations: [] };
  }

  const recommendations = await getComplementaryProducts(orderId, merchantId, 2);
  if (recommendations.length === 0) {
    return { message: '', recommendations: [] };
  }

  const { data: merchant } = await getSupabaseServiceClient()
    .from('merchants')
    .select('name, persona_settings')
    .eq('id', merchantId)
    .single();

  const message = await generateUpsellMessage(
    recommendations,
    merchant?.name || 'Biz',
    merchant?.persona_settings
  );

  return { message, recommendations };
}

/**
 * Process satisfaction check and trigger upsell if appropriate
 */
export async function processSatisfactionCheck(
  userId: string,
  orderId: string,
  merchantId: string,
  userMessage: string
): Promise<{
  satisfied: boolean;
  upsellTriggered: boolean;
  upsellMessage?: string;
}> {
  // Detect satisfaction
  const satisfaction = await detectSatisfaction(userMessage);

  if (!satisfaction.satisfied || satisfaction.confidence < 0.7) {
    return {
      satisfied: false,
      upsellTriggered: false,
    };
  }

  // Check if upsell should be sent
  const shouldSend = await isUpsellEligible(userId, orderId, merchantId);

  if (!shouldSend) {
    return {
      satisfied: true,
      upsellTriggered: false,
    };
  }

  // Get complementary products
  const recommendations = await getComplementaryProducts(
    orderId,
    merchantId,
    2
  );

  if (recommendations.length === 0) {
    return {
      satisfied: true,
      upsellTriggered: false,
    };
  }

  // Generate upsell message
  const { data: merchant } = await getSupabaseServiceClient()
    .from('merchants')
    .select('name, persona_settings')
    .eq('id', merchantId)
    .single();

  const upsellMessage = await generateUpsellMessage(
    recommendations,
    merchant?.name || 'Biz',
    merchant?.persona_settings
  );

  // Schedule upsell message (or send immediately)
  // For MVP, we'll return the message to be sent
  // In production, you might schedule it or send immediately

  return {
    satisfied: true,
    upsellTriggered: true,
    upsellMessage,
  };
}
