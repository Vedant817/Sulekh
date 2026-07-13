-- 0007 — track the vector space used for every corpus embedding.
-- Vectors from different models are not comparable. Existing pre-provenance
-- Gemini vectors are cleared deliberately so the configured provider can
-- repopulate one consistent vector space.

alter table public.corpus_chunks
  add column if not exists embedding_provider text,
  add column if not exists embedding_model text,
  add column if not exists embedding_signature text,
  add column if not exists embedded_at timestamptz;

update public.corpus_chunks
set embedding = null,
    embedding_provider = null,
    embedding_model = null,
    embedding_signature = null,
    embedded_at = null
where embedding is not null
  and embedding_signature is null;

create index if not exists idx_corpus_chunks_embedding_signature
  on public.corpus_chunks (embedding_signature)
  where embedding is not null;
