# Manual Database Migration Guide

We detected that your database is missing some required tables and columns for the Billing and Subscription system. This is causing the "Plan limits not found" error.

Please follow these steps to apply the missing schema changes:

1. **Log in to your Supabase Dashboard** at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Select your project (`clcqmasqkfdcmznwdrbx` or similar).
3. Go to the **SQL Editor** (icon on the left sidebar).
4. Click **New Query**.
5. **Copy and paste** the entire SQL block below into the editor.
6. Click **Run** (bottom right).

---

## SQL Script to Run

```sql
-- Migration: Subscription System (004)
-- Adds subscription and billing columns to merchants table
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'starter', 'pro', 'enterprise')),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired', 'past_due')),
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS billing_provider VARCHAR(50) DEFAULT 'shopify' CHECK (billing_provider IN ('shopify', 'stripe', 'manual')),
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
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

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'usage_tracking' AND policyname = 'Merchants can view their own usage'
    ) THEN
        CREATE POLICY "Merchants can view their own usage" ON usage_tracking FOR SELECT USING (auth.uid() = merchant_id);
    END IF;
END $$;

-- Add RLS policy for subscription_plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'subscription_plans' AND policyname = 'Anyone can view active subscription plans'
    ) THEN
        CREATE POLICY "Anyone can view active subscription plans" ON subscription_plans FOR SELECT USING (is_active = true);
    END IF;
END $$;

-- Update merchants updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_tracking_updated_at ON usage_tracking;
CREATE TRIGGER update_usage_tracking_updated_at BEFORE UPDATE ON usage_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Migration: Performance Indexes (005)
CREATE INDEX IF NOT EXISTS idx_merchants_api_keys_gin ON merchants USING GIN (api_keys);
CREATE INDEX IF NOT EXISTS idx_merchants_subscription_plan_status ON merchants(subscription_plan, subscription_status);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_status ON orders(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date) WHERE delivery_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON conversations(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_product_id ON knowledge_chunks(product_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_product_embedding ON knowledge_chunks(product_id) WHERE embedding IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_events_merchant_idempotency ON external_events(merchant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_external_events_received_at ON external_events(received_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_execute_at_status ON scheduled_tasks(execute_at, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_status ON scheduled_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_merchant_period_composite ON usage_tracking(merchant_id, period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_products_merchant_updated ON products(merchant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_integrations_merchant_provider_status ON integrations(merchant_id, provider, status);
CREATE INDEX IF NOT EXISTS idx_analytics_events_merchant_timestamp ON analytics_events(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_merchant_consent ON users(merchant_id, consent_status);
CREATE INDEX IF NOT EXISTS idx_merchants_active_subscription ON merchants(id) WHERE subscription_status IN ('active', 'trial');
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_pending_execute ON scheduled_tasks(execute_at) WHERE status = 'pending';


-- Migration: Product Instructions (006)
CREATE TABLE IF NOT EXISTS product_instructions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  usage_instructions TEXT NOT NULL DEFAULT '',
  recipe_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_instructions_merchant_id ON product_instructions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_product_instructions_product_id ON product_instructions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_instructions_merchant_product ON product_instructions(merchant_id, product_id);

DROP TRIGGER IF EXISTS update_product_instructions_updated_at ON product_instructions;
CREATE TRIGGER update_product_instructions_updated_at BEFORE UPDATE ON product_instructions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE product_instructions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'product_instructions' AND policyname = 'Product instructions are isolated by merchant_id'
    ) THEN
        CREATE POLICY "Product instructions are isolated by merchant_id" ON product_instructions FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE id::text = auth.uid()::text));
    END IF;
END $$;


-- Migration: Merchant Bot Info (007)
CREATE TABLE IF NOT EXISTS merchant_bot_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_merchant_bot_info_merchant_id ON merchant_bot_info(merchant_id);

DROP TRIGGER IF EXISTS update_merchant_bot_info_updated_at ON merchant_bot_info;
CREATE TRIGGER update_merchant_bot_info_updated_at BEFORE UPDATE ON merchant_bot_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE merchant_bot_info ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'merchant_bot_info' AND policyname = 'Merchant bot info is isolated by merchant_id'
    ) THEN
        CREATE POLICY "Merchant bot info is isolated by merchant_id" ON merchant_bot_info FOR ALL USING (merchant_id IN (SELECT id FROM merchants WHERE id::text = auth.uid()::text));
    END IF;
END $$;
```
