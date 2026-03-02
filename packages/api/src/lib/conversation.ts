/**
 * Conversation management utilities
 * Handle conversation state and history
 */

import { getSupabaseServiceClient } from '@recete/shared';
import { decryptPhone } from './encryption.js';
import { normalizePhone } from './events.js';
import { normalizeAndHashPhone } from './phoneLookup.js';

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

async function findUserByDecryptScan(
  merchantId: string,
  normalizedPhone: string,
  phoneLookupHash: string
): Promise<{ userId: string; userName?: string } | null> {
  const serviceClient = getSupabaseServiceClient();
  const { data: users, error } = await serviceClient
    .from('users')
    .select('id, name, phone, phone_lookup_hash')
    .eq('merchant_id', merchantId)
    .limit(5000);

  if (error || !users || users.length === 0) return null;

  for (const user of users as Array<{ id: string; name?: string | null; phone: string; phone_lookup_hash?: string | null }>) {
    try {
      const decrypted = decryptPhone(user.phone);
      const candidate = normalizePhone(decrypted);
      if (candidate === normalizedPhone) {
        // Best-effort backfill for old rows that predate phone_lookup_hash.
        if (!user.phone_lookup_hash) {
          void serviceClient
            .from('users')
            .update({ phone_lookup_hash: phoneLookupHash })
            .eq('id', user.id)
            .eq('merchant_id', merchantId);
        }
        return {
          userId: user.id,
          userName: user.name || undefined,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Find user by phone number
 */
export async function findUserByPhone(
  phone: string,
  merchantId: string
): Promise<{ userId: string; userName?: string } | null> {
  const serviceClient = getSupabaseServiceClient();

  let normalizedPhone: string;
  let phoneLookupHash: string;
  try {
    const normalized = normalizeAndHashPhone(phone);
    normalizedPhone = normalized.normalizedPhone;
    phoneLookupHash = normalized.phoneLookupHash;
  } catch {
    return null;
  }

  // Preferred fast path: merchant_id + phone_lookup_hash index.
  const { data: userByHash, error } = await serviceClient
    .from('users')
    .select('id, name')
    .eq('merchant_id', merchantId)
    .eq('phone_lookup_hash', phoneLookupHash)
    .maybeSingle();

  if (error) {
    // Column may not exist yet if migration is pending; fall back to legacy scan.
    if ((error as any)?.code === '42703') {
      return findUserByDecryptScan(merchantId, normalizedPhone, phoneLookupHash);
    }
    return null;
  }

  if (userByHash) {
    const matched = userByHash as { id: string; name?: string | null };
    return {
      userId: matched.id,
      userName: matched.name || undefined,
    };
  }

  // Backward compatibility for old rows without hash.
  return findUserByDecryptScan(merchantId, normalizedPhone, phoneLookupHash);
}

/**
 * Get or create conversation
 */
export async function getOrCreateConversation(
  userId: string,
  orderId?: string,
  merchantId?: string
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

  // Add merchant isolation if merchantId is provided
  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
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
      merchant_id: merchantId || null,
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
  const timestampIso = new Date().toISOString();

  const { error: appendError } = await serviceClient.rpc('append_conversation_message_atomic', {
    conversation_uuid: conversationId,
    message_role: role,
    message_content: content,
    message_timestamp: timestampIso,
  });

  if (!appendError) return;

  // Function may not exist yet if migration is pending; fall back to legacy read-modify-write.
  if ((appendError as any)?.code !== '42883') {
    throw new Error(`Failed to append conversation message: ${appendError.message}`);
  }

  const { data: conversation, error: fetchError } = await serviceClient
    .from('conversations')
    .select('history')
    .eq('id', conversationId)
    .single();

  if (fetchError || !conversation) {
    throw new Error('Conversation not found');
  }

  const history = (conversation.history as ConversationMessage[]) || [];
  history.push({
    role,
    content,
    timestamp: timestampIso,
  });

  const { error: updateError } = await serviceClient
    .from('conversations')
    .update({
      history,
      updated_at: timestampIso,
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
