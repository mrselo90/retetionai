-- Migration: Performance Indexes
-- Adds missing indexes for query optimization

-- Merchants: GIN index for JSONB api_keys array searches
CREATE INDEX IF NOT EXISTS idx_merchants_api_keys_gin ON merchants USING GIN (api_keys);

-- Merchants: Index for subscription queries
CREATE INDEX IF NOT EXISTS idx_merchants_subscription_plan_status ON merchants(subscription_plan, subscription_status);

-- Orders: Composite index for merchant and status queries
CREATE INDEX IF NOT EXISTS idx_orders_merchant_status ON orders(merchant_id, status);

-- Orders: Index for delivery date queries (for scheduled messages)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date) WHERE delivery_date IS NOT NULL;

-- Orders: Index for user and status
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);

-- Conversations: Index for user and updated_at (for recent conversations)
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);

-- Conversations: Index for order_id lookups
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON conversations(order_id) WHERE order_id IS NOT NULL;

-- Knowledge chunks: Index for product_id (for RAG queries)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_product_id ON knowledge_chunks(product_id);

-- Knowledge chunks: Index for embedding similarity searches (vector index already exists, but add product_id composite)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_product_embedding ON knowledge_chunks(product_id) WHERE embedding IS NOT NULL;

-- External events: Index for idempotency key (already unique, but add for faster lookups)
-- Note: idempotency_key already has UNIQUE constraint, but adding index for merchant_id + idempotency_key
CREATE INDEX IF NOT EXISTS idx_external_events_merchant_idempotency ON external_events(merchant_id, idempotency_key);

-- External events: Index for received_at (for cleanup queries)
CREATE INDEX IF NOT EXISTS idx_external_events_received_at ON external_events(received_at);

-- Scheduled tasks: Index for execute_at (for job scheduling)
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_execute_at_status ON scheduled_tasks(execute_at, status) WHERE status = 'pending';

-- Scheduled tasks: Index for user_id and status
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_status ON scheduled_tasks(user_id, status);

-- Usage tracking: Index already exists, but add composite for merchant + period
CREATE INDEX IF NOT EXISTS idx_usage_tracking_merchant_period_composite ON usage_tracking(merchant_id, period_start DESC, period_end DESC);

-- Products: Index for merchant and external_id (already exists, but verify)
-- Products: Index for updated_at (for recent products)
CREATE INDEX IF NOT EXISTS idx_products_merchant_updated ON products(merchant_id, updated_at DESC);

-- Integrations: Index for merchant and provider status
CREATE INDEX IF NOT EXISTS idx_integrations_merchant_provider_status ON integrations(merchant_id, provider, status);

-- Analytics events: Index for merchant and timestamp
CREATE INDEX IF NOT EXISTS idx_analytics_events_merchant_timestamp ON analytics_events(merchant_id, timestamp DESC);

-- Users: Index for merchant and phone (already unique, but add for faster lookups)
-- Users: Index for consent_status queries
CREATE INDEX IF NOT EXISTS idx_users_merchant_consent ON users(merchant_id, consent_status);

-- Add partial index for active subscriptions
CREATE INDEX IF NOT EXISTS idx_merchants_active_subscription ON merchants(id) 
WHERE subscription_status IN ('active', 'trial');

-- Add partial index for pending scheduled tasks
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_pending_execute ON scheduled_tasks(execute_at) 
WHERE status = 'pending' AND execute_at <= NOW() + INTERVAL '1 hour';
