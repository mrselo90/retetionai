/**
 * Integration routes
 * CRUD operations for merchant integrations
 */

import { Hono } from 'hono';
import { getSupabaseServiceClient } from '@recete/shared';
import { authMiddleware } from '../middleware/auth.js';

const integrations = new Hono();

type WhatsAppAuthDataInput = {
  wa_provider?: 'meta' | 'twilio';
  provider_type?: 'meta' | 'twilio';
  phone_number_id?: string;
  access_token?: string;
  verify_token?: string;
  account_sid?: string;
  auth_token?: string;
  from_number?: string;
  phone_number_display?: string;
};

function getWhatsAppProviderType(auth: WhatsAppAuthDataInput): 'meta' | 'twilio' {
  const declared = auth.wa_provider || auth.provider_type;
  if (declared === 'meta' || declared === 'twilio') return declared;
  if (auth.account_sid || auth.auth_token || auth.from_number) return 'twilio';
  return 'meta';
}

function validateWhatsAppAuthData(authData: unknown): { valid: true } | { valid: false; error: string } {
  if (!authData || typeof authData !== 'object' || Array.isArray(authData)) {
    return { valid: false, error: 'auth_data is required and must be an object' };
  }

  const wa = authData as WhatsAppAuthDataInput;
  const providerType = getWhatsAppProviderType(wa);

  if (providerType === 'twilio') {
    if (!wa.account_sid || !wa.auth_token || !wa.from_number) {
      return {
        valid: false,
        error:
          'Twilio WhatsApp integration requires auth_data.account_sid, auth_data.auth_token, and auth_data.from_number',
      };
    }
    return { valid: true };
  }

  if (!wa.phone_number_id || !wa.access_token || !wa.verify_token) {
    return {
      valid: false,
      error: 'Meta WhatsApp integration requires auth_data.phone_number_id, auth_data.access_token, and auth_data.verify_token',
    };
  }

  return { valid: true };
}

function sanitizeWhatsAppAuthData(authData: unknown): Record<string, unknown> {
  if (!authData || typeof authData !== 'object' || Array.isArray(authData)) {
    return {};
  }

  const wa = authData as WhatsAppAuthDataInput;
  const providerType = getWhatsAppProviderType(wa);

  if (providerType === 'twilio') {
    return {
      wa_provider: 'twilio',
      phone_number_display: wa.phone_number_display,
      from_number: wa.from_number,
      account_sid: wa.account_sid,
    };
  }

  return {
    wa_provider: 'meta',
    phone_number_display: wa.phone_number_display,
    phone_number_id: wa.phone_number_id,
  };
}

// All routes require authentication
// integrations.use('/*', authMiddleware); // Removed global middleware to avoid affecting nested routes

/**
 * List All Integrations (Protected)
 * GET /api/integrations
 */
integrations.get('/', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;

    const serviceClient = getSupabaseServiceClient();
    const { data: rawList, error } = await serviceClient
      .from('integrations')
      .select('id, provider, status, auth_type, created_at, updated_at, auth_data')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: 'Failed to fetch integrations' }, 500);
    }

    const integrationList = (rawList || []).map((row: { auth_data?: { phone_number_display?: string; shop?: string; wa_provider?: string; provider_type?: string; from_number?: string }; provider?: string; [k: string]: unknown }) => {
      const { auth_data, ...rest } = row;
      const out = { ...rest };
      if (row.provider === 'whatsapp' && auth_data && typeof auth_data === 'object' && 'phone_number_display' in auth_data) {
        (out as Record<string, unknown>).phone_number_display = (auth_data as { phone_number_display?: string }).phone_number_display;
        const waAuth = auth_data as WhatsAppAuthDataInput;
        (out as Record<string, unknown>).whatsapp_provider = getWhatsAppProviderType(waAuth);
        if (waAuth.from_number) {
          (out as Record<string, unknown>).from_number = waAuth.from_number;
        }
      }
      if (row.provider === 'shopify' && auth_data && typeof auth_data === 'object' && 'shop' in auth_data) {
        (out as Record<string, unknown>).shop_domain = (auth_data as { shop?: string }).shop;
      }
      return out;
    });

    return c.json({ integrations: integrationList });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Get Single Integration (Protected)
 * GET /api/integrations/:id
 */
integrations.get('/:id', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const integrationId = c.req.param('id');

    const serviceClient = getSupabaseServiceClient();
    const { data: integration, error } = await serviceClient
      .from('integrations')
      .select('id, provider, status, auth_type, auth_data, created_at, updated_at')
      .eq('id', integrationId)
      .eq('merchant_id', merchantId)
      .single();

    if (error || !integration) {
      return c.json({ error: 'Integration not found' }, 404);
    }

    // For WhatsApp, do not expose access_token or verify_token
    if (integration.provider === 'whatsapp' && integration.auth_data && typeof integration.auth_data === 'object') {
      integration.auth_data = sanitizeWhatsAppAuthData(integration.auth_data);
    }

    return c.json({ integration });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Create Integration (Protected)
 * POST /api/integrations
 */
integrations.post('/', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const body = await c.req.json();

    // Validate required fields
    const { provider, auth_type, auth_data } = body;

    if (!provider || typeof provider !== 'string') {
      return c.json({ error: 'provider is required and must be a string' }, 400);
    }

    // Validate provider
    const validProviders = ['shopify', 'woocommerce', 'ticimax', 'manual', 'whatsapp'];
    if (!validProviders.includes(provider)) {
      return c.json({
        error: `provider must be one of: ${validProviders.join(', ')}`
      }, 400);
    }

    if (!auth_type || typeof auth_type !== 'string') {
      return c.json({ error: 'auth_type is required and must be a string' }, 400);
    }

    // Validate auth_type
    const validAuthTypes = ['oauth', 'api_key', 'token'];
    if (!validAuthTypes.includes(auth_type)) {
      return c.json({
        error: `auth_type must be one of: ${validAuthTypes.join(', ')}`
      }, 400);
    }

    if (!auth_data || typeof auth_data !== 'object' || Array.isArray(auth_data)) {
      return c.json({ error: 'auth_data is required and must be an object' }, 400);
    }

    // WhatsApp: validate provider-specific credentials (Meta or Twilio)
    if (provider === 'whatsapp') {
      const validation = validateWhatsAppAuthData(auth_data);
      if (!validation.valid) {
        return c.json({ error: validation.error }, 400);
      }
    }

    // Check if integration already exists for this provider
    const serviceClient = getSupabaseServiceClient();
    const { data: existing } = await serviceClient
      .from('integrations')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('provider', provider)
      .single();

    if (existing) {
      return c.json({
        error: `Integration for provider '${provider}' already exists`
      }, 409);
    }

    // Create integration
    const { data: integration, error } = await serviceClient
      .from('integrations')
      .insert({
        merchant_id: merchantId,
        provider,
        status: 'pending', // Default status
        auth_type,
        auth_data,
      })
      .select('id, provider, status, auth_type, created_at, updated_at')
      .single();

    if (error) {
      return c.json({ error: 'Failed to create integration' }, 500);
    }

    return c.json({ integration }, 201);
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Update Integration (Protected)
 * PUT /api/integrations/:id
 */
integrations.put('/:id', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const integrationId = c.req.param('id');
    const body = await c.req.json();

    // Validate allowed fields
    const allowedFields = ['status', 'auth_data'];
    const updates: Record<string, any> = {};

    if (body.status !== undefined) {
      const validStatuses = ['pending', 'active', 'error', 'disabled'];
      if (!validStatuses.includes(body.status)) {
        return c.json({
          error: `status must be one of: ${validStatuses.join(', ')}`
        }, 400);
      }
      updates.status = body.status;
    }

    if (body.auth_data !== undefined) {
      if (typeof body.auth_data !== 'object' || Array.isArray(body.auth_data)) {
        return c.json({ error: 'auth_data must be an object' }, 400);
      }
      updates.auth_data = body.auth_data;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400);
    }

    const serviceClient = getSupabaseServiceClient();

    // Verify integration belongs to merchant
    const { data: existing } = await serviceClient
      .from('integrations')
      .select('id, provider')
      .eq('id', integrationId)
      .eq('merchant_id', merchantId)
      .single();

    if (!existing) {
      return c.json({ error: 'Integration not found' }, 404);
    }

    if (body.auth_data !== undefined && (existing as { provider?: string }).provider === 'whatsapp') {
      const validation = validateWhatsAppAuthData(body.auth_data);
      if (!validation.valid) {
        return c.json({ error: validation.error }, 400);
      }
    }

    // Update integration
    const { data: integration, error } = await serviceClient
      .from('integrations')
      .update(updates)
      .eq('id', integrationId)
      .eq('merchant_id', merchantId)
      .select('id, provider, status, auth_type, created_at, updated_at')
      .single();

    if (error) {
      return c.json({ error: 'Failed to update integration' }, 500);
    }

    return c.json({ integration });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Delete Integration (Protected)
 * DELETE /api/integrations/:id
 */
integrations.delete('/:id', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const integrationId = c.req.param('id');

    const serviceClient = getSupabaseServiceClient();

    // Verify integration belongs to merchant
    const { data: existing } = await serviceClient
      .from('integrations')
      .select('id')
      .eq('id', integrationId)
      .eq('merchant_id', merchantId)
      .single();

    if (!existing) {
      return c.json({ error: 'Integration not found' }, 404);
    }

    // Delete integration
    const { error } = await serviceClient
      .from('integrations')
      .delete()
      .eq('id', integrationId)
      .eq('merchant_id', merchantId);

    if (error) {
      return c.json({ error: 'Failed to delete integration' }, 500);
    }

    return c.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default integrations;
