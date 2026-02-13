-- Merchant-configurable guardrails (custom rules in addition to system guardrails)
-- System guardrails (crisis, medical) remain in code and are read-only in UI.

ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS guardrail_settings JSONB NOT NULL DEFAULT '{"custom_guardrails":[]}'::jsonb;

COMMENT ON COLUMN merchants.guardrail_settings IS 'Custom guardrail rules: { "custom_guardrails": [ { "id", "name", "apply_to", "match_type", "value", "action", "suggested_response?" } ] }';
