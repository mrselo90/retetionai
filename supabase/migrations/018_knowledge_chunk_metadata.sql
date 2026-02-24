-- Add metadata columns to knowledge_chunks for better multilingual / section-aware retrieval

ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS section_type text,
  ADD COLUMN IF NOT EXISTS language_code text,
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS chunk_hash text;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_section_type
  ON public.knowledge_chunks(section_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_language_code
  ON public.knowledge_chunks(language_code);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_product_section
  ON public.knowledge_chunks(product_id, section_type);

COMMENT ON COLUMN public.knowledge_chunks.section_type IS 'Semantic section label (usage, ingredients, warnings, specs, general, etc.)';
COMMENT ON COLUMN public.knowledge_chunks.language_code IS 'Language code of chunk text (tr, en, hu) when known';
COMMENT ON COLUMN public.knowledge_chunks.source_kind IS 'raw_text | enriched_text';
COMMENT ON COLUMN public.knowledge_chunks.chunk_hash IS 'Deterministic hash of chunk content (for trace/debug)';

-- Recreate RPC with metadata fields in the return payload
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_merchant_id uuid,
  match_product_ids uuid[] DEFAULT NULL,
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  chunk_text text,
  chunk_index int,
  similarity float,
  product_name text,
  product_url text,
  section_type text,
  language_code text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.product_id,
    kc.chunk_text,
    kc.chunk_index,
    (1 - (kc.embedding <=> query_embedding))::float AS similarity,
    p.name AS product_name,
    p.url AS product_url,
    kc.section_type,
    kc.language_code
  FROM knowledge_chunks kc
  INNER JOIN products p ON p.id = kc.product_id
  WHERE p.merchant_id = match_merchant_id
    AND kc.embedding IS NOT NULL
    AND (match_product_ids IS NULL OR kc.product_id = ANY(match_product_ids))
    AND (1 - (kc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY kc.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

