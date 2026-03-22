import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/billingMiddleware.js';
import { detectLanguage } from '../lib/i18n.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { generateGroundedProductAnswer } from '../lib/groundedAnswer.js';
import { getMerchantBotInfo } from '../lib/botInfo.js';

const answer = new Hono();
answer.use('/*', authMiddleware);
answer.use('/*', requireActiveSubscription as any);

answer.post('/', async (c) => {
  const merchantId = c.get('merchantId') as string;
  const body = await c.req.json().catch(() => ({}));
  const shopId = typeof body.shop_id === 'string' && body.shop_id ? body.shop_id : merchantId;
  if (shopId !== merchantId) {
    return c.json({ error: 'shop_id mismatch for authenticated merchant' }, 403);
  }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const userLang = typeof body.user_lang === 'string' ? body.user_lang : detectLanguage(question);
  if (!question) return c.json({ error: 'question is required' }, 400);

  const serviceClient = getSupabaseServiceClient();
  const { data: merchant } = await serviceClient
    .from('merchants')
    .select('name, persona_settings')
    .eq('id', shopId)
    .maybeSingle();
  const botInfo = await getMerchantBotInfo(shopId);

  const result = await generateGroundedProductAnswer({
    merchantId: shopId,
    question,
    userLang,
    channel: 'api',
    intent: 'question',
    merchantName: merchant?.name || 'Biz',
    persona: (merchant?.persona_settings as any) || {},
    botInfo,
    instructionScope: 'facts_products',
    topK: 8,
    similarityThreshold: 0.6,
  });

  return c.json({
    answer: result.answer,
    lang_detected: result.langDetected,
    used_fallback: false,
    fallback_lang: null,
    cited_products: result.citedProducts,
    latency_ms: result.latencyMs,
  });
});

export default answer;
