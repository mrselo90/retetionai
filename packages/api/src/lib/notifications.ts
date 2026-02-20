/**
 * Merchant notification utilities
 * Sends real-time alerts to the merchant when human attention is needed
 */

import { getSupabaseServiceClient } from '@recete/shared';
import { sendWhatsAppMessage, getEffectiveWhatsAppCredentials } from './whatsapp.js';
import { decryptPhone } from './encryption.js';

/**
 * Notify the merchant that a customer has requested a human agent.
 * Sends a WhatsApp message to the merchant's notification phone number.
 */
export async function notifyMerchantOfEscalation(params: {
    merchantId: string;
    customerName: string;
    customerPhone: string;
    conversationId: string;
    triggerMessage: string;
    reason: string;
}): Promise<void> {
    const { merchantId, customerName, customerPhone, conversationId, triggerMessage, reason } = params;

    try {
        const supabase = getSupabaseServiceClient();

        // Get merchant's notification phone number
        const { data: merchant } = await supabase
            .from('merchants')
            .select('name, notification_phone, persona_settings')
            .eq('id', merchantId)
            .single();

        if (!merchant) {
            console.warn('[Escalation] Merchant not found, skipping notification');
            return;
        }

        // Determine notification phone: use dedicated notification_phone, fallback to persona_settings.contact_phone
        const personaSettings = merchant.persona_settings as Record<string, any> || {};
        const rawNotificationPhone = merchant.notification_phone || personaSettings.notification_phone || personaSettings.contact_phone;

        if (!rawNotificationPhone) {
            console.warn(`[Escalation] No notification_phone for merchant ${merchantId}, skipping WhatsApp notification`);
            return;
        }

        // Decrypt if encrypted, otherwise use as-is
        let notificationPhone: string;
        try {
            notificationPhone = decryptPhone(rawNotificationPhone);
        } catch {
            notificationPhone = rawNotificationPhone; // Assume it's plain text
        }

        // Get WhatsApp credentials
        const credentials = await getEffectiveWhatsAppCredentials(merchantId);
        if (!credentials) {
            console.warn(`[Escalation] No WhatsApp credentials for merchant ${merchantId}`);
            return;
        }

        // Build the reason label
        const reasonLabels: Record<string, string> = {
            crisis_keyword: '🚨 Kriz / Acil Durum',
            medical_advice: '🏥 Tıbbi Bilgi Talebi',
            human_request: '🙋 Temsilci İstedi',
            return_intent_insistence: '📦 İade Israrı',
            custom: '⚠️ Özel Kural Tetiklendi',
        };
        const reasonLabel = reasonLabels[reason] || '⚠️ Acil Durum';

        // Truncate trigger message for display
        const msgPreview = triggerMessage.length > 120
            ? triggerMessage.slice(0, 120) + '...'
            : triggerMessage;

        // Build notification message
        const dashboardUrl = `https://recete.app/tr/dashboard/conversations/${conversationId}`;
        const notificationText =
            `🔴 *Müşteri Temsilci İstedi*\n\n` +
            `👤 *Müşteri:* ${customerName} (${customerPhone})\n` +
            `📋 *Neden:* ${reasonLabel}\n` +
            `💬 *Mesaj:* "${msgPreview}"\n\n` +
            `Yanıtlamak için paneli açın:\n${dashboardUrl}`;

        await sendWhatsAppMessage(
            { to: notificationPhone, text: notificationText },
            credentials.accessToken,
            credentials.phoneNumberId
        );

        console.log(`[Escalation] ✅ Merchant ${merchantId} notified at ${notificationPhone}`);
    } catch (error) {
        // Non-critical — escalation still proceeds even if notification fails
        console.error('[Escalation] Failed to notify merchant:', error);
    }
}
