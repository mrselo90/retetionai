/**
 * Team management routes
 * Merchant members: invite, list, update roles, remove
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseServiceClient } from '@recete/shared';

const members = new Hono();
members.use('/*', authMiddleware);

/**
 * List team members
 * GET /api/merchants/me/members
 */
members.get('/', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const serviceClient = getSupabaseServiceClient();

    const { data, error } = await serviceClient
      .from('merchant_members')
      .select('id, user_id, role, invited_at, accepted_at, created_at')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: true });

    if (error) {
      return c.json({ error: 'Failed to fetch members' }, 500);
    }

    // Get user emails from auth
    const userIds = (data || []).map((m: any) => m.user_id);
    const memberEmails = new Map<string, string>();

    for (const uid of userIds) {
      const { data: { user } } = await serviceClient.auth.admin.getUserById(uid);
      if (user?.email) {
        memberEmails.set(uid, user.email);
      }
    }

    const formattedMembers = (data || []).map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      email: memberEmails.get(m.user_id) || '—',
      role: m.role,
      invitedAt: m.invited_at,
      acceptedAt: m.accepted_at,
    }));

    return c.json({ members: formattedMembers });
  } catch (error) {
    return c.json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' }, 500);
  }
});

/**
 * Invite team member
 * POST /api/merchants/me/members/invite
 * Body: { email, role }
 */
members.post('/invite', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const { email, role } = await c.req.json();

    if (!email) return c.json({ error: 'email is required' }, 400);
    const validRoles = ['admin', 'agent', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      return c.json({ error: `role must be one of: ${validRoles.join(', ')}` }, 400);
    }

    const serviceClient = getSupabaseServiceClient();

    // Check if user already exists
    const { data: { users } } = await serviceClient.auth.admin.listUsers();
    const existingUser = users?.find((u: any) => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Invite user via Supabase
      const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email);
      if (inviteError || !invited.user) {
        return c.json({ error: 'Failed to invite user', details: inviteError?.message }, 500);
      }
      userId = invited.user.id;
    }

    // Check if already a member
    const { data: existing } = await serviceClient
      .from('merchant_members')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return c.json({ error: 'User is already a member of this team' }, 409);
    }

    // Insert member
    const { data: member, error: insertError } = await serviceClient
      .from('merchant_members')
      .insert({
        merchant_id: merchantId,
        user_id: userId,
        role,
        accepted_at: existingUser ? new Date().toISOString() : null,
      })
      .select('id, role')
      .single();

    if (insertError) {
      return c.json({ error: 'Failed to add member', details: insertError.message }, 500);
    }

    return c.json({ success: true, member: { id: member?.id, email, role } }, 201);
  } catch (error) {
    return c.json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' }, 500);
  }
});

/**
 * Update member role
 * PUT /api/merchants/me/members/:id
 * Body: { role }
 */
members.put('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const memberId = c.req.param('id');
    const { role } = await c.req.json();

    const validRoles = ['admin', 'agent', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      return c.json({ error: `role must be one of: ${validRoles.join(', ')}` }, 400);
    }

    const serviceClient = getSupabaseServiceClient();

    const { error } = await serviceClient
      .from('merchant_members')
      .update({ role })
      .eq('id', memberId)
      .eq('merchant_id', merchantId);

    if (error) {
      return c.json({ error: 'Failed to update member' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' }, 500);
  }
});

/**
 * Remove member
 * DELETE /api/merchants/me/members/:id
 */
members.delete('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const memberId = c.req.param('id');
    const serviceClient = getSupabaseServiceClient();

    // Don't allow removing the owner
    const { data: member } = await serviceClient
      .from('merchant_members')
      .select('role')
      .eq('id', memberId)
      .eq('merchant_id', merchantId)
      .single();

    if (!member) {
      return c.json({ error: 'Member not found' }, 404);
    }
    if (member.role === 'owner') {
      return c.json({ error: 'Cannot remove the owner' }, 403);
    }

    const { error } = await serviceClient
      .from('merchant_members')
      .delete()
      .eq('id', memberId)
      .eq('merchant_id', merchantId);

    if (error) {
      return c.json({ error: 'Failed to remove member' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' }, 500);
  }
});

export default members;
