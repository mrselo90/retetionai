-- Reference: Product enrichment columns
-- Applied in migration 013_product_enriched_text.sql
-- This file is for documentation only; do not run directly.

-- products.enriched_text: LLM-enriched product description optimized for RAG embeddings
-- ALTER TABLE public.products ADD COLUMN IF NOT EXISTS enriched_text text;
-- COMMENT ON COLUMN public.products.enriched_text IS 'LLM-enriched product description optimized for RAG embeddings';
