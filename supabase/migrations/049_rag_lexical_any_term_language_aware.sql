-- Keyword retrieval that matches real customer questions.
--
-- match_knowledge_chunks_i18n_lexical (044) built its query with
-- websearch_to_tsquery('simple', question), which ANDs every word: "Bu ürünü
-- nasıl kullanmalıyım?" only matched a chunk containing all of bu, ürünü, nasıl
-- and kullanmalıyım. On production chunks every natural question matched zero
-- chunks; only single-word queries ("niasinamid") worked. And 'simple' does no
-- stemming, so "kullanmalıyım" never meets "kullanın" either. (044 says Postgres
-- ships no Turkish stemmer; it does, as do Hungarian, English, German, Greek.)
--
-- Now the question is reduced to stemmed, stop-word-free lexemes in the chunk's
-- own language, and a chunk matches when it contains ANY of them; ts_rank orders
-- chunks with more and rarer matches first. Fusion with the dense results is by
-- rank (unifiedRetrieval.ts), so the broader match set only adds candidates.
-- Same function signature: the app needs no change for this part.
-- Measured by packages/api/evals/retrieval (pnpm --filter @recete/api eval:retrieval).

create or replace function public.rag_text_search_config(p_language_code text)
returns regconfig
language sql
immutable
parallel safe
as $$
  select case lower(coalesce(p_language_code, ''))
    when 'tr' then 'turkish'::regconfig
    when 'en' then 'english'::regconfig
    when 'hu' then 'hungarian'::regconfig
    when 'de' then 'german'::regconfig
    when 'el' then 'greek'::regconfig
    else 'simple'::regconfig
  end
$$;

-- Each chunk is indexed in its own language's configuration.
alter table public.knowledge_chunks_i18n
  add column if not exists lexical_tsv tsvector
  generated always as (
    to_tsvector(public.rag_text_search_config(language_code::text), coalesce(chunk_text, ''))
  ) stored;

create index if not exists idx_knowledge_chunks_i18n_lexical_tsv
  on public.knowledge_chunks_i18n using gin (lexical_tsv);

-- The 'simple' index from 044 served only the old function.
drop index if exists idx_knowledge_chunks_i18n_fts;

create or replace function public.match_knowledge_chunks_i18n_lexical(
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
  cfg regconfig := public.rag_text_search_config(p_language_code);
  term text;
  ts_query tsquery;
begin
  -- The question's lexemes in the chunks' language: stemmed, stop words gone.
  -- plainto_tsquery('simple', lexeme) quotes nothing and never raises, and the
  -- lexemes are already normalised, so 'simple' leaves them as they are.
  for term in
    select distinct t.lexeme
    from unnest(to_tsvector(cfg, coalesce(p_query, ''))) as t(lexeme, positions, weights)
  loop
    ts_query := case
      when ts_query is null then plainto_tsquery('simple', term)
      else ts_query || plainto_tsquery('simple', term)
    end;
  end loop;

  if ts_query is null or numnode(ts_query) = 0 then
    return;
  end if;

  -- Text columns are cast explicitly: knowledge_chunks_i18n declares several as
  -- varchar, which PL/pgSQL rejects for a RETURNS TABLE text column.
  return query
  select
    kc.id,
    kc.product_id,
    kc.chunk_text::text,
    kc.chunk_index::int,
    kc.chunk_type::text,
    kc.section_type::text,
    kc.language_code::text,
    ts_rank(kc.lexical_tsv, ts_query)::float as lex_rank
  from public.knowledge_chunks_i18n kc
  where kc.shop_id = p_shop_id
    and kc.language_code = p_language_code
    and (p_embedding_model is null or kc.embedding_model = p_embedding_model)
    and (p_product_ids is null or kc.product_id = any(p_product_ids))
    and kc.lexical_tsv @@ ts_query
  order by lex_rank desc
  limit p_match_count;
end;
$$;

comment on function public.match_knowledge_chunks_i18n_lexical is
  'Keyword retrieval over multilingual chunks: any question term, stemmed in the chunk language. Fused with dense results via reciprocal rank fusion in unifiedRetrieval.ts.';
