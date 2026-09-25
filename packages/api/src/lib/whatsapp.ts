/**
 * WhatsApp sends go through each store's linked device (packages/wa-worker).
 * The implementation lives in @recete/shared (whatsappWorker.ts) so the API
 * and the workers send, and classify failures, the same way.
 */
export {
  sendWhatsAppMessage,
  getEffectiveWhatsAppCredentials,
  getCorporateWhatsAppCredentials,
  WHATSAPP_NOT_CONFIGURED,
  type WhatsAppMessage,
  type WhatsAppSendResponse,
  type WhatsAppCredentials,
  type WhatsAppWebhookMessage,
} from '@recete/shared';
