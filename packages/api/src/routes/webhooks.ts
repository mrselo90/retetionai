/**
 * Webhook ingestion routes
 * Receive events from Shopify and manual sources
 */

import { Hono } from 'hono';
import { getSupabaseServiceClient, logger } from '@glowguide/shared';
import { verifyShopifyHmac } from '../lib/shopify';
import {
  normalizeShopifyEvent,
  generateIdempotencyKey,
  type NormalizedEvent,
} from '../lib/events';
import { processNormalizedEvent } from '../lib/orderProcessor';
import * as crypto from 'crypto';

const webhooks = new Hono();

/**
 * Shopify webhook endpoint
 * POST /webhooks/commerce/shopify
 * Receives webhooks from Shopify (orders/create, orders/fulfilled, etc.)
 */
webhooks.post('/commerce/shopify', async (c) => {
  try {
    // Get Shopify webhook headers
    const shop = c.req.header('x-shopify-shop-domain');
    const topic = c.req.header('x-shopify-topic');
    const hmac = c.req.header('x-shopify-hmac-sha256');

    if (!shop || !topic || !hmac) {
      return c.json({ error: 'Missing Shopify webhook headers' }, 400);
    }

    // Get raw body for HMAC verification
    const rawBody = await c.req.text();
    const body = JSON.parse(rawBody);

    // Verify HMAC
    const calculatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
      .update(rawBody, 'utf8')
      .digest('base64');

    if (calculatedHmac !== hmac) {
      return c.json({ error: 'Invalid HMAC signature' }, 401);
    }

    // Find integration by shop domain
    const serviceClient = getSupabaseServiceClient();
    const { data: integrations } = await serviceClient
      .from('integrations')
      .select('id, merchant_id, auth_data')
      .eq('provider', 'shopify')
      .eq('status', 'active');

    if (!integrations || integrations.length === 0) {
      return c.json({ error: 'No active Shopify integration found' }, 404);
    }

    // Find matching integration by shop
    const integration = integrations.find(
      (i) => (i.auth_data as any)?.shop === shop
    );

    if (!integration) {
      return c.json({ error: 'Integration not found for shop' }, 404);
    }

    // Normalize event
    const normalizedEvent = normalizeShopifyEvent(
      integration.merchant_id,
      integration.id,
      body,
      topic
    );

    if (!normalizedEvent) {
      return c.json({ error: 'Failed to normalize event' }, 400);
    }

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(
      normalizedEvent.source,
      normalizedEvent.event_type,
      normalizedEvent.external_order_id,
      normalizedEvent.occurred_at,
      body.id?.toString()
    );

    // Store in external_events (with idempotency)
    const { error: insertError } = await serviceClient
      .from('external_events')
      .insert({
        merchant_id: normalizedEvent.merchant_id,
        integration_id: normalizedEvent.integration_id,
        source: normalizedEvent.source,
        event_type: normalizedEvent.event_type,
        payload: normalizedEvent as any,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    // Handle duplicate (idempotency key conflict)
    if (insertError) {
      // Check if it's a duplicate key error
      if (insertError.code === '23505') {
        // Unique constraint violation (duplicate)
        return c.json({ message: 'Event already processed (idempotent)' }, 200);
      }
      return c.json({ error: 'Failed to store event' }, 500);
    }

    // Process event immediately (upsert order/user)
    try {
      await processNormalizedEvent(normalizedEvent);
    } catch (processError) {
      // Log error but don't fail webhook (event is stored, can be retried)
      console.error('Error processing event:', processError);
    }

    return c.json({
      message: 'Event received, stored, and processed',
      eventType: normalizedEvent.event_type,
      idempotencyKey,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Generic commerce event endpoint (manual push)
 * POST /webhooks/commerce/event
 * Accepts normalized events from merchants (API push or manual webhook)
 */
webhooks.post('/commerce/event', async (c) => {
  try {
    // Get API key from header
    const apiKey = c.req.header('X-Api-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return c.json({ error: 'Missing API key' }, 401);
    }

    // Find merchant by API key
    const serviceClient = getSupabaseServiceClient();
    const { data: merchants } = await serviceClient
      .from('merchants')
      .select('id, api_keys');

    if (!merchants) {
      return c.json({ error: 'Authentication failed' }, 401);
    }

    // Hash API key and find merchant
    const { hashApiKey } = await import('@glowguide/shared');
    const hashedKey = hashApiKey(apiKey);

    const merchant = merchants.find((m) => {
      const apiKeys = (m.api_keys as string[]) || [];
      return apiKeys.includes(hashedKey);
    });

    if (!merchant) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    // Parse normalized event
    const body = await c.req.json();
    const event: NormalizedEvent = body;

    // Validate required fields
    if (!event.event_type || !event.external_order_id || !event.occurred_at) {
      return c.json({
        error: 'Missing required fields: event_type, external_order_id, occurred_at',
      }, 400);
    }

    // Set merchant_id (override if provided)
    event.merchant_id = merchant.id;

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(
      event.source || 'manual',
      event.event_type,
      event.external_order_id,
      event.occurred_at
    );

    // Store in external_events
    const { error: insertError } = await serviceClient
      .from('external_events')
      .insert({
        merchant_id: event.merchant_id,
        integration_id: event.integration_id,
        source: event.source || 'manual',
        event_type: event.event_type,
        payload: event as any,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    // Handle duplicate
    if (insertError) {
      if (insertError.code === '23505') {
        return c.json({ message: 'Event already processed (idempotent)' }, 200);
      }
      return c.json({ error: 'Failed to store event' }, 500);
    }

    // Process event immediately (upsert order/user)
    try {
      await processNormalizedEvent(event);
    } catch (processError) {
      // Log error but don't fail webhook (event is stored, can be retried)
      console.error('Error processing event:', processError);
    }

    return c.json({
      message: 'Event received, stored, and processed',
      eventType: event.event_type,
      idempotencyKey,
    });
  } catch (error) {
    console.error('Event processing error:', error);
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default webhooks;
