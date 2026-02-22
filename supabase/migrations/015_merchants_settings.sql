-- Migration: Add settings JSONB to merchants (for admin capped amount and future config)
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN merchants.settings IS 'Admin/config: { "capped_amount"?: number, ... }';
