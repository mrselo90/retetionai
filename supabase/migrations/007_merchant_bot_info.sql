-- Migration: Merchant Bot Info (AI bot guidelines, brand, recipes overview)
-- Table for merchant-editable content injected into AI system prompt and RAG context.

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

CREATE TRIGGER update_merchant_bot_info_updated_at
  BEFORE UPDATE ON merchant_bot_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE merchant_bot_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant bot info is isolated by merchant_id"
  ON merchant_bot_info FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );

-- Default keys (optional): brand_guidelines, bot_boundaries, recipe_overview, custom_instructions
-- Merchants can add any key via API.
