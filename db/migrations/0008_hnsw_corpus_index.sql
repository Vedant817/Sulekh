-- 0008 — use an incrementally maintainable ANN index for corpus retrieval.
--
-- Migration 0002 created IVFFlat before corpus embeddings existed. IVFFlat
-- requires a populated table for its training step; an empty-build index can
-- return no candidates after vectors are added. HNSW has no training step and
-- remains valid whether this migration runs before or after corpus backfill.

drop index if exists public.idx_corpus_chunks_embedding;

create index idx_corpus_chunks_embedding
  on public.corpus_chunks using hnsw (embedding vector_cosine_ops);

analyze public.corpus_chunks;
