-- Denormalise merchant_id onto knowledge_chunks.
--
-- The tenant predicate lived on products and was reached through a join:
--   FROM knowledge_chunks kc INNER JOIN products p ON p.id = kc.product_id
--   WHERE p.merchant_id = match_merchant_id
-- so the filter that matters most for correctness and selectivity sat in a
-- different table from the vector column. Postgres had to walk the ANN index
-- and then post-filter through the join, which for a small merchant inside a
-- large global corpus returns fewer rows than match_count — silently reducing
-- recall, since an empty result is indistinguishable from "no knowledge".
--
-- To be accurate about the benefit: HNSW still does not pre-filter, so this is
-- not a magic fix. What it buys is a cheaper plan (no join needed to decide
-- tenancy), a usable composite index for the non-vector paths, and a filter on
-- the same relation as the vector so pgvector iterative scan can apply it.

alter table knowledge_chunks
  add column if not exists merchant_id uuid references merchants(id) on delete cascade;

comment on column knowledge_chunks.merchant_id is
  'Denormalised from products.merchant_id. Populated by trigger; do not set manually.';

-- Backfill existing rows from their product.
update knowledge_chunks kc
set merchant_id = p.merchant_id
from products p
where p.id = kc.product_id
  and kc.merchant_id is distinct from p.merchant_id;

-- Populate on write via trigger rather than in application code: there are two
-- forks of processProductForRAG (api and workers) and merchantId is optional in
-- both signatures, so a trigger is the only place this can be guaranteed.
create or replace function set_knowledge_chunk_merchant_id()
returns trigger
language plpgsql
as $$
begin
  if new.merchant_id is null then
    select p.merchant_id into new.merchant_id
    from products p
    where p.id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_knowledge_chunks_merchant_id on knowledge_chunks;
create trigger trg_knowledge_chunks_merchant_id
  before insert or update of product_id on knowledge_chunks
  for each row
  execute function set_knowledge_chunk_merchant_id();

create index if not exists idx_knowledge_chunks_merchant_product
  on knowledge_chunks (merchant_id, product_id);

-- Filter on kc.merchant_id instead of p.merchant_id. The join to products is
-- kept only to return the product name and URL, which the callers rely on.
create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_merchant_id uuid,
  match_product_ids uuid[] default null,
  match_threshold float default 0.6,
  match_count int default 5
)
returns table (
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
language plpgsql
stable
as $$
begin
  return query
  select
    kc.id,
    kc.product_id,
    kc.chunk_text,
    kc.chunk_index,
    (1 - (kc.embedding <=> query_embedding))::float as similarity,
    p.name as product_name,
    p.url as product_url,
    kc.section_type,
    kc.language_code
  from knowledge_chunks kc
  left join products p on p.id = kc.product_id
  where kc.merchant_id = match_merchant_id
    and kc.embedding is not null
    and (match_product_ids is null or kc.product_id = any(match_product_ids))
    and (1 - (kc.embedding <=> query_embedding)) >= match_threshold
  order by kc.embedding <=> query_embedding asc
  limit match_count;
end;
$$;
