/**
 * Webhook ingestion routes
 * Receive events from Shopify and manual sources
 */

import { Hono } from 'hono';
import { getSupabaseServiceClient, logger } from '@recete/shared';
import { verifyShopifyHmac } from '../lib/shopify.js';
import {
  normalizeShopifyEvent,
  generateIdempotencyKey,
  type NormalizedEvent,
} from '../lib/events.js';
import { handleShopifyBillingWebhook } from '../lib/shopifyBilling.js';
import { processNormalizedEvent } from '../lib/orderProcessor.js';
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

    // Find integration directly by shop domain (efficient single-row lookup)
    const serviceClient = getSupabaseServiceClient();
    const { data: integration } = await serviceClient
      .from('integrations')
      .select('id, merchant_id, auth_data')
      .eq('provider', 'shopify')
      .eq('status', 'active')
      .contains('auth_data', { shop })
      .maybeSingle();

    if (!integration) {
      return c.json({ error: 'Integration not found for shop' }, 404);
    }

    // Handle App Uninstall — Shopify App Store zorunlu gereksinim
    // Mağaza uygulamayı kaldırdığında entegrasyonu deaktive et ve aboneliği iptal et
    if (topic === 'app/uninstalled') {
      try {
        const merchantId = integration.merchant_id;
        logger.info({ shop, merchantId }, '[Uninstall] Mağaza uygulamayı kaldırdı. Entegrasyon ve abonelik deaktive ediliyor.');

        // 1. Entegrasyonu "uninstalled" olarak işaretle
        const { error: intError } = await serviceClient
          .from('integrations')
          .update({
            status: 'uninstalled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', integration.id);

        if (intError) {
          logger.error({ intError, shop, merchantId }, '[Uninstall] Entegrasyon güncellenemedi.');
        }

        // 2. Merchant aboneliğini iptal et
        const { error: merchError } = await serviceClient
          .from('merchants')
          .update({
            subscription_status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('id', merchantId);

        if (merchError) {
          logger.error({ merchError, shop, merchantId }, '[Uninstall] Merchant abonelik durumu güncellenemedi.');
        }

        logger.info({ shop, merchantId }, '[Uninstall] Mağaza başarıyla deaktive edildi.');
        return c.json({ message: 'App uninstall processed' }, 200);
      } catch (err) {
        logger.error({ err, shop }, '[Uninstall] app/uninstalled webhook işlenirken hata oluştu.');
        return c.json({ error: 'Failed to process app uninstall' }, 500);
      }
    }

    // Handle App Subscriptions (Shopify Billing)
    if (topic === 'app_subscriptions/update') {
      try {
        const appSubscription = body?.app_subscription;
        if (!appSubscription) {
          return c.json({ error: 'Missing app_subscription in payload' }, 400);
        }

        const graphqlId: string = appSubscription.admin_graphql_api_id;
        const status: string = appSubscription.status;

        if (!graphqlId || !status) {
          return c.json({ error: 'Missing id or status in app_subscription' }, 400);
        }

        // Extract numeric charge ID from GraphQL ID (e.g. gid://shopify/AppSubscription/12345)
        const chargeIdMatch = graphqlId.match(/\d+$/);
        const chargeId = chargeIdMatch ? chargeIdMatch[0] : graphqlId;

        await handleShopifyBillingWebhook(integration.merchant_id, chargeId, status);
        return c.json({ message: 'App subscription updating processed successfully' }, 200);
      } catch (err) {
        logger.error({ err, shop }, 'Error processing Shopify app_subscription webhook');
        return c.json({ error: 'Failed to process app subscription update' }, 500);
      }
    }

    // Normalize event (for standard commerce webhooks)
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
      logger.error({ processError, shop }, 'Error processing event');
    }

    return c.json({
      message: 'Event received, stored, and processed',
      eventType: normalizedEvent.event_type,
      idempotencyKey,
    });
  } catch (error) {
    logger.error({ error }, 'Webhook processing error');
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
  return c.json({
    error: 'Manual commerce webhook API-key ingestion has been removed',
    message: 'Use Shopify webhooks (HMAC-verified) or an internal ingestion endpoint.',
  }, 410);
});

export default webhooks;
