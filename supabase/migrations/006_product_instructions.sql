-- Migration: Product Instructions (Shopify Perfect Match)
-- Stores "Cosmetic Recipe & Usage Instructions" per product for T+0 beauty consultant flow.
-- Product is linked via products.id (products.external_id = Shopify product ID when synced).

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

-- Indexes for worker lookups: by merchant + product_id, and by merchant for list
CREATE INDEX IF NOT EXISTS idx_product_instructions_merchant_id ON product_instructions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_product_instructions_product_id ON product_instructions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_instructions_merchant_product ON product_instructions(merchant_id, product_id);

-- Updated_at trigger
CREATE TRIGGER update_product_instructions_updated_at
  BEFORE UPDATE ON product_instructions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: service role used by API; policies for consistency with other tables
ALTER TABLE product_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product instructions are isolated by merchant_id"
  ON product_instructions FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE id::text = auth.uid()::text
    )
  );
