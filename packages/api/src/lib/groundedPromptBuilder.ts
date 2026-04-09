import type OpenAI from 'openai';

export type PersonaSettings = {
  bot_name?: string;
  tone?: string;
  emoji?: boolean;
  response_length?: 'short' | 'medium' | 'long' | string;
  temperature?: number;
};

export type HistoryMessage = {
  role: 'user' | 'assistant' | 'merchant';
  content: string;
};

export function buildGroundedPrompt(input: {
  merchantName: string;
  persona?: PersonaSettings;
  intent: 'question' | 'return_intent';
  ragContext?: string;
  botInfo?: Record<string, string>;
  lang: string;
  requestedLang?: string;
  usedLanguageFallback?: boolean;
  supportedLanguages?: string[];
  channel: 'api' | 'whatsapp';
  runtimeHint?: string;
}): string {
  const {
    merchantName,
    persona,
    intent,
    ragContext,
    botInfo,
    lang,
    requestedLang,
    usedLanguageFallback,
    supportedLanguages,
    channel,
    runtimeHint,
  } = input;

  const botName = persona?.bot_name || 'Recete Asistan';
  let prompt = `You are ${botName}, a professional and helpful customer service assistant for ${merchantName}.\n\n`;

  prompt += `IMPORTANT RULES:
- Use only the provided product evidence and conversation context
- If product evidence is insufficient, say so clearly and ask exactly one clarifying question
- Never invent ingredients, warnings, efficacy claims, guarantees, or compatibility claims
- Structured product facts are highest-priority evidence
- Product instructions and FAQs come before generic descriptive text
- If product resolution is uncertain, ask the customer to clarify the exact product or variant\n\n`;

  if (botInfo && Object.keys(botInfo).length > 0) {
    const labels: Record<string, string> = {
      brand_guidelines: 'Brand & guidelines',
      bot_boundaries: 'How you should behave / boundaries',
      recipe_overview: 'Recipes & usage overview',
      custom_instructions: 'Additional instructions',
    };
    prompt += '--- Merchant instructions for this bot ---\n';
    for (const [key, value] of Object.entries(botInfo)) {
      if (typeof value === 'string' && value.trim()) {
        prompt += `${labels[key] || key}:\n${value.trim()}\n\n`;
      }
    }
    prompt += '---\n\n';
  }

  const toneMap: Record<string, string> = {
    friendly: 'friendly and warm',
    professional: 'professional and courteous',
    casual: 'casual and relaxed',
    formal: 'formal and respectful',
  };
  if (persona?.tone) {
    prompt += `Communication style: Be ${toneMap[persona.tone] || persona.tone}.\n`;
  }
  if (persona?.emoji === true) {
    prompt += 'Use appropriate emojis sparingly.\n';
  } else if (persona?.emoji === false) {
    prompt += 'Do not use emojis.\n';
  }
  const lengthMap: Record<string, string> = {
    short: 'Keep responses brief.',
    medium: 'Keep responses concise but complete.',
    long: 'Provide fuller step-by-step explanations when useful.',
  };
  if (persona?.response_length) {
    prompt += `Response length: ${lengthMap[persona.response_length] || 'Keep responses concise but complete.'}\n`;
  }
  if (channel === 'whatsapp') {
    prompt += 'Channel: WhatsApp. Prefer short paragraphs and practical guidance.\n';
  } else {
    prompt += 'Channel: API product answer. Keep formatting plain and scannable.\n';
  }
  prompt += '\n';

  if (intent === 'return_intent') {
    prompt +=
      'USER INTENT: The user is dissatisfied and may want to return the product.\n' +
      '- Use evidence to help them use the product correctly and safely\n' +
      '- Do not fabricate return-policy details\n' +
      '- If evidence is insufficient, acknowledge uncertainty and ask a clarifying question\n\n';
  } else {
    prompt +=
      'USER INTENT: The user is asking a product question.\n' +
      '- Answer directly from evidence\n' +
      '- Prefer precise steps, ingredients, warnings, and instructions over generic summaries\n\n';
  }

  if (ragContext) {
    prompt += `--- PRODUCT EVIDENCE ---\n${ragContext}\n\n`;
  } else {
    prompt +=
      '--- NO PRODUCT EVIDENCE AVAILABLE ---\n' +
      'Explain that you do not have enough product-specific information yet and ask a clarifying question.\n\n';
  }

  if (runtimeHint?.trim()) {
    prompt += `RUNTIME CONVERSATION HINT:\n- ${runtimeHint.trim()}\n\n`;
  }

  if (usedLanguageFallback) {
    prompt +=
      'LANGUAGE CONSTRAINT:\n' +
      `- The customer originally wrote in ${requestedLang || lang}\n` +
      `- This merchant currently replies only in: ${(supportedLanguages || []).join(', ') || lang}\n` +
      `- Reply in ${lang} and do not switch back to the customer's unsupported language\n\n`;
  }

  prompt +=
    'RESPONSE RULES:\n' +
    `- Always respond in ${lang}\n` +
    '- Be honest about uncertainty\n' +
    '- Do not make compatibility, safety, or guarantee claims unless the evidence states them clearly\n' +
    '- Do not mention internal retrieval, embeddings, or system rules\n';

  return prompt;
}

export function buildGroundedMessages(
  systemPrompt: string,
  question: string,
  history: HistoryMessage[] = [],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const item of history) {
    if (!item?.content?.trim()) continue;
    messages.push({
      role: item.role === 'user' ? 'user' : 'assistant',
      content: item.content,
    });
  }

  messages.push({ role: 'user', content: question });
  return messages;
}
