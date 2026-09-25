/**
 * Resource route behind the WhatsApp connect card: the loader is what the card
 * polls while a QR is showing, the action links or unlinks the number.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  extractPlatformErrorMessage,
  fetchWhatsAppConnection,
} from '../platform.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  try {
    return { ok: true as const, status: await fetchWhatsAppConnection(request) };
  } catch (error) {
    return {
      ok: false as const,
      error: await extractPlatformErrorMessage(error, "Couldn't load your WhatsApp connection."),
    };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const intent = String((await request.formData()).get('intent') || '');
  try {
    if (intent === 'connect') {
      return { ok: true as const, intent, status: await connectWhatsApp(request) };
    }
    if (intent === 'disconnect') {
      return { ok: true as const, intent, status: await disconnectWhatsApp(request) };
    }
    return { ok: false as const, intent, error: 'Unknown action' };
  } catch (error) {
    return {
      ok: false as const,
      intent,
      error: await extractPlatformErrorMessage(error, 'Could not update the WhatsApp connection.'),
    };
  }
};
