# Intake UX plan — TASKS.md 2.7

## Problem

The Phase 2 journey made the promoter move from the project page to intake, back to the project page, then to documents. Each source file needed a separate upload and a second extraction click, and every extracted row needed an individual confirmation click. The data controls were correct, but the interaction cost obscured the intended guided workflow.

## Designed flow

One **Issuer setup** workspace now owns the complete Phase 2 journey:

1. **Issuer details** — the dynamic questionnaire remains incrementally persisted and resumable. A sticky progress control jumps to the next missing required answer.
2. **Source documents** — the promoter selects multiple files once, verifies the visible suggested category for every file, and submits one bounded batch. Files are still validated and stored through the real private Supabase path.
3. **Review extraction** — supported documents automatically enter the existing parse and Groq structured-extraction path after upload. Failures stay visible and retryable. Extracted groups show evidence and require an explicit promoter review attestation before group confirmation.
4. **Generate** — the primary generation action appears when required intake answers exist, at least one source document is stored, and every extracted value is promoter-confirmed.

The legacy documents URL redirects into the source-document section of this workspace, so existing links do not become dead ends.

## Guardrails retained

- No document category is accepted silently: filename matching only preselects a visible, editable option.
- The 25 MB request cap is checked before any file is written; every file also passes the existing MIME, size, and empty-file validation.
- Upload and extraction remain separate server operations so a multi-document LLM job does not hide inside one long request.
- Automatic extraction uses the production parser, typed extraction schemas, Groq configuration, persistence, and error states; no mock or fallback values are introduced.
- Bulk confirmation is not blind acceptance. The promoter must attest that the displayed values were reviewed against their source snippets, and can still correct individual values before confirmation.
- Only confirmed entities remain eligible for generation. The intermediary approval and export gates are unchanged.

## Acceptance checks

- A promoter can complete Phase 2 without returning to the project index between details, upload, and confirmation.
- Multiple differently-classified files can be prepared in one selection and one upload action.
- Extractable files begin the real extraction path automatically; failed files show a retry action and the exact error.
- A reviewed entity group can be confirmed in one explicit action; corrections still override extracted data.
- Existing `/documents` links land on the unified source-document section.
- Typecheck, lint, unit tests, and production build pass. The Phase 2 gate remains unchecked until the deployed/live document-set acceptance test passes.

## Verification recorded

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 48 passed; 30 live-service integration tests skipped because their configured services were not present.
- `pnpm build` — passed on Next.js 16.2.10.
- Deployed Supabase Storage + Groq extraction confirmation — not claimed; still required to close TASKS.md 2.7.
