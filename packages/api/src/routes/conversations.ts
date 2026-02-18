/**
 * Conversation routes
 * List and view conversations
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { decryptPhone, encryptPhone } from '../lib/encryption.js';
import { sendWhatsAppMessage, getEffectiveWhatsAppCredentials } from '../lib/whatsapp.js';
import { addMessageToConversation } from '../lib/conversation.js';

const conversations = new Hono();

// All routes require authentication
conversations.use('/*', authMiddleware);

/**
 * List conversations
 * GET /api/conversations
 * Returns list of conversations with user info and last message
 */
conversations.get('/', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const serviceClient = getSupabaseServiceClient();

    // Get merchant's users
    const { data: merchantUsers } = await serviceClient
      .from('users')
      .select('id')
      .eq('merchant_id', merchantId);

    const userIds = merchantUsers?.map((u) => u.id) || [];

    if (userIds.length === 0) {
      return c.json({ conversations: [] });
    }

    // Get conversations
    const { data: conversationsData, error } = await serviceClient
      .from('conversations')
      .select('id, user_id, order_id, updated_at, history, current_state, conversation_status')
      .in('user_id', userIds)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      return c.json({ error: 'Failed to fetch conversations' }, 500);
    }

    // Get user info for each conversation
    const uniqueUserIds = [...new Set((conversationsData || []).map((c: any) => c.user_id))];
    const { data: usersData } = await serviceClient
      .from('users')
      .select('id, name, phone')
      .in('id', uniqueUserIds);

    const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));

    // Format conversations with decrypted phone and last message
    const formattedConversations = (conversationsData || []).map((conv: any) => {
      const history = (conv.history as any[]) || [];
      const lastMessage = history.length > 0 ? history[history.length - 1] : null;
      
      const user = usersMap.get(conv.user_id);
      
      // Decrypt phone (for display)
      let phoneDisplay = 'N/A';
      try {
        if (user?.phone) {
          phoneDisplay = decryptPhone(user.phone);
        }
      } catch {
        phoneDisplay = '***';
      }

      // Determine sentiment from last message (simple heuristic)
      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      if (lastMessage) {
        const content = lastMessage.content?.toLowerCase() || '';
        if (content.includes('teşekkür') || content.includes('harika') || content.includes('mükemmel')) {
          sentiment = 'positive';
        } else if (content.includes('kötü') || content.includes('şikayet') || content.includes('problem')) {
          sentiment = 'negative';
        }
      }

      return {
        id: conv.id,
        userId: conv.user_id,
        orderId: conv.order_id,
        userName: user?.name || 'İsimsiz Kullanıcı',
        phone: phoneDisplay,
        lastMessage: lastMessage
          ? {
              role: lastMessage.role,
              content: lastMessage.content,
              timestamp: lastMessage.timestamp,
            }
          : null,
        messageCount: history.length,
        lastMessageAt: conv.updated_at,
        status: conv.current_state || 'active',
        conversationStatus: conv.conversation_status || 'ai',
        sentiment,
      };
    });

    return c.json({ conversations: formattedConversations });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Get single conversation
 * GET /api/conversations/:id
 * Returns full conversation history
 */
conversations.get('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const conversationId = c.req.param('id');
    const serviceClient = getSupabaseServiceClient();

    // Get conversation with user info
    const { data: conversation, error } = await serviceClient
      .from('conversations')
      .select(`
        id,
        user_id,
        order_id,
        history,
        current_state,
        conversation_status,
        assigned_to,
        escalated_at,
        created_at,
        updated_at,
        users!inner (
          id,
          name,
          phone,
          merchant_id
        )
      `)
      .eq('id', conversationId)
      .single();

    if (error || !conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // Get user info
    const { data: user, error: userError } = await serviceClient
      .from('users')
      .select('id, name, phone, merchant_id')
      .eq('id', conversation.user_id)
      .single();

    if (userError || !user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify merchant ownership
    if (user.merchant_id !== merchantId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Decrypt phone
    let phoneDisplay = 'N/A';
    try {
      if (user?.phone) {
        phoneDisplay = decryptPhone(user.phone);
      }
    } catch {
      phoneDisplay = '***';
    }

    // Get order info if exists
    let orderInfo = null;
    if (conversation.order_id) {
      const { data: order } = await serviceClient
        .from('orders')
        .select('id, external_order_id, status, delivery_date')
        .eq('id', conversation.order_id)
        .single();

      if (order) {
        orderInfo = {
          id: order.id,
          externalOrderId: order.external_order_id,
          status: order.status,
          deliveryDate: order.delivery_date,
        };
      }
    }

    // Check for return prevention attempt on this conversation
    let returnPreventionAttempt = null;
    const { data: rpa } = await serviceClient
      .from('return_prevention_attempts')
      .select('id, outcome, trigger_message, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rpa) {
      returnPreventionAttempt = {
        id: rpa.id,
        outcome: rpa.outcome,
        triggerMessage: rpa.trigger_message,
        createdAt: rpa.created_at,
      };
    }

    return c.json({
      conversation: {
        id: conversation.id,
        userId: conversation.user_id,
        orderId: conversation.order_id,
        userName: user?.name || 'İsimsiz Kullanıcı',
        phone: phoneDisplay,
        history: (conversation.history as any[]) || [],
        status: conversation.current_state || 'active',
        conversationStatus: conversation.conversation_status || 'ai',
        assignedTo: conversation.assigned_to,
        escalatedAt: conversation.escalated_at,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        order: orderInfo,
        returnPreventionAttempt,
      },
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Reply to conversation (merchant sends message to user)
 * POST /api/conversations/:id/reply
 */
conversations.post('/:id/reply', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const conversationId = c.req.param('id');
    const { text } = await c.req.json();

    if (!text) {
      return c.json({ error: 'text is required' }, 400);
    }

    const serviceClient = getSupabaseServiceClient();

    // Get conversation and verify ownership
    const { data: conversation, error: convError } = await serviceClient
      .from('conversations')
      .select('id, user_id, conversation_status')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // Verify conversation belongs to merchant's user
    const { data: user, error: userError } = await serviceClient
      .from('users')
      .select('id, phone, merchant_id')
      .eq('id', conversation.user_id)
      .single();

    if (userError || !user || user.merchant_id !== merchantId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Set conversation_status to 'human' if not already
    if (conversation.conversation_status !== 'human') {
      await serviceClient
        .from('conversations')
        .update({
          conversation_status: 'human',
          escalated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    }

    // Add message to history as merchant
    await addMessageToConversation(conversationId, 'merchant', text);

    // Get user's phone (decrypt it)
    const userPhone = decryptPhone(user.phone);

    // Get WhatsApp credentials for merchant
    const credentials = await getEffectiveWhatsAppCredentials(merchantId);
    if (!credentials) {
      return c.json({ error: 'WhatsApp not configured' }, 400);
    }

    // Send message via WhatsApp
    const result = await sendWhatsAppMessage(
      { to: userPhone, text },
      credentials.accessToken,
      credentials.phoneNumberId
    );

    if (!result.success) {
      return c.json({ error: 'Failed to send message', details: result.error }, 500);
    }

    return c.json({ success: true, messageId: result.messageId });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Update conversation status
 * PUT /api/conversations/:id/status
 */
conversations.put('/:id/status', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const conversationId = c.req.param('id');
    const { status } = await c.req.json();

    // Validate status
    const validStatuses = ['ai', 'human', 'resolved'];
    if (!status || !validStatuses.includes(status)) {
      return c.json({ error: 'Invalid status. Must be one of: ai, human, resolved' }, 400);
    }

    const serviceClient = getSupabaseServiceClient();

    // Get conversation and verify ownership
    const { data: conversation, error: convError } = await serviceClient
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // Verify conversation belongs to merchant's user
    const { data: user, error: userError } = await serviceClient
      .from('users')
      .select('id, merchant_id')
      .eq('id', conversation.user_id)
      .single();

    if (userError || !user || user.merchant_id !== merchantId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Build update object
    const updateData: Record<string, any> = {
      conversation_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'human') {
      updateData.escalated_at = new Date().toISOString();
    }

    if (status === 'ai' || status === 'resolved') {
      updateData.assigned_to = null;
    }

    // Update conversation status
    const { error: updateError } = await serviceClient
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId);

    if (updateError) {
      return c.json({ error: 'Failed to update status' }, 500);
    }

    return c.json({ success: true, status });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default conversations;
