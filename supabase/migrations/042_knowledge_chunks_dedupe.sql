-- Stop duplicate knowledge chunks from accumulating on every re-index.
--
-- processProductForRAG inserted the new chunk set and then deleted rows whose
-- chunk_hash was NOT IN the new hashes. When content had not changed the new
-- hashes equalled the old ones, so the delete matched nothing and the freshly
-- inserted identical rows survived alongside the originals. Every rescrape
-- therefore multiplied the chunk count for that product, and retrieval spent
-- its whole topK budget (3-5) on copies of the same text.
--
-- Confirmed in production before this migration: product e054f89f held two
-- chunk_hash values duplicated 3x each, with chunk_index 0 and 1 each appearing
-- three times, so document order was also non-deterministic.

-- 1. Collapse existing duplicates, keeping the earliest row per (product, hash).
delete from knowledge_chunks
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by product_id, chunk_hash
        order by created_at asc, id asc
      ) as rn
    from knowledge_chunks
    where chunk_hash is not null
  ) ranked
  where ranked.rn > 1
);

-- 2. Enforce the invariant in the database so application logic cannot
--    reintroduce duplicates. Left as a plain (non-partial) unique index so it
--    is usable as an ON CONFLICT target for upserts; Postgres treats NULLs as
--    distinct, so any pre-018 rows with a NULL chunk_hash are unaffected.
create unique index if not exists uq_knowledge_chunks_product_chunk_hash
  on knowledge_chunks (product_id, chunk_hash);

comment on index uq_knowledge_chunks_product_chunk_hash is
  'Makes re-indexing idempotent: processProductForRAG upserts on (product_id, chunk_hash).';
