-- Additive multilingual chunk-level shadow index for future unified RAG retrieval.
-- Safe rollout: table is write-only until retrieval is switched over.

create extension if not exists vector;

create table if not exists knowledge_chunks_i18n (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references merchants(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  lang varchar(16) not null,
  embedding_model varchar(128) not null default 'text-embedding-3-small',
  chunk_text text not null,
  embedding vector(1536) not null,
  chunk_index integer not null,
  section_type text,
  source_kind text,
  source_ref jsonb not null default '{}'::jsonb,
  content_hash varchar(128) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, product_id, lang, embedding_model, chunk_index, content_hash)
);

create index if not exists idx_knowledge_chunks_i18n_shop_id
  on knowledge_chunks_i18n(shop_id);

create index if not exists idx_knowledge_chunks_i18n_product_id
  on knowledge_chunks_i18n(product_id);

create index if not exists idx_knowledge_chunks_i18n_lang
  on knowledge_chunks_i18n(lang);

create index if not exists idx_knowledge_chunks_i18n_shop_lang
  on knowledge_chunks_i18n(shop_id, lang);

create index if not exists idx_knowledge_chunks_i18n_product_lang
  on knowledge_chunks_i18n(product_id, lang);

create index if not exists idx_knowledge_chunks_i18n_section_type
  on knowledge_chunks_i18n(section_type);

create index if not exists idx_knowledge_chunks_i18n_embedding_ivfflat
  on knowledge_chunks_i18n using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table knowledge_chunks_i18n enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'knowledge_chunks_i18n'
      and policyname = 'knowledge_chunks_i18n_service_only'
  ) then
    create policy knowledge_chunks_i18n_service_only
      on knowledge_chunks_i18n
      for all
      using (false)
      with check (false);
  end if;
end $$;
