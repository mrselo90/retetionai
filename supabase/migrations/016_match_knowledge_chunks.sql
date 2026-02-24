-- Migration: match_knowledge_chunks RPC function
-- Uses pgvector HNSW index for fast cosine similarity search
-- Replaces the previous in-memory JS cosine similarity calculation

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
  product_url text
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
    p.url AS product_url
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
