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

export type Intent = 'question' | 'complaint' | 'chat' | 'opt_out';

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
- complaint: User is reporting a problem, issue, or dissatisfaction
- chat: General conversation, greetings, or casual messages
- opt_out: User wants to stop receiving messages or unsubscribe

Respond with ONLY the category name (question, complaint, chat, or opt_out).`,
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
      intent === 'opt_out'
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
  const intent = await classifyIntent(message);

  const persona = merchant?.persona_settings || {};
  const merchantName = merchant?.name || 'Biz';
  const botInfo = await getMerchantBotInfo(merchantId);

  // product_instructions_scope: 'order_only' | 'rag_products_too' (required from settings)
  const productInstructionsScope = (persona?.product_instructions_scope === 'rag_products_too' ? 'rag_products_too' : 'order_only') as 'order_only' | 'rag_products_too';

  // Step 3: Get RAG context if it's a question (knowledge_chunks + product_instructions)
  let ragContext = '';
  if (intent === 'question') {
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
          const recipeBlocks = instructions.map(
            (r) =>
              `[${r.product_name ?? 'Product'}]\nUsage / Recipe: ${r.usage_instructions}${r.recipe_summary ? `\nSummary: ${r.recipe_summary}` : ''}`
          );
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
      model: 'gpt-3.5-turbo', // Use GPT-3.5-Turbo as requested
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

    // Step 8: Check for satisfaction and trigger upsell if appropriate
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
  let prompt = `You are a helpful customer service assistant for ${merchantName}.\n\n`;

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
  if (persona.tone) {
    prompt += `Tone: ${persona.tone}\n`;
  }
  if (persona.style) {
    prompt += `Style: ${persona.style}\n`;
  }

  // Intent-specific instructions
  switch (intent) {
    case 'question':
      prompt +=
        '\nThe user is asking a question. Provide helpful, accurate information based on the product context and recipes provided when available.\n';
      break;
    case 'complaint':
      prompt +=
        '\nThe user has a complaint. Be empathetic, apologize if appropriate, and offer solutions.\n';
      break;
    case 'chat':
      prompt += '\nThe user is having a casual conversation. Be friendly and engaging.\n';
      break;
    case 'opt_out':
      prompt +=
        '\nThe user wants to opt out. Respect their choice and confirm the opt-out.\n';
      break;
  }

  // RAG context (knowledge_chunks + product_instructions)
  if (ragContext) {
    prompt += `\n\nProduct Information (use this to answer questions):\n${ragContext}\n\n`;
    prompt +=
      'Use this information to answer questions accurately. If the information is not in the context, say so politely and offer general help or suggest they contact support.\n';
  } else if (intent === 'question') {
    // No product info available — bot should still respond helpfully
    prompt +=
      "\n\nNo product information is available for this conversation (e.g. the product isn't in the knowledge base, or no order context). " +
      "Respond in a friendly, helpful way: acknowledge their question, say you don't have specific details about that product, and offer alternatives " +
      "(e.g. general usage tips, contacting customer service, checking the product name or packaging). Never invent product details, ingredients, or usage.\n";
  }

  prompt +=
    '\nKeep responses concise, friendly, and helpful. Respond in Turkish unless the user writes in another language.';

  return prompt;
}
