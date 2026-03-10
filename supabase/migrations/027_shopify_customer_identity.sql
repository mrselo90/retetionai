-- Migration 027: Shopify customer identity fields for privacy compliance

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS shopify_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_merchant_email
  ON users(merchant_id, email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_merchant_shopify_customer_id
  ON users(merchant_id, shopify_customer_id)
  WHERE shopify_customer_id IS NOT NULL;
