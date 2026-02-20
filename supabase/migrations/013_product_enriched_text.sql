-- Add enriched_text column to products table
-- This column will store the LLM-enriched version of the raw scraped text, optimized for vector embeddings

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS enriched_text text;

-- Add a comment to describe the column
COMMENT ON COLUMN public.products.enriched_text IS 'LLM-enriched product description optimized for RAG embeddings';
