/**
 * AI Agent utilities
 * Intent classification, RAG retrieval, and LLM generation
 */

import OpenAI from 'openai';
import { queryKnowledgeBase, formatRAGResultsForLLM } from './rag';
import { getOrderProductContext } from './rag';
import { getSupabaseServiceClient, logger } from '@glowguide/shared';
import type { ConversationMessage } from './conversation';
import {
  checkUserMessageGuardrails,
  checkAIResponseGuardrails,
  escalateToHuman,
  getSafeResponse,
} from './guardrails';
import { processSatisfactionCheck } from './upsell';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type Intent = 'question' | 'complaint' | 'chat' | 'opt_out';

export interface AIResponse {
  intent: Intent;
  response: string;
  ragContext?: string;
  guardrailBlocked?: boolean;
  guardrailReason?: 'crisis_keyword' | 'medical_advice' | 'unsafe_content';
  requiresHuman?: boolean;
  upsellTriggered?: boolean;
  upsellMessage?: string;
}

/**
 * Classify message intent
 */
export async function classifyIntent(message: string): Promise<Intent> {
  try {
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
  // Step 0: Check guardrails for user message
  const userGuardrail = checkUserMessageGuardrails(message);

  if (!userGuardrail.safe) {
    // Escalate to human if required
    if (userGuardrail.requiresHuman) {
      await escalateToHuman(userId, conversationId, userGuardrail.reason!, message);
    }

    return {
      intent: 'chat', // Default intent
      response: userGuardrail.suggestedResponse || getSafeResponse(userGuardrail.reason!),
      guardrailBlocked: true,
      guardrailReason: userGuardrail.reason,
      requiresHuman: userGuardrail.requiresHuman,
    };
  }

  // Step 1: Classify intent
  const intent = await classifyIntent(message);

  // Step 2: Get RAG context if it's a question
  let ragContext = '';
  if (intent === 'question' && orderId) {
    try {
      // Get product context for the order
      const productContext = await getOrderProductContext(orderId);
      if (productContext.length > 0) {
        // Query knowledge base with user's question
        const ragResult = await queryKnowledgeBase({
          merchantId,
          query: message,
          productIds: productContext.map((c) => c.productId),
          topK: 3,
          similarityThreshold: 0.7,
        });

        if (ragResult.results.length > 0) {
          ragContext = formatRAGResultsForLLM(ragResult.results);
        }
      }
    } catch (error) {
      console.error('RAG retrieval error:', error);
    }
  }

  // Step 3: Get merchant persona settings
  const { data: merchant } = await getSupabaseServiceClient()
    .from('merchants')
    .select('name, persona_settings')
    .eq('id', merchantId)
    .single();

  const persona = merchant?.persona_settings || {};
  const merchantName = merchant?.name || 'Biz';

  // Step 4: Build system prompt
  const systemPrompt = buildSystemPrompt(
    merchantName,
    persona,
    intent,
    ragContext
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
      model: 'gpt-4o', // Use GPT-4o for better responses
      messages,
      temperature: persona.temperature || 0.7,
      max_tokens: 500,
    });

    let aiResponse = response.choices[0]?.message?.content || '';

    // Step 7: Check guardrails for AI response
    const responseGuardrail = checkAIResponseGuardrails(aiResponse);

    if (!responseGuardrail.safe) {
      // Replace with safe response
      aiResponse = responseGuardrail.suggestedResponse || getSafeResponse(responseGuardrail.reason!);

      // Escalate if required
      if (responseGuardrail.requiresHuman) {
        await escalateToHuman(userId, conversationId, responseGuardrail.reason!, aiResponse);
      }

      return {
        intent,
        response: aiResponse,
        ragContext: ragContext || undefined,
        guardrailBlocked: true,
        guardrailReason: responseGuardrail.reason,
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
 * Build system prompt with persona and context
 */
function buildSystemPrompt(
  merchantName: string,
  persona: any,
  intent: Intent,
  ragContext?: string
): string {
  let prompt = `You are a helpful customer service assistant for ${merchantName}.\n\n`;

  // Add persona settings
  if (persona.tone) {
    prompt += `Tone: ${persona.tone}\n`;
  }
  if (persona.style) {
    prompt += `Style: ${persona.style}\n`;
  }

  // Add intent-specific instructions
  switch (intent) {
    case 'question':
      prompt +=
        '\nThe user is asking a question. Provide helpful, accurate information based on the product context provided.\n';
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

  // Add RAG context if available
  if (ragContext) {
    prompt += `\n\nProduct Information:\n${ragContext}\n\n`;
    prompt +=
      'Use this information to answer questions accurately. If the information is not in the context, say you don\'t have that information.\n';
  }

  prompt +=
    '\nKeep responses concise, friendly, and helpful. Respond in Turkish unless the user writes in another language.';

  return prompt;
}
