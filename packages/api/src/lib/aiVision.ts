import { fetchWhatsAppImageDataUrl, logger } from '@recete/shared';
import { getOpenAIClient } from './openaiClient.js';
import { getDefaultVisionModel } from './runtimeModelSettings.js';
import { trackAiUsageEvent } from './aiUsageEvents.js';
import type { WhatsAppCredentials, WhatsAppWebhookMessage } from './whatsapp.js';

/** The customer's photo, fetched from WhatsApp by the store's linked device. */
async function resolveImageDataUrl(
  message: WhatsAppWebhookMessage,
  credentials: WhatsAppCredentials
): Promise<string> {
  const media = message.image?.providerMediaId?.trim();
  if (!media) throw new Error('Image message is missing its download descriptor');
  return fetchWhatsAppImageDataUrl(credentials.merchantId, media);
}

function buildVisionPrompt(params: { customerCaption?: string; merchantName?: string | null }) {
  const merchantIntro = params.merchantName?.trim()
    ? `You are the WhatsApp support assistant for ${params.merchantName}.`
    : 'You are a WhatsApp support assistant for a merchant.';
  const caption = params.customerCaption?.trim()
    ? `Customer caption or message: "${params.customerCaption.trim()}".`
    : 'The customer sent an image without any text caption.';

  return `${merchantIntro}

Analyze the customer image and draft a short WhatsApp reply.
- Focus on what is visibly present in the image.
- Do not invent details that are not visible.
- Do not give medical, legal, or safety-critical instructions.
- If the image is unclear, say so and ask the customer for one clarifying detail.
- If the customer appears to show product damage, packaging issues, or incorrect usage, state that carefully and suggest the next reasonable support step.
- Keep the reply concise, practical, and suitable for direct WhatsApp delivery.

${caption}`;
}

export async function analyzeCustomerImage(input: {
  merchantId: string;
  merchantName?: string | null;
  message: WhatsAppWebhookMessage;
  credentials: WhatsAppCredentials;
}) {
  const imageDataUrl = await resolveImageDataUrl(input.message, input.credentials);
  const openai = getOpenAIClient();
  const model = await getDefaultVisionModel();
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: buildVisionPrompt({
          customerCaption: input.message.image?.caption || input.message.text,
          merchantName: input.merchantName,
        }),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this customer-submitted image and draft the reply now.',
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
            },
          },
        ] as any,
      },
    ] as any,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Vision model returned an empty response');
  }

  void trackAiUsageEvent({
    merchantId: input.merchantId,
    feature: 'whatsapp_ai_vision',
    model,
    requestKind: 'chat_completion',
    promptTokens: (completion as any).usage?.prompt_tokens || 0,
    completionTokens: (completion as any).usage?.completion_tokens || 0,
    totalTokens: (completion as any).usage?.total_tokens || 0,
    metadata: {
      channel: 'whatsapp',
      provider: input.credentials.provider,
      hasCaption: Boolean(input.message.image?.caption || input.message.text),
    },
  }).catch((error) => {
    logger.warn({ error, merchantId: input.merchantId }, 'Failed to record AI vision usage event');
  });

  return text;
}
