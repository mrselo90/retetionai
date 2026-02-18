-- Return Prevention Module
-- Migration 011: Add-on billing system, product prevention content, attempt tracking
-- Created: 2026-02-18

-- ============================================================================
-- MERCHANT ADD-ONS TABLE (generic, reusable for future modules)
-- ============================================================================

CREATE TABLE IF NOT EXISTS merchant_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  addon_key VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive','active','cancelled','past_due')),
  billing_charge_id VARCHAR(255),
  price_monthly DECIMAL(10,2) NOT NULL,
  activated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, addon_key)
);

CREATE INDEX IF NOT EXISTS idx_merchant_addons_merchant
  ON merchant_addons(merchant_id);

CREATE INDEX IF NOT EXISTS idx_merchant_addons_key_status
  ON merchant_addons(addon_key, status)
  WHERE status = 'active';

ALTER TABLE merchant_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_addons_isolation" ON merchant_addons
  FOR ALL USING (merchant_id = merchant_id);

-- ============================================================================
-- EXTEND PRODUCT_INSTRUCTIONS WITH PREVENTION CONTENT
-- ============================================================================

ALTER TABLE product_instructions
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS prevention_tips TEXT;

-- ============================================================================
-- RETURN PREVENTION ATTEMPTS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS return_prevention_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  trigger_message TEXT NOT NULL,
  prevention_response TEXT NOT NULL,
  outcome VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending','prevented','returned','escalated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpa_merchant_created
  ON return_prevention_attempts(merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rpa_conversation
  ON return_prevention_attempts(conversation_id);

CREATE INDEX IF NOT EXISTS idx_rpa_outcome
  ON return_prevention_attempts(merchant_id, outcome)
  WHERE outcome = 'prevented';

ALTER TABLE return_prevention_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rpa_isolation" ON return_prevention_attempts
  FOR ALL USING (merchant_id = merchant_id);
