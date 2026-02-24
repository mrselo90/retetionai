-- Multi-language RAG (Option A: per-language filtered index) - additive only
-- Safe rollout: feature-flagged and shadow mode compatible

create extension if not exists vector;

-- 4.1 shop_settings
create table if not exists shop_settings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references merchants(id) on delete cascade,
  default_source_lang varchar(16) not null default 'en',
  enabled_langs jsonb not null default '["en"]'::jsonb,
  multi_lang_rag_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id)
);

create index if not exists idx_shop_settings_shop_id on shop_settings(shop_id);

-- 4.2 product_i18n
create table if not exists product_i18n (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references merchants(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  lang varchar(16) not null,
  title text,
  description_html text,
  specs_json jsonb not null default '{}'::jsonb,
  faq_json jsonb not null default '[]'::jsonb,
  source_lang varchar(16),
  source_hash varchar(128),
  translated_at timestamptz,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, product_id, lang)
);

create index if not exists idx_product_i18n_shop_id on product_i18n(shop_id);
create index if not exists idx_product_i18n_product_id on product_i18n(product_id);
create index if not exists idx_product_i18n_lang on product_i18n(lang);
create index if not exists idx_product_i18n_shop_lang on product_i18n(shop_id, lang);

-- 4.3 product_embeddings
-- Embedding dimension is fixed to 1536 for text-embedding-3-small in current rollout.
create table if not exists product_embeddings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references merchants(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  lang varchar(16) not null,
  embedding_model varchar(128) not null,
  content_hash varchar(128) not null,
  embedding vector(1536) not null,
  indexed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, product_id, lang, embedding_model)
);

create index if not exists idx_product_embeddings_shop_id on product_embeddings(shop_id);
create index if not exists idx_product_embeddings_product_id on product_embeddings(product_id);
create index if not exists idx_product_embeddings_lang on product_embeddings(lang);
create index if not exists idx_product_embeddings_shop_lang on product_embeddings(shop_id, lang);

-- pgvector ANN index (cosine) - filtered by (shop_id, lang) in query
create index if not exists idx_product_embeddings_embedding_ivfflat
  on product_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Optional: enable RLS (service role bypasses; policies can be expanded later)
alter table shop_settings enable row level security;
alter table product_i18n enable row level security;
alter table product_embeddings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'shop_settings' and policyname = 'shop_settings_service_only'
  ) then
    create policy shop_settings_service_only on shop_settings for all using (false) with check (false);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'product_i18n' and policyname = 'product_i18n_service_only'
  ) then
    create policy product_i18n_service_only on product_i18n for all using (false) with check (false);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'product_embeddings' and policyname = 'product_embeddings_service_only'
  ) then
    create policy product_embeddings_service_only on product_embeddings for all using (false) with check (false);
  end if;
end $$;

-- 7) Supabase vector search function (lang-filtered)
create or replace function match_product_embeddings_by_lang(
  p_shop_id uuid,
  p_lang text,
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table (
  product_id uuid,
  lang text,
  distance double precision,
  similarity double precision
)
language sql
stable
as $$
  select
    pe.product_id,
    pe.lang,
    (pe.embedding <=> p_query_embedding) as distance,
    (1 - (pe.embedding <=> p_query_embedding)) as similarity
  from product_embeddings pe
  where pe.shop_id = p_shop_id
    and pe.lang = p_lang
  order by pe.embedding <=> p_query_embedding
  limit greatest(1, coalesce(p_match_count, 8));
$$;

