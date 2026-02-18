-- ============================================================================
-- ReceteGuide Retention Agent - Complete Database Setup
-- Multi-tenant SaaS platform for post-purchase AI assistance
-- 
-- This file contains both schema and RLS policies.
-- Run this file ONCE in Supabase SQL Editor.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- pgvector for embeddings

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Merchants table (multi-tenant root)
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  api_keys JSONB DEFAULT '[]'::jsonb,
  webhook_secret TEXT,
  persona_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations table (platform connections)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'shopify', 'woocommerce', 'ticimax', 'manual'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'error', 'disabled'
  auth_type TEXT NOT NULL, -- 'oauth', 'api_key', 'token'
  auth_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Encrypted credentials
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, provider)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  external_id TEXT, -- External product ID from e-commerce platform
  name TEXT NOT NULL,
  url TEXT,
  raw_text TEXT, -- Scraped product content
  vector_id UUID, -- Reference to knowledge_chunks for vector search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (end-users/customers)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL, -- Encrypted phone number
  name TEXT,
  consent_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'opt_in', 'opt_out'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, phone)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_order_id TEXT NOT NULL, -- External order ID from e-commerce platform
  status TEXT NOT NULL, -- 'created', 'delivered', 'cancelled', 'returned'
  delivery_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, external_order_id)
);

-- ============================================================================
-- INTELLIGENCE TABLES
-- ============================================================================

-- Knowledge chunks (for RAG)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding vector(1536), -- OpenAI embedding dimension
  chunk_index INTEGER, -- Order of chunk in product
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  history JSONB DEFAULT '[]'::jsonb, -- Array of messages
  current_state TEXT, -- Conversation state/context
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'message_sent', 'message_received', 'interaction', etc.
  value JSONB DEFAULT '{}'::jsonb,
  sentiment_score NUMERIC(3, 2), -- 1.00 to 5.00
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync jobs table (for async operations)
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL, -- 'scrape', 'import', 'backfill', etc.
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- External events table (for idempotency)
CREATE TABLE IF NOT EXISTS external_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
  source TEXT NOT NULL, -- 'shopify', 'woocommerce', 'ticimax', 'manual'
  event_type TEXT NOT NULL, -- 'order_created', 'order_delivered', etc.
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(idempotency_key)
);

-- Scheduled tasks table
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL, -- 'welcome', 'checkin_t3', 'checkin_t14', 'upsell'
  execute_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Merchants
CREATE INDEX IF NOT EXISTS idx_merchants_created_at ON merchants(created_at);

-- Integrations
CREATE INDEX IF NOT EXISTS idx_integrations_merchant_id ON integrations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_external_id ON products(merchant_id, external_id);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_merchant_id ON users(merchant_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone); -- For lookup (encrypted)

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(merchant_id, external_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date) WHERE delivery_date IS NOT NULL;

-- Knowledge chunks
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_product_id ON knowledge_chunks(product_id);
-- Vector similarity search index (HNSW for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks 
  USING hnsw (embedding vector_cosine_ops);

-- Conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON conversations(order_id);

-- Analytics events
CREATE INDEX IF NOT EXISTS idx_analytics_events_merchant_id ON analytics_events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);

-- Sync jobs
CREATE INDEX IF NOT EXISTS idx_sync_jobs_merchant_id ON sync_jobs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);

-- External events
CREATE INDEX IF NOT EXISTS idx_external_events_merchant_id ON external_events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_external_events_idempotency_key ON external_events(idempotency_key);

-- Scheduled tasks
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_id ON scheduled_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_execute_at ON scheduled_tasks(execute_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status ON scheduled_tasks(status);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_merchants_updated_at ON merchants;
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integrations_updated_at ON integrations;
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Merchants are isolated by merchant_id" ON merchants;
DROP POLICY IF EXISTS "Integrations are isolated by merchant_id" ON integrations;
DROP POLICY IF EXISTS "Products are isolated by merchant_id" ON products;
DROP POLICY IF EXISTS "Users are isolated by merchant_id" ON users;
DROP POLICY IF EXISTS "Orders are isolated by merchant_id" ON orders;
DROP POLICY IF EXISTS "Knowledge chunks are isolated by merchant_id" ON knowledge_chunks;
DROP POLICY IF EXISTS "Conversations are isolated by merchant_id" ON conversations;
DROP POLICY IF EXISTS "Analytics events are isolated by merchant_id" ON analytics_events;
DROP POLICY IF EXISTS "Sync jobs are isolated by merchant_id" ON sync_jobs;
DROP POLICY IF EXISTS "External events are isolated by merchant_id" ON external_events;
DROP POLICY IF EXISTS "Scheduled tasks are isolated by merchant_id" ON scheduled_tasks;

-- Create RLS policies
CREATE POLICY "Merchants are isolated by merchant_id"
  ON merchants FOR ALL
  USING (auth.uid()::text = id::text);

CREATE POLICY "Integrations are isolated by merchant_id"
  ON integrations FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY "Products are isolated by merchant_id"
  ON products FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users are isolated by merchant_id"
  ON users FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY "Orders are isolated by merchant_id"
  ON orders FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY "Knowledge chunks are isolated by merchant_id"
  ON knowledge_chunks FOR ALL
  USING (
    product_id IN (
      SELECT id FROM products WHERE merchant_id IN (
        SELECT id FROM merchants WHERE id::text = auth.uid()::text
      )
    )
  );

CREATE POLICY "Conversations are isolated by merchant_id"
  ON conversations FOR ALL
  USING (
    user_id IN (
      SELECT id FROM users WHERE merchant_id IN (
        SELECT id FROM merchants WHERE id::text = auth.uid()::text
      )
    )
  );

CREATE POLICY "Analytics events are isolated by merchant_id"
  ON analytics_events FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY "Sync jobs are isolated by merchant_id"
  ON sync_jobs FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY "External events are isolated by merchant_id"
  ON external_events FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

CREATE POLICY "Scheduled tasks are isolated by merchant_id"
  ON scheduled_tasks FOR ALL
  USING (
    user_id IN (
      SELECT id FROM users WHERE merchant_id IN (
        SELECT id FROM merchants WHERE id::text = auth.uid()::text
      )
    )
  );

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ ReceteGuide database setup completed successfully!';
  RAISE NOTICE '📊 11 tables created with RLS policies';
  RAISE NOTICE '🔍 Vector search index ready for RAG';
END $$;
