-- Add a lexical retrieval channel alongside dense vector search.
--
-- Retrieval was pure cosine similarity with no keyword path anywhere (verified:
-- no tsvector, to_tsquery, pg_trgm or bm25 usage in the repo). text-embedding-3
-- models are weak on rare proper nouns, which for a cosmetics assistant is
-- exactly the question distribution that matters: "içinde bakuchiol var mı?",
-- "niacinamide %10 mu?", "Effaclar Duo+ mı Effaclar H mi?". Those need exact
-- term recall, and dense retrieval is the wrong tool for it.
--
-- The 'simple' text search configuration is deliberate. Content is Turkish,
-- Hungarian and English in one table, Postgres ships no Turkish stemmer, and
-- stemming actively harms INCI tokens ("Sodium Hyaluronate" must not be
-- stemmed). 'simple' lowercases and splits on word boundaries, which is what
-- ingredient and brand matching wants.

create index if not exists idx_knowledge_chunks_i18n_fts
  on knowledge_chunks_i18n
  using gin (to_tsvector('simple', coalesce(chunk_text, '')));

create index if not exists idx_knowledge_chunks_fts
  on knowledge_chunks
  using gin (to_tsvector('simple', coalesce(chunk_text, '')));

-- Lexical counterpart to match_knowledge_chunks_i18n. Returns the same shape so
-- the caller can fuse the two result sets, plus lex_rank for the fusion.
create or replace function match_knowledge_chunks_i18n_lexical(
  p_shop_id uuid,
  p_language_code text,
  p_query text,
  p_product_ids uuid[] default null,
  p_match_count int default 10,
  p_embedding_model text default null
)
returns table (
  id uuid,
  product_id uuid,
  chunk_text text,
  chunk_index int,
  chunk_type text,
  section_type text,
  language_code text,
  lex_rank float
)
language plpgsql
stable
as $$
declare
  ts_query tsquery;
begin
  -- websearch_to_tsquery tolerates arbitrary user input without raising, which
  -- plainto_tsquery/to_tsquery do not for punctuation-heavy questions.
  ts_query := websearch_to_tsquery('simple', coalesce(p_query, ''));

  if ts_query is null or numnode(ts_query) = 0 then
    return;
  end if;

  -- Every text column is cast explicitly. knowledge_chunks_i18n declares
  -- language_code (and other metadata) as varchar, and PL/pgSQL rejects a
  -- varchar(16) value for a column the RETURNS TABLE declares as text with
  -- "structure of query does not match function result type".
  return query
  select
    kc.id,
    kc.product_id,
    kc.chunk_text::text,
    kc.chunk_index::int,
    kc.chunk_type::text,
    kc.section_type::text,
    kc.language_code::text,
    ts_rank(to_tsvector('simple', coalesce(kc.chunk_text, '')), ts_query)::float as lex_rank
  from knowledge_chunks_i18n kc
  where kc.shop_id = p_shop_id
    and kc.language_code = p_language_code
    and (p_embedding_model is null or kc.embedding_model = p_embedding_model)
    and (p_product_ids is null or kc.product_id = any(p_product_ids))
    and to_tsvector('simple', coalesce(kc.chunk_text, '')) @@ ts_query
  order by lex_rank desc
  limit p_match_count;
end;
$$;

comment on function match_knowledge_chunks_i18n_lexical is
  'Keyword retrieval over multilingual chunks. Fused with dense results via reciprocal rank fusion in unifiedRetrieval.';
