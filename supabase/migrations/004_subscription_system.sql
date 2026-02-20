-- Migration: Subscription System
-- Adds subscription and billing columns to merchants table
-- Supports Shopify Billing API and usage tracking

-- Add subscription columns to merchants table
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'starter', 'pro', 'enterprise')),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired', 'past_due')),
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255), -- Shopify subscription ID or Stripe subscription ID
ADD COLUMN IF NOT EXISTS billing_provider VARCHAR(50) DEFAULT 'shopify' CHECK (billing_provider IN ('shopify', 'stripe', 'manual')),
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);

-- Create subscription_plans table (reference data)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  features JSONB NOT NULL DEFAULT '{}'::jsonb, -- Plan features/limits
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO subscription_plans (id, name, description, price_monthly, price_yearly, currency, features) VALUES
('free', 'Free', 'Free tier with limited features', 0.00, 0.00, 'USD', '{
  "messages_per_month": 100,
  "api_calls_per_hour": 100,
  "products_limit": 10,
  "storage_gb": 1,
  "support_level": "community"
}'::jsonb),
('starter', 'Starter', 'Perfect for small stores', 29.00, 290.00, 'USD', '{
  "messages_per_month": 1000,
  "api_calls_per_hour": 500,
  "products_limit": 100,
  "storage_gb": 10,
  "support_level": "email"
}'::jsonb),
('pro', 'Pro', 'For growing businesses', 99.00, 990.00, 'USD', '{
  "messages_per_month": 10000,
  "api_calls_per_hour": 2000,
  "products_limit": 1000,
  "storage_gb": 100,
  "support_level": "priority"
}'::jsonb),
('enterprise', 'Enterprise', 'Custom solutions for large businesses', 0.00, 0.00, 'USD', '{
  "messages_per_month": -1,
  "api_calls_per_hour": -1,
  "products_limit": -1,
  "storage_gb": -1,
  "support_level": "dedicated"
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  messages_sent INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, period_start, period_end)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_usage_tracking_merchant_period ON usage_tracking(merchant_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_merchants_subscription_status ON merchants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_merchants_subscription_plan ON merchants(subscription_plan);

-- Add RLS policies for usage_tracking
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Merchants can view their own usage"
--   ON usage_tracking
--   FOR SELECT
--   USING (auth.uid() = merchant_id);

-- Add RLS policy for subscription_plans (public read)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Anyone can view active subscription plans"
--   ON subscription_plans
--   FOR SELECT
--   USING (is_active = true);

-- Function to get current usage for a merchant
CREATE OR REPLACE FUNCTION get_merchant_usage(merchant_uuid UUID, period_start_date TIMESTAMPTZ DEFAULT date_trunc('month', NOW()))
RETURNS TABLE (
  messages_sent INTEGER,
  api_calls INTEGER,
  storage_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(ut.messages_sent), 0)::INTEGER,
    COALESCE(SUM(ut.api_calls), 0)::INTEGER,
    COALESCE(SUM(ut.storage_bytes), 0)::BIGINT
  FROM usage_tracking ut
  WHERE ut.merchant_id = merchant_uuid
    AND ut.period_start >= period_start_date
    AND ut.period_end <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get plan limits for a merchant
CREATE OR REPLACE FUNCTION get_plan_limits(merchant_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  plan_id VARCHAR(50);
  plan_features JSONB;
BEGIN
  SELECT subscription_plan INTO plan_id FROM merchants WHERE id = merchant_uuid;
  SELECT features INTO plan_features FROM subscription_plans WHERE id = plan_id;
  RETURN plan_features;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update merchants updated_at trigger (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for subscription_plans
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for usage_tracking
DROP TRIGGER IF EXISTS update_usage_tracking_updated_at ON usage_tracking;
CREATE TRIGGER update_usage_tracking_updated_at
  BEFORE UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
