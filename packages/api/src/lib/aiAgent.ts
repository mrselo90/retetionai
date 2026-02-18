/**
 * AI Agent utilities
 * Intent classification, RAG retrieval, and LLM generation
 */

import type OpenAI from 'openai';
import { getOpenAIClient } from './openaiClient.js';
import { queryKnowledgeBase, formatRAGResultsForLLM } from './rag.js';
import { getOrderProductContext } from './rag.js';
import { getSupabaseServiceClient, logger, getProductInstructionsByProductIds } from '@glowguide/shared';
import type { ConversationMessage } from './conversation.js';
import {
  checkUserMessageGuardrails,
  checkAIResponseGuardrails,
  escalateToHuman,
  getSafeResponse,
  type CustomGuardrail,
} from './guardrails.js';
import { processSatisfactionCheck } from './upsell.js';
import { getMerchantBotInfo } from './botInfo.js';
import { isAddonActive, logReturnPreventionAttempt, hasPendingPreventionAttempt, updatePreventionOutcome } from './addons.js';

export type Intent = 'question' | 'complaint' | 'chat' | 'opt_out' | 'return_intent';

export interface AIResponse {
  intent: Intent;
  response: string;
  ragContext?: string;
  guardrailBlocked?: boolean;
  guardrailReason?: 'crisis_keyword' | 'medical_advice' | 'unsafe_content' | 'custom';
  /** When guardrailReason is 'custom', the name of the custom guardrail that matched */
  guardrailCustomName?: string;
  requiresHuman?: boolean;
  upsellTriggered?: boolean;
  upsellMessage?: string;
}

/**
 * Classify message intent
 */
export async function classifyIntent(message: string): Promise<Intent> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Faster and cheaper for classification
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier for a customer service chatbot.
Classify the user's message into one of these categories:
- question: User is asking about product usage, features, or how to use something
- complaint: User is reporting a problem, issue, or dissatisfaction (shipping, packaging, general issues)
- return_intent: User wants to return the product, says they didn't like it, it doesn't work, wants a refund, or expresses dissatisfaction signaling a potential return (e.g. "iade", "beğenmedim", "çalışmıyor", "return", "refund", "doesn't work", "send it back")
- chat: General conversation, greetings, or casual messages
- opt_out: User wants to stop receiving messages or unsubscribe

Respond with ONLY the category name.`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.1, // Low temperature for consistent classification
      max_tokens: 10,
    });

    const intent = response.choices[0]?.message?.content?.trim().toLowerCase();

    if (
      intent === 'question' ||
      intent === 'complaint' ||
      intent === 'chat' ||
      intent === 'opt_out' ||
      intent === 'return_intent'
    ) {
      return intent;
    }

    // Default to chat if classification fails
    return 'chat';
  } catch (error) {
    console.error('Intent classification error:', error);
    return 'chat'; // Default fallback
  }
}

/**
 * Generate AI response using RAG and conversation history
 */
export async function generateAIResponse(
  message: string,
  merchantId: string,
  userId: string,
  conversationId: string,
  orderId?: string,
  conversationHistory: ConversationMessage[] = [],
  personaSettings?: any
): Promise<AIResponse> {
  const openai = getOpenAIClient();

  // Step 0: Get merchant (persona + guardrails) so we can run user guardrails with custom rules
  const { data: merchant } = await getSupabaseServiceClient()
    .from('merchants')
    .select('name, persona_settings, guardrail_settings')
    .eq('id', merchantId)
    .single();

  const guardrailSettings = (merchant?.guardrail_settings as { custom_guardrails?: unknown[] }) ?? {};
  const customGuardrails: CustomGuardrail[] = Array.isArray(guardrailSettings.custom_guardrails)
    ? (guardrailSettings.custom_guardrails as CustomGuardrail[])
    : [];

  // Step 1: Check guardrails for user message (system + custom)
  const userGuardrail = checkUserMessageGuardrails(message, { customGuardrails });

  if (!userGuardrail.safe) {
    if (userGuardrail.requiresHuman) {
      await escalateToHuman(userId, conversationId, userGuardrail.reason ?? 'custom', message);
    }

    return {
      intent: 'chat',
      response: userGuardrail.suggestedResponse || getSafeResponse(userGuardrail.reason ?? 'custom'),
      guardrailBlocked: true,
      guardrailReason: userGuardrail.reason,
      guardrailCustomName: userGuardrail.customReason,
      requiresHuman: userGuardrail.requiresHuman,
    };
  }

  // Step 2: Classify intent
  let intent = await classifyIntent(message);

  const persona = merchant?.persona_settings || {};
  const merchantName = merchant?.name || 'Biz';
  const botInfo = await getMerchantBotInfo(merchantId);

  // Return Prevention: if return_intent detected, check if module is active
  let returnPreventionActive = false;
  if (intent === 'return_intent') {
    returnPreventionActive = await isAddonActive(merchantId, 'return_prevention');
    if (!returnPreventionActive) {
      intent = 'complaint'; // fallback to normal complaint flow
    } else {
      // Check if customer is insisting (already had a prevention attempt in this conversation)
      const alreadyAttempted = await hasPendingPreventionAttempt(conversationId);
      if (alreadyAttempted) {
        await updatePreventionOutcome(conversationId, 'escalated');
        await escalateToHuman(userId, conversationId, 'return_intent_insistence', message);
        return {
          intent,
          response: 'I understand this is important to you. Let me connect you with a team member who can personally assist you.',
          requiresHuman: true,
        };
      }
    }
  }

  // If the previous state was return_intent but now user is positive, mark as prevented
  if (intent === 'chat' || intent === 'question') {
    try {
      const hasAttempt = await hasPendingPreventionAttempt(conversationId);
      if (hasAttempt) {
        const positiveSignals = ['thank', 'thanks', 'ok', 'okay', 'teşekkür', 'sağol', 'anladım', 'deneyeceğim', 'tamam', 'i\'ll try', 'got it'];
        const msgLower = message.toLowerCase();
        if (positiveSignals.some((s) => msgLower.includes(s))) {
          await updatePreventionOutcome(conversationId, 'prevented');
        }
      }
    } catch { /* non-critical */ }
  }

  // product_instructions_scope: 'order_only' | 'rag_products_too' (required from settings)
  const productInstructionsScope = (persona?.product_instructions_scope === 'rag_products_too' ? 'rag_products_too' : 'order_only') as 'order_only' | 'rag_products_too';

  // Step 3: Get RAG context if it's a question OR return_intent (knowledge_chunks + product_instructions)
  let ragContext = '';
  if (intent === 'question' || (intent === 'return_intent' && returnPreventionActive)) {
    try {
      let orderProductIds: string[] | undefined;
      if (orderId) {
        const productContext = await getOrderProductContext(orderId);
        orderProductIds = productContext.map((c) => c.productId);
      }
      // RAG: semantic search (order products if any, else all merchant products)
      const ragResult = await queryKnowledgeBase({
        merchantId,
        query: message,
        productIds: orderProductIds?.length ? orderProductIds : undefined,
        topK: 5,
        similarityThreshold: 0.6,
      });

      if (ragResult.results.length > 0) {
        ragContext = formatRAGResultsForLLM(ragResult.results);
      }

      // Product IDs to fetch usage instructions for (depends on setting)
      let instructionProductIds: string[] = [];
      if (productInstructionsScope === 'order_only') {
        if (orderId && orderProductIds && orderProductIds.length > 0) {
          instructionProductIds = orderProductIds;
        }
      } else {
        // rag_products_too: include order products and/or products that appeared in RAG results
        const ragProductIds = [...new Set(ragResult.results.map((r) => r.productId))];
        if (orderId && orderProductIds && orderProductIds.length > 0) {
          instructionProductIds = [...new Set([...orderProductIds, ...ragProductIds])];
        } else {
          instructionProductIds = ragProductIds;
        }
      }

      if (instructionProductIds.length > 0) {
        const instructions = await getProductInstructionsByProductIds(merchantId, instructionProductIds);
        if (instructions.length > 0) {
          const recipeBlocks = instructions.map((r: any) => {
            let block = `[${r.product_name ?? 'Product'}]\nUsage / Recipe: ${r.usage_instructions}`;
            if (r.recipe_summary) block += `\nSummary: ${r.recipe_summary}`;
            if (r.video_url) block += `\nTutorial Video: ${r.video_url}`;
            if (r.prevention_tips) block += `\nReturn Prevention Tips: ${r.prevention_tips}`;
            return block;
          });
          ragContext += (ragContext ? '\n\n' : '') + '--- Product usage instructions (recipes) ---\n' + recipeBlocks.join('\n\n');
        }
      }
    } catch (error) {
      logger.error({ error }, 'RAG retrieval error');
    }
  }

  // Step 4: Build system prompt (persona + bot info + RAG context)
  const systemPrompt = buildSystemPrompt(
    merchantName,
    persona,
    intent,
    ragContext,
    botInfo
  );

  // Step 5: Build conversation messages
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // Add conversation history (last 10 messages)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: message,
  });

  // Step 6: Generate response
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use GPT-4o-mini for better logic and reasoning
      messages,
      temperature: persona.temperature || 0.7,
      max_tokens: 500,
    });

    let aiResponse = response.choices[0]?.message?.content || '';

    // Step 7: Check guardrails for AI response (system + custom)
    const responseGuardrail = checkAIResponseGuardrails(aiResponse, { customGuardrails });

    if (!responseGuardrail.safe) {
      aiResponse = responseGuardrail.suggestedResponse || getSafeResponse(responseGuardrail.reason ?? 'custom');

      if (responseGuardrail.requiresHuman) {
        await escalateToHuman(userId, conversationId, responseGuardrail.reason ?? 'custom', aiResponse);
      }

      return {
        intent,
        response: aiResponse,
        ragContext: ragContext || undefined,
        guardrailBlocked: true,
        guardrailReason: responseGuardrail.reason,
        guardrailCustomName: responseGuardrail.customReason,
        requiresHuman: responseGuardrail.requiresHuman,
      };
    }

    // Step 8a: Log return prevention attempt if applicable
    if (intent === 'return_intent' && returnPreventionActive) {
      try {
        await logReturnPreventionAttempt({
          merchantId,
          conversationId,
          userId,
          orderId,
          triggerMessage: message,
          preventionResponse: aiResponse,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to log return prevention attempt');
      }
    }

    // Step 8b: Check for satisfaction and trigger upsell if appropriate
    let upsellResult = null;
    if (intent === 'chat' && orderId) {
      // Check if user is satisfied (positive sentiment in chat)
      try {
        upsellResult = await processSatisfactionCheck(
          userId,
          orderId,
          merchantId,
          message
        );
      } catch (error) {
        console.error('Upsell check error:', error);
        // Continue without upsell
      }
    }

    return {
      intent,
      response: aiResponse,
      ragContext: ragContext || undefined,
      guardrailBlocked: false,
      upsellTriggered: upsellResult?.upsellTriggered || false,
      upsellMessage: upsellResult?.upsellMessage,
    };
  } catch (error) {
    console.error('LLM generation error:', error);
    throw new Error('Failed to generate response');
  }
}

/**
 * Build system prompt with persona, bot info (guidelines/boundaries/recipes), and RAG context
 */
function buildSystemPrompt(
  merchantName: string,
  persona: any,
  intent: Intent,
  ragContext?: string,
  botInfo?: Record<string, string>
): string {
  const botName = persona?.bot_name || 'GlowGuide Asistan';
  
  let prompt = `You are ${botName}, a professional and helpful customer service assistant for ${merchantName}.\n\n`;
  
  prompt += `IMPORTANT RULES:
- Always be logical, clear, and helpful in your responses
- Use the provided product information and context to give accurate answers
- If you don't have information, admit it clearly and suggest alternatives
- Be concise but complete - explain things step by step when needed
- Show empathy and understanding in complaints
- Never make up facts or product details\n\n`;

  // Merchant-defined bot info (brand guidelines, boundaries, recipe overview)
  if (botInfo && Object.keys(botInfo).length > 0) {
    const labels: Record<string, string> = {
      brand_guidelines: 'Brand & guidelines',
      bot_boundaries: 'How you should behave / boundaries',
      recipe_overview: 'Recipes & usage overview',
      custom_instructions: 'Additional instructions',
    };
    prompt += '--- Merchant instructions for this bot ---\n';
    for (const [key, value] of Object.entries(botInfo)) {
      if (value?.trim()) {
        prompt += `${labels[key] || key}:\n${value.trim()}\n\n`;
      }
    }
    prompt += '---\n\n';
  }

  // Persona settings
  const toneMap: Record<string, string> = {
    friendly: 'friendly and warm',
    professional: 'professional and courteous',
    casual: 'casual and relaxed',
    formal: 'formal and respectful'
  };
  
  if (persona.tone) {
    prompt += `Communication style: Be ${toneMap[persona.tone] || persona.tone}.\n`;
  }
  
  if (persona.emoji === true) {
    prompt += `Use appropriate emojis to make messages more engaging.\n`;
  } else if (persona.emoji === false) {
    prompt += `Do not use emojis in responses.\n`;
  }
  
  const lengthMap: Record<string, string> = {
    short: 'Keep responses brief (1-2 sentences when possible)',
    medium: 'Keep responses moderate (2-4 sentences typically)',
    long: 'Provide detailed responses (3-6 sentences with full explanations)'
  };
  
  if (persona.response_length) {
    prompt += `Response length: ${lengthMap[persona.response_length] || 'medium'}.\n`;
  }
  
  prompt += '\n';

  // Intent-specific instructions
  switch (intent) {
    case 'question':
      prompt +=
        'USER INTENT: The user is asking a question.\n' +
        '- Answer based on the product information provided below\n' +
        '- Be clear and specific with step-by-step instructions when appropriate\n' +
        '- If information is missing, explain what you cannot answer and suggest alternatives\n\n';
      break;
    case 'complaint':
      prompt +=
        'USER INTENT: The user has a complaint or problem.\n' +
        '- Show empathy and acknowledge their concern first\n' +
        '- Apologize if appropriate\n' +
        '- Offer practical solutions or next steps\n' +
        '- Be professional and solution-focused\n\n';
      break;
    case 'chat':
      prompt += 
        'USER INTENT: The user is having a casual conversation.\n' +
        '- Be friendly and engaging\n' +
        '- Keep the conversation natural and helpful\n' +
        '- Look for opportunities to assist\n\n';
      break;
    case 'opt_out':
      prompt +=
        'USER INTENT: The user wants to opt out or stop receiving messages.\n' +
        '- Respect their choice immediately\n' +
        '- Confirm the opt-out clearly\n' +
        '- Thank them politely\n\n';
      break;
    case 'return_intent':
      prompt +=
        'USER INTENT: The user wants to return the product or is dissatisfied.\n' +
        'YOUR GOAL: Prevent the return by helping them get value from the product.\n' +
        '- Acknowledge frustration with empathy first\n' +
        '- Ask how they used it (dosage, frequency, duration)\n' +
        '- If a video URL is available in the product info, suggest it naturally\n' +
        '- Share usage tips from product instructions\n' +
        '- Do NOT accept the return or give return instructions\n' +
        '- If they insist, offer to connect with a team member\n\n';
      break;
  }

  // RAG context (knowledge_chunks + product_instructions)
  if (ragContext) {
    prompt += `--- PRODUCT INFORMATION (Use this to answer) ---\n${ragContext}\n\n`;
    prompt +=
      'IMPORTANT: Base your answer ONLY on the information above. ' +
      'If the answer is not in the context, clearly say "I don\'t have specific information about that" and offer to help in another way.\n\n';
  } else if (intent === 'question' || intent === 'return_intent') {
    prompt +=
      '--- NO PRODUCT INFORMATION AVAILABLE ---\n' +
      'The product information is not in the knowledge base yet. ' +
      'Acknowledge their concern politely, explain you don\'t have specific details, ' +
      'and suggest alternatives (check packaging, contact support, etc.). ' +
      'NEVER invent product details, ingredients, or usage instructions.\n\n';
  }

  prompt +=
    'RESPONSE FORMAT:\n' +
    '- Respond in Turkish unless the user writes in another language\n' +
    '- Be natural and conversational\n' +
    '- Focus on being helpful and solving the customer\'s need\n';

  return prompt;
}
