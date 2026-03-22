-- Prepare multilingual chunk shadow index for unified retrieval.
-- Additive only: extends the shadow table and adds a read RPC without removing old structures.

alter table public.knowledge_chunks_i18n
  add column if not exists language_code varchar(16),
  add column if not exists chunk_type text,
  add column if not exists source_type text,
  add column if not exists content_version integer not null default 1,
  add column if not exists indexed_at timestamptz not null default now();

update public.knowledge_chunks_i18n
set
  language_code = coalesce(language_code, lang),
  chunk_type = coalesce(chunk_type, section_type),
  source_type = coalesce(source_type, source_kind),
  indexed_at = coalesce(indexed_at, created_at, now())
where language_code is null
   or chunk_type is null
   or source_type is null
   or indexed_at is null;

alter table public.knowledge_chunks_i18n
  alter column language_code set not null,
  alter column source_type set not null;

create index if not exists idx_knowledge_chunks_i18n_shop_product_lang
  on public.knowledge_chunks_i18n(shop_id, product_id, language_code);

create index if not exists idx_knowledge_chunks_i18n_shop_lang_chunk_type
  on public.knowledge_chunks_i18n(shop_id, language_code, chunk_type);

create index if not exists idx_knowledge_chunks_i18n_shop_lang_source_type
  on public.knowledge_chunks_i18n(shop_id, language_code, source_type);

create index if not exists idx_knowledge_chunks_i18n_content_hash
  on public.knowledge_chunks_i18n(content_hash);

create or replace function public.match_knowledge_chunks_i18n(
  p_shop_id uuid,
  p_language_code text,
  p_query_embedding vector(1536),
  p_product_ids uuid[] default null,
  p_chunk_types text[] default null,
  p_source_types text[] default null,
  p_match_threshold float default 0.6,
  p_match_count int default 8,
  p_embedding_model text default null
)
returns table (
  id uuid,
  product_id uuid,
  language_code text,
  chunk_text text,
  chunk_index int,
  chunk_type text,
  section_type text,
  source_type text,
  source_kind text,
  content_hash text,
  similarity float
)
language sql
stable
as $$
  select
    kc.id,
    kc.product_id,
    kc.language_code::text,
    kc.chunk_text,
    kc.chunk_index,
    kc.chunk_type,
    kc.section_type,
    kc.source_type,
    kc.source_kind,
    kc.content_hash,
    (1 - (kc.embedding <=> p_query_embedding))::float as similarity
  from public.knowledge_chunks_i18n kc
  where kc.shop_id = p_shop_id
    and kc.language_code = p_language_code
    and (p_product_ids is null or kc.product_id = any(p_product_ids))
    and (p_chunk_types is null or kc.chunk_type = any(p_chunk_types))
    and (p_source_types is null or kc.source_type = any(p_source_types))
    and (p_embedding_model is null or kc.embedding_model = p_embedding_model)
    and (1 - (kc.embedding <=> p_query_embedding)) >= p_match_threshold
  order by kc.embedding <=> p_query_embedding asc
  limit greatest(1, coalesce(p_match_count, 8));
$$;
