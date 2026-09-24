/**
 * WhatsApp messaging goes through Meta's Cloud API with numbers each merchant
 * connects via Embedded Signup. The implementation lives in @recete/shared
 * (whatsappCloud.ts) so the API and the workers send the same way.
 */
export {
  sendWhatsAppMessage,
  getEffectiveWhatsAppCredentials,
  getCorporateWhatsAppCredentials,
  type WhatsAppMessage,
  type WhatsAppSendResponse,
  type WhatsAppCredentials,
  type WhatsAppWebhookMessage,
} from '@recete/shared';
