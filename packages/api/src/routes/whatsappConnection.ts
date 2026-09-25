/**
 * Link a store's own WhatsApp number by QR code (packages/wa-worker).
 *
 * Mounted at /api/integrations/whatsapp, before the integrations router so
 * /api/integrations/:id does not swallow it. Used by the web dashboard and,
 * over the internal path, by the Shopify app.
 *
 *   GET  /status      state for the connect card, with the QR while pairing
 *   POST /connect     start pairing (or restore a stored session)
 *   POST /disconnect  unlink on WhatsApp's side and forget the session
 *
 * The screens poll /status every couple of seconds while a QR is showing; it
 * reads the row the worker writes, so it costs one indexed select.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import {
  callWaWorker,
  getWaWorkerConfig,
  getWhatsAppConnection,
  logger,
  WaWorkerError,
  type WhatsAppConnectionRow,
} from '@recete/shared';

const whatsappConnection = new Hono();

function present(row: WhatsAppConnectionRow | null) {
  const available = Boolean(getWaWorkerConfig());
  if (!row) {
    return {
      available,
      status: 'disconnected' as const,
      phone: null,
      qr: null,
      lastError: null,
      connectedAt: null,
    };
  }
  return {
    available,
    status: row.status,
    phone: row.phone_e164,
    // Only while pairing: a stale code in the row must never be shown as live.
    qr: row.status === 'qr' ? row.qr : null,
    lastError: row.last_error,
    connectedAt: row.connected_at,
  };
}

whatsappConnection.get('/status', authMiddleware, async (c) => {
  const merchantId = c.get('merchantId') as string;
  // Nothing to read until the worker is set up (and migration 046 may not be
  // applied yet): answer "not available" instead of failing on the table.
  if (!getWaWorkerConfig()) return c.json(present(null));
  try {
    return c.json(present(await getWhatsAppConnection(merchantId)));
  } catch (error) {
    logger.error({ error, merchantId }, 'WhatsApp connection status failed');
    return c.json({ error: 'Could not read WhatsApp status' }, 500);
  }
});

whatsappConnection.post('/connect', authMiddleware, async (c) => {
  const merchantId = c.get('merchantId') as string;
  if (!getWaWorkerConfig()) {
    return c.json({ error: 'WhatsApp connection is not available yet' }, 503);
  }
  try {
    await callWaWorker('/connect', { method: 'POST', body: { merchantId } });
    return c.json(present(await getWhatsAppConnection(merchantId)));
  } catch (error) {
    const status = error instanceof WaWorkerError ? error.status : 0;
    logger.error({ error, merchantId, status }, 'WhatsApp connect failed');
    return c.json({ error: 'Could not start the WhatsApp connection. Try again.' }, 502);
  }
});

whatsappConnection.post('/disconnect', authMiddleware, async (c) => {
  const merchantId = c.get('merchantId') as string;
  if (!getWaWorkerConfig()) {
    return c.json({ error: 'WhatsApp connection is not available yet' }, 503);
  }
  try {
    await callWaWorker('/disconnect', { method: 'POST', body: { merchantId } });
    return c.json(present(await getWhatsAppConnection(merchantId)));
  } catch (error) {
    logger.error({ error, merchantId }, 'WhatsApp disconnect failed');
    return c.json({ error: 'Could not disconnect WhatsApp. Try again.' }, 502);
  }
});

export default whatsappConnection;
