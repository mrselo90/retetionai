/**
 * Conversation routes
 * List and view conversations
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseServiceClient } from '@glowguide/shared';
import { decryptPhone } from '../lib/encryption';

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
      .select('id, user_id, order_id, updated_at, history, current_state')
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

    return c.json({
      conversation: {
        id: conversation.id,
        userId: conversation.user_id,
        orderId: conversation.order_id,
        userName: user?.name || 'İsimsiz Kullanıcı',
        phone: phoneDisplay,
        history: (conversation.history as any[]) || [],
        status: conversation.current_state || 'active',
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        order: orderInfo,
      },
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default conversations;
