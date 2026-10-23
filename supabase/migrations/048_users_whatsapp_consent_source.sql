-- WhatsApp consent provenance.
--
-- users.consent_status ('pending' | 'opt_in' | 'opt_out') gates every WhatsApp
-- message. It used to be derived from Shopify's email/SMS marketing consent and
-- overwritten by every order webhook, so a customer's WhatsApp STOP came back
-- on their next order. Consent now comes from Shopify's WhatsApp marketing
-- consent, the customer's own replies and the thank-you page opt-in, and these
-- columns record where the current value came from and when, so newer
-- decisions win and an opt-out isn't undone by older data.
--
-- consent_updated_at is also what PUT /api/gdpr/users/:id/consent already
-- writes; without the column that route failed.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS consent_updated_at timestamptz;

COMMENT ON COLUMN public.users.consent_source IS
  'Where consent_status came from: shopify (WhatsApp marketing consent), whatsapp_reply (customer replied STOP), thank_you_page, merchant_manual, import, legacy (before 048).';
COMMENT ON COLUMN public.users.consent_updated_at IS
  'When consent_status last changed at its source; newer decisions win.';

-- Rows from before this migration: their value was derived from email/SMS
-- consent or set by tests/imports. Keep it, but mark it as legacy so the next
-- Shopify WhatsApp consent read replaces it.
UPDATE public.users
SET consent_source = 'legacy',
    consent_updated_at = COALESCE(updated_at, created_at)
WHERE consent_source IS NULL;
