import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/billingMiddleware.js';
import { detectLanguage } from '../lib/i18n.js';
import { queryKnowledgeBase, formatRAGResultsForLLM } from '../lib/rag.js';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { getMultiLangRagFlags } from '../lib/multiLangRag/config.js';
import { MultiLangRagAnswerService } from '../lib/multiLangRag/answerService.js';
import { ShopSettingsService } from '../lib/multiLangRag/shopSettingsService.js';
import { logger } from '@recete/shared';
import { getDefaultLlmModel } from '../lib/runtimeModelSettings.js';

const answer = new Hono();
answer.use('/*', authMiddleware);
answer.use('/*', requireActiveSubscription as any);

function legacyAnswerPrompt(question: string, context: string, lang: string): string {
  const languageInstruction =
    lang === 'hu' ? 'Válaszolj magyarul.'
      : lang === 'tr' ? 'Türkçe yanıtla.'
        : 'Answer in English.';
  return [
    'You are a product support assistant.',
    'Use only the provided product information.',
    'If the answer is not in the context, clearly say the product content does not contain it and ask one clarifying question.',
    'Do not invent product claims, guarantees, or safety promises.',
    languageInstruction,
    '',
    'PRODUCT CONTEXT:',
    context,
    '',
    `QUESTION: ${question}`,
  ].join('\n');
}

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

  const flags = getMultiLangRagFlags();
  const start = Date.now();
  const shopSettings = await new ShopSettingsService().getOrCreate(shopId, question);
  const multiLangEnabledForShop = flags.enabled && Boolean(shopSettings.multi_lang_rag_enabled);

  const runShadowRead = async () => {
    if (!flags.shadowRead) return;
    try {
      const svc = new MultiLangRagAnswerService();
      const shadow = await svc.answer({ shopId, question, userLang });
      logger.info({
        shop_id: shopId,
        user_lang: userLang,
        used_fallback: shadow.used_fallback,
        fallback_lang: shadow.fallback_lang,
        cited_products: shadow.cited_products,
        latency_ms: shadow.latency_ms,
      }, 'multi_lang_rag_shadow_read');
    } catch (error) {
      logger.warn({ error, shop_id: shopId }, 'multi_lang_rag_shadow_read_failed');
    }
  };

  if (!multiLangEnabledForShop) {
    // legacy flow
    const rag = await queryKnowledgeBase({
      merchantId: shopId,
      query: question,
      topK: 8,
      similarityThreshold: 0.6,
      preferredLanguage: userLang,
    });
    const context = formatRAGResultsForLLM(rag.results);
    const client = getOpenAIClient();
    const model = await getDefaultLlmModel();
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: 'system', content: legacyAnswerPrompt(question, context, userLang) },
      ],
    });
    const legacyAnswer = completion.choices[0]?.message?.content?.trim() || '';
    void runShadowRead();
    return c.json({
      answer: legacyAnswer,
      lang_detected: userLang,
      used_fallback: false,
      fallback_lang: null,
      cited_products: [...new Set(rag.results.map((r) => r.productId))],
      latency_ms: Date.now() - start,
    });
  }

  const svc = new MultiLangRagAnswerService();
  const result = await svc.answer({ shopId, question, userLang });
  return c.json(result);
});

export default answer;
