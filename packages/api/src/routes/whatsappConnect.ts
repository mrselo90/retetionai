/**
 * Connect a merchant's own WhatsApp Business number with Meta's Embedded
 * Signup. The browser runs Meta's signup popup (Facebook login) and hands us a
 * one-time code plus the WhatsApp Business Account and phone number the
 * merchant picked; everything that needs the app secret happens here.
 *
 * Mounted at /api/integrations/whatsapp. Disabled until the Meta app is
 * configured (META_APP_ID, META_APP_SECRET, META_EMBEDDED_SIGNUP_CONFIG_ID):
 * the screens then show the connection as "coming soon".
 */

import { Hono } from 'hono';
import * as crypto from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
import {
  encryptSecret,
  findMerchantByPhoneNumberId,
  getMetaGraphVersion,
  getSupabaseServiceClient,
  logger,
  type WhatsAppCloudAuthData,
} from '@recete/shared';

const whatsappConnect = new Hono();

type MetaAppConfig = { appId: string; appSecret: string; configId: string };

function getMetaAppConfig(): MetaAppConfig | null {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim();
  return appId && appSecret && configId ? { appId, appSecret, configId } : null;
}

class GraphError extends Error {
  constructor(
    message: string,
    readonly step: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function graph<T>(
  step: string,
  path: string,
  init: {
    method?: 'GET' | 'POST' | 'DELETE';
    token?: string;
    body?: unknown;
    query?: Record<string, string>;
  } = {}
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${getMetaGraphVersion()}/${path}`);
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) {
    throw new GraphError(data?.error?.message || `HTTP ${response.status}`, step, response.status);
  }
  return data as T;
}

/**
 * Public config for the signup popup. appId and configId are not secrets —
 * they are what Meta's JS SDK needs in the browser.
 */
whatsappConnect.get('/embedded-signup/config', authMiddleware, (c) => {
  const config = getMetaAppConfig();
  return c.json(
    config
      ? {
          enabled: true,
          appId: config.appId,
          configId: config.configId,
          graphVersion: getMetaGraphVersion(),
        }
      : { enabled: false }
  );
});

/** The merchant's connected number, if any. Never returns the token. */
whatsappConnect.get('/status', authMiddleware, async (c) => {
  const merchantId = c.get('merchantId') as string;
  const { data: row } = await getSupabaseServiceClient()
    .from('integrations')
    .select('id, status, auth_data, updated_at')
    .eq('merchant_id', merchantId)
    .eq('provider', 'whatsapp')
    .maybeSingle();

  const auth = row?.auth_data as Partial<WhatsAppCloudAuthData> | undefined;
  if (!row || row.status !== 'active' || auth?.provider !== 'meta_cloud') {
    return c.json({ connected: false });
  }
  return c.json({
    connected: true,
    phoneNumberDisplay: auth.phone_number_display ?? null,
    verifiedName: auth.verified_name ?? null,
    coexistence: Boolean(auth.coexistence),
    connectedAt: auth.connected_at ?? row.updated_at ?? null,
  });
});

whatsappConnect.post('/embedded-signup', authMiddleware, async (c) => {
  const config = getMetaAppConfig();
  if (!config) {
    return c.json({ error: 'WhatsApp connection is not available yet' }, 503);
  }

  const merchantId = c.get('merchantId') as string;
  const body = (await c.req.json().catch(() => ({}))) as {
    code?: unknown;
    wabaId?: unknown;
    phoneNumberId?: unknown;
    coexistence?: unknown;
  };
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const wabaId = typeof body.wabaId === 'string' ? body.wabaId.trim() : '';
  const phoneNumberId = typeof body.phoneNumberId === 'string' ? body.phoneNumberId.trim() : '';
  const coexistence = body.coexistence === true;

  if (!code || !/^\d+$/.test(wabaId) || !/^\d+$/.test(phoneNumberId)) {
    return c.json({ error: 'code, wabaId and phoneNumberId are required' }, 400);
  }

  // One number, one store: inbound messages are routed by phone_number_id.
  const owner = await findMerchantByPhoneNumberId(phoneNumberId);
  if (owner && owner !== merchantId) {
    return c.json({ error: 'This WhatsApp number is already connected to another store' }, 409);
  }

  try {
    // 1. One-time code -> business token for the accounts the merchant granted.
    const { access_token: accessToken } = await graph<{ access_token?: string }>(
      'exchange_code',
      'oauth/access_token',
      {
        query: { client_id: config.appId, client_secret: config.appSecret, code },
      }
    );
    if (!accessToken) throw new GraphError('No access token returned', 'exchange_code', 502);

    // 2. The token must reach the number the browser reported. Reading it
    //    also gives us the display number and verified business name.
    const phone = await graph<{ display_phone_number?: string; verified_name?: string }>(
      'read_phone_number',
      phoneNumberId,
      { token: accessToken, query: { fields: 'display_phone_number,verified_name' } }
    );

    // 3. Deliver this account's messages to our webhook.
    await graph('subscribe_app', `${wabaId}/subscribed_apps`, {
      method: 'POST',
      token: accessToken,
    });

    // 4. A new Cloud API number has to be registered before it can send. A
    //    number onboarded from the WhatsApp Business app (coexistence) is not.
    let pinEnc: string | undefined;
    if (!coexistence) {
      const pin = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
      await graph('register_phone_number', `${phoneNumberId}/register`, {
        method: 'POST',
        token: accessToken,
        body: { messaging_product: 'whatsapp', pin },
      });
      pinEnc = encryptSecret(pin);
    }

    const authData: WhatsAppCloudAuthData & { pin_enc?: string } = {
      provider: 'meta_cloud',
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      phone_number_display: phone.display_phone_number ?? null,
      verified_name: phone.verified_name ?? null,
      access_token_enc: encryptSecret(accessToken),
      coexistence,
      connected_at: new Date().toISOString(),
      ...(pinEnc ? { pin_enc: pinEnc } : {}),
    };

    const serviceClient = getSupabaseServiceClient();
    const { data: existing } = await serviceClient
      .from('integrations')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('provider', 'whatsapp')
      .maybeSingle();

    const write = existing
      ? serviceClient
          .from('integrations')
          .update({
            auth_type: 'oauth',
            auth_data: authData,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      : serviceClient.from('integrations').insert({
          merchant_id: merchantId,
          provider: 'whatsapp',
          auth_type: 'oauth',
          auth_data: authData,
          status: 'active',
        });
    const { error: writeError } = await write;
    if (writeError) {
      logger.error({ writeError, merchantId }, '[whatsapp-connect] Could not store connection');
      return c.json({ error: 'Could not save the WhatsApp connection' }, 500);
    }

    logger.info(
      { merchantId, wabaId, phoneNumberId, coexistence },
      '[whatsapp-connect] Number connected'
    );
    return c.json({
      connected: true,
      phoneNumberDisplay: authData.phone_number_display,
      verifiedName: authData.verified_name,
      coexistence,
    });
  } catch (error) {
    if (error instanceof GraphError) {
      logger.warn(
        { merchantId, step: error.step, status: error.status, message: error.message },
        '[whatsapp-connect] Meta rejected a step'
      );
      return c.json(
        { error: `Meta did not accept the connection (${error.step}): ${error.message}` },
        502
      );
    }
    logger.error({ error, merchantId }, '[whatsapp-connect] Unexpected failure');
    return c.json({ error: 'Could not connect WhatsApp' }, 500);
  }
});

/** Disconnect: Recete stops sending and receiving for this store. */
whatsappConnect.delete('/', authMiddleware, async (c) => {
  const merchantId = c.get('merchantId') as string;
  const { error } = await getSupabaseServiceClient()
    .from('integrations')
    .delete()
    .eq('merchant_id', merchantId)
    .eq('provider', 'whatsapp');
  if (error) {
    return c.json({ error: 'Could not disconnect WhatsApp' }, 500);
  }
  return c.json({ connected: false });
});

export default whatsappConnect;
