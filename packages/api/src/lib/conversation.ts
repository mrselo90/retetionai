/**
 * Conversation management utilities
 * Handle conversation state and history
 */

import { getSupabaseServiceClient } from '@recete/shared';
import { decryptPhone, encryptPhone } from './encryption.js';
import { normalizePhone } from './events.js';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'merchant';
  content: string;
  timestamp: string;
}

export interface ConversationState {
  userId: string;
  orderId?: string;
  currentIntent?: 'question' | 'complaint' | 'chat' | 'opt_out' | 'return_intent';
  lastMessageAt: string;
  messageCount: number;
}

/**
 * Find user by phone number
 */
export async function findUserByPhone(
  phone: string,
  merchantId: string
): Promise<{ userId: string; userName?: string } | null> {
  const serviceClient = getSupabaseServiceClient();

  // Normalize phone
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch {
    return null;
  }
  const encryptedPhone = encryptPhone(normalizedPhone);

  // Find user
  const { data: user, error } = await serviceClient
    .from('users')
    .select('id, name')
    .eq('merchant_id', merchantId)
    .eq('phone', encryptedPhone)
    .single();

  if (error || !user) {
    return null;
  }

  return {
    userId: user.id,
    userName: user.name || undefined,
  };
}

/**
 * Get or create conversation
 */
export async function getOrCreateConversation(
  userId: string,
  orderId?: string
): Promise<string> {
  const serviceClient = getSupabaseServiceClient();

  // Try to find existing conversation
  let query = serviceClient
    .from('conversations')
    .select('id')
    .eq('user_id', userId);

  if (orderId) {
    query = query.eq('order_id', orderId);
  } else {
    query = query.is('order_id', null);
  }

  const { data: existing } = await query.single();

  if (existing) {
    return existing.id;
  }

  // Create new conversation
  const { data: newConversation, error } = await serviceClient
    .from('conversations')
    .insert({
      user_id: userId,
      order_id: orderId || null,
      history: [],
      current_state: null,
    })
    .select('id')
    .single();

  if (error || !newConversation) {
    throw new Error(`Failed to create conversation: ${error?.message}`);
  }

  return newConversation.id;
}

/**
 * Add message to conversation
 */
export async function addMessageToConversation(
  conversationId: string,
  role: 'user' | 'assistant' | 'merchant',
  content: string
): Promise<void> {
  const serviceClient = getSupabaseServiceClient();

  // Get current conversation
  const { data: conversation, error: fetchError } = await serviceClient
    .from('conversations')
    .select('history')
    .eq('id', conversationId)
    .single();

  if (fetchError || !conversation) {
    throw new Error('Conversation not found');
  }

  // Add new message
  const history = (conversation.history as ConversationMessage[]) || [];
  history.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });

  // Update conversation
  const { error: updateError } = await serviceClient
    .from('conversations')
    .update({
      history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (updateError) {
    throw new Error(`Failed to update conversation: ${updateError.message}`);
  }
}

/**
 * Get conversation history
 */
export async function getConversationHistory(
  conversationId: string
): Promise<ConversationMessage[]> {
  const serviceClient = getSupabaseServiceClient();

  const { data: conversation, error } = await serviceClient
    .from('conversations')
    .select('history')
    .eq('id', conversationId)
    .single();

  if (error || !conversation) {
    return [];
  }

  return (conversation.history as ConversationMessage[]) || [];
}

/**
 * Update conversation state
 */
export async function updateConversationState(
  conversationId: string,
  intent?: 'question' | 'complaint' | 'chat' | 'opt_out' | 'return_intent'
): Promise<void> {
  const serviceClient = getSupabaseServiceClient();

  const { error } = await serviceClient
    .from('conversations')
    .update({
      current_state: intent || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) {
    throw new Error(`Failed to update conversation state: ${error.message}`);
  }
}
