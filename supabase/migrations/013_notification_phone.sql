-- Migration: Add notification_phone to merchants table
-- This is the phone number the bot sends alerts to when a customer requests a human agent.
-- Stored as plain text (not encrypted) since it's the merchant's own phone for receiving notifications.

ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS notification_phone TEXT;

COMMENT ON COLUMN merchants.notification_phone IS 
  'WhatsApp phone number (e164 format) to notify when a customer escalates to human agent. If null, no notification is sent.';
