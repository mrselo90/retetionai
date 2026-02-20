-- Product data enrichment: ensure products table has the correct columns
-- Run this in Supabase SQL Editor if your DB was created before migration 013 or if enriched_text is missing.
--
-- The application uses:
--   raw_text     – scraped product content (from 001_initial_schema)
--   enriched_text – LLM-enriched text for RAG (from 013_product_enriched_text)

-- 1. Ensure raw_text exists (it should from initial schema)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS raw_text text;

COMMENT ON COLUMN public.products.raw_text IS 'Scraped product content (plain text)';

-- 2. Ensure enriched_text exists for product data enrichment
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS enriched_text text;

COMMENT ON COLUMN public.products.enriched_text IS 'LLM-enriched product description optimized for RAG embeddings';

-- Optional: list products that have content for RAG (no rows = add products and run scrape + embeddings)
-- SELECT id, name, (raw_text IS NOT NULL AND length(raw_text) > 0) AS has_raw, (enriched_text IS NOT NULL AND length(enriched_text) > 0) AS has_enriched FROM public.products LIMIT 20;
