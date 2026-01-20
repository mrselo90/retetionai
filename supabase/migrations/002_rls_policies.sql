-- Row Level Security (RLS) Policies
-- Ensures multi-tenant data isolation

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

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

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Merchants: Users can only see their own merchant record
CREATE POLICY "Merchants are isolated by merchant_id"
  ON merchants FOR ALL
  USING (auth.uid()::text = id::text); -- Assuming Supabase Auth UUID matches merchant ID

-- Integrations: Filter by merchant_id
CREATE POLICY "Integrations are isolated by merchant_id"
  ON integrations FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

-- Products: Filter by merchant_id
CREATE POLICY "Products are isolated by merchant_id"
  ON products FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

-- Users: Filter by merchant_id
CREATE POLICY "Users are isolated by merchant_id"
  ON users FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

-- Orders: Filter by merchant_id
CREATE POLICY "Orders are isolated by merchant_id"
  ON orders FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

-- Knowledge chunks: Filter by merchant_id through products
CREATE POLICY "Knowledge chunks are isolated by merchant_id"
  ON knowledge_chunks FOR ALL
  USING (
    product_id IN (
      SELECT id FROM products WHERE merchant_id IN (
        SELECT id FROM merchants WHERE id::text = auth.uid()::text
      )
    )
  );

-- Conversations: Filter by merchant_id through users
CREATE POLICY "Conversations are isolated by merchant_id"
  ON conversations FOR ALL
  USING (
    user_id IN (
      SELECT id FROM users WHERE merchant_id IN (
        SELECT id FROM merchants WHERE id::text = auth.uid()::text
      )
    )
  );

-- Analytics events: Filter by merchant_id
CREATE POLICY "Analytics events are isolated by merchant_id"
  ON analytics_events FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

-- Sync jobs: Filter by merchant_id
CREATE POLICY "Sync jobs are isolated by merchant_id"
  ON sync_jobs FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

-- External events: Filter by merchant_id
CREATE POLICY "External events are isolated by merchant_id"
  ON external_events FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

-- Scheduled tasks: Filter by merchant_id through users
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
-- NOTE: Service Role Bypass
-- ============================================================================
-- When using service role key (getSupabaseServiceClient), RLS policies are bypassed.
-- Always use service role client in server-side code with proper merchant_id filtering
-- in application logic: WHERE merchant_id = X
