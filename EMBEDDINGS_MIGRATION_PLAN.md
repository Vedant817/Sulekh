# Local Embeddings Migration Plan

## Decision

Replace the default Gemini embedding API with local ONNX inference using
`Xenova/bge-base-en-v1.5`, pinned to revision
`4d6cd88e18e51a5e020c2c305726d76ada9c03cf` and the quantized `q8` weights.
The model produces 768-dimensional, normalized vectors, so the existing
`vector(768)` Postgres schema remains valid.

Gemini remains an explicitly configurable fallback adapter. It is not the
default because a free remote API cannot guarantee the absence of request
quotas. Local inference has no per-request provider quota after the model
weights have been downloaded and cached, and corpus text does not leave the
application host for embedding.

## Alternatives considered

| Alternative | Free path | Rate-limit exposure | Schema impact | Decision |
| --- | --- | --- | --- | --- |
| Local BGE via Transformers.js | Local CPU inference | None for inference | None (768d) | Selected |
| Gemini embedding API | Provider free tier | Request/day and request/minute quotas | None | Optional fallback only |
| Hugging Face hosted inference | Provider free allowance | Shared hosted quota | None | Rejected for the default path |
| Local Ollama embedding service | Local CPU inference | None for inference | Model-dependent | Rejected: adds a separate runtime daemon |

## Implementation

1. Pin the model revision and execution variant in typed environment config.
2. Cache one feature-extraction pipeline per process and dispose it in finite
   scripts; use mean pooling, normalization, and the BGE retrieval-query prefix.
3. Record provider, model, vector-space signature, and timestamp with every
   stored vector.
4. Clear legacy unsigned vectors once through a migration. Never compare or
   retrieve vectors from different signatures.
5. Backfill corpus chunks in bounded inference batches and persist each batch
   atomically. A rerun selects only missing or signature-mismatched rows.
6. Replace the empty-built IVFFlat index with HNSW. HNSW has no training step,
   so it supports both fresh bootstraps and incremental backfills.
7. Make health and retrieval count only vectors belonging to the active
   signature.

## Verification gate

Task 1.2 closes only when all of the following pass against live services:

- all corpus chunks have a non-null, finite 768-dimensional vector;
- every vector has the active provider/model/signature provenance;
- an immediate backfill rerun performs no work;
- real pgvector retrieval returns relevant, citation-bearing passages;
- health reports the complete current-signature corpus;
- typecheck, lint, unit/integration tests, production build, and the full
  promoter-to-intermediary export journey pass.

The first run needs network access to download the pinned model weights. Local
runs use `.cache/transformers`; Vercel uses its writable
`/tmp/sulekh-transformers-cache` scratch space because the deployed application
filesystem is read-only. Other production hosts can set
`EMBEDDINGS_CACHE_DIR` to a persistent writable path to avoid a cold-download
dependency.

## Verification result — 2026-07-13

- Live corpus: 3,155/3,155 vectors; zero null, wrong-dimension,
  wrong-signature, or missing-provenance rows.
- Idempotence: immediate `pnpm embed:corpus` rerun reported no work.
- Retrieval: all four live integration tests passed; the capital-structure
  query returned eight cited passages and ranked the SME promoter-contribution
  and lock-in clause first.
- Runtime: `/api/health` returned HTTP 200 with database, corpus, and Groq green.
- Regression: typecheck, lint, production build, and 85/85 Vitest tests passed.
- Full story: Playwright passed 2/2 in 4.9 minutes through real upload,
  extraction, confirmation, 27-section grounded generation, gaps, intermediary
  review, approvals, and final DOCX/PDF/43-item coverage exports.
- Cleanup: the disposable Storage object, project graph, and both test users
  were removed.
