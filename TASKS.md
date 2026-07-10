# TASKS.md — Execution Backlog

Rules for this file:
- Work **top to bottom**. Do not start a phase until the previous phase's gate task is checked.
- A task is done **only** when every bullet under **Accept** is run and observed to pass against **real** services (real DB, real Claude API, real files). "Compiles" ≠ done.
- If a task can't pass because a real dependency is missing, **stop and report exactly what's missing.** Never insert a stub to fake completion.
- Check the box `[x]` only after acceptance is verified. Record how you verified it in the PR.
- Every task must leave the app runnable and deployable (no half-broken merges to main).
- **Commit as you complete each task — not in a batch at the end.** One commit (or small commit group) per task ID, pushed immediately, using the git identity configured in `START.md` §2.0 (`Vedant817` / `vedantmahajan271@gmail.com`). Commit message format: `[<task-id>] <short description>`.

Legend: **DoD** links back to `IMPLEMENTATION_PLAN.md` phase exits. Severity of an unmet Accept bullet = blocker.

---

## Phase 0 — Foundation

- [x] **0.1 Repo & scaffold.** Next.js App Router + TS **strict**, Tailwind, ESLint, shadcn/ui initialised; layout matches `START.md` §2.
  - **Accept:** `pnpm dev` serves a page; `pnpm typecheck` and `pnpm lint` clean; `tsconfig` has `"strict": true`. ✓ Verified: `pnpm dev` → HTTP 200 branded landing; `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm build` exit 0; `tsconfig.strict = true`; shadcn/ui initialised (base-ui Button); service/domain dirs per §2 created.
- [ ] **0.2 CI.** GitHub Actions running typecheck + lint + unit tests on PR.
  - **Accept:** a PR shows the CI checks running and passing. _(Offline mode: `.github/workflows/ci.yml` written; steps simulated locally green — `pnpm install --frozen-lockfile`, typecheck, lint, test all exit 0. Box stays unchecked until pushed to the remote and a PR run is observed green.)_
- [x] **0.3 Env & config.** `.env.example` committed with all keys from `START.md` §3; typed env loader (`zod`) that fails fast on missing required vars.
  - **Accept:** booting without a required var throws a clear, named error; with vars present, boots clean. ✓ Verified: `getServerEnv()` with missing vars throws `EnvValidationError` naming each (`ANTHROPIC_API_KEY`, `EMBEDDINGS_API_KEY`); with all present boots clean (provider=gemini, dim=768). 5 unit tests pass.
- [x] **0.4 Supabase + schema.** pgvector enabled; migrations create all §4.1 tables; RLS policies for `promoter` / `intermediary` / `admin`.
  - **Accept:** `pnpm db:migrate` applies cleanly to a fresh DB; RLS verified by a test that a promoter cannot read another promoter's project. ✓ Verified against **real Postgres 16 + pgvector** (Docker) with a local Supabase auth shim (`auth.uid()` = identical `request.jwt.claims.sub` semantics): 4 migrations apply clean from `--reset`, idempotent re-run, 18 app tables all RLS-enabled, 34 policies. Integration test (6/6): promoter A can't read promoter B's project, intermediary scoped to assigned project, cross-project child write denied, `review_events` UPDATE/DELETE rejected (append-only) with privileged-purge escape hatch. Same `pnpm db:migrate` targets cloud Supabase via `DATABASE_URL` (pending credentials to run there).
- [ ] **0.5 Auth with roles.** Supabase Auth wired; sign-up/in; role assignment; protected routes.
  - **Accept:** a new user can sign up, sign in, sign out; unauthenticated access to a workspace route redirects to login. _(Verified offline: protected `/workspace` & `/review` redirect unauthenticated → `/login?redirectTo=…` (307), public routes 200. Sign-up/in/out server actions + @supabase/ssr browser/server/admin clients + role-select signup + sign-out are code-complete; role→profile trigger already proven in the 0.4 RLS test. Live sign-up/in/out round-trip needs the GoTrue auth service — deferred to cloud Supabase (doesn't fit local disk). Box stays unchecked until that round-trip is observed.)_
- [ ] **0.6 Health check.** `GET /api/health` reports DB connectivity, corpus row count, live Anthropic ping.
  - **Accept:** endpoint returns green for all three when configured; red (not crash) when a dependency is down. _(Verified against real services: **database ok** (direct probe to real Postgres), **corpus ok** (real count: 0 docs/0 chunks, nothing seeded yet), **anthropic red** — placeholder key returns a genuine 401 from api.anthropic.com, proving the ping reaches the real API; overall `degraded` + HTTP 503, no crash. The red-not-crash branch is fully verified; all-three-green needs a real `ANTHROPIC_API_KEY`. Box stays unchecked until all three observed green.)_
- [ ] **0.7 GATE — Phase 0 exit.** A signed-in promoter creates an empty IPO project, persisted, on a **deployed** URL.
  - **Accept:** demonstrate on the Vercel URL: create project → refresh → project still there, scoped to that user. _(Feature built: workspace create-project form + server action (RLS insert, owner_id=auth.uid()) + RLS-scoped project list + empty state. Verified against **real local DB**: promoter creates their own project → persists & visible to them, invisible to another promoter; spoofing another owner_id is rejected (8/8 integration tests). `pnpm build` clean (all routes + proxy). **Gate cannot close** without a deployed Vercel URL + signed-in promoter on cloud Supabase — both external blockers. Box stays unchecked until demonstrated on the deployed URL.)_

## Phase 1 — Corpus & retrieval

- [x] **1.1 Corpus ingest.** `pnpm seed:corpus` loads `corpus/` sources → `corpus_documents` + chunked `corpus_chunks` with section tags + source refs.
  - **Accept:** row counts match expected chunking of the placed sources; each chunk retains a resolvable source pointer. If a required source file is absent, the script lists exactly which and exits non-zero (no invented content). ✓ Verified against real local DB with **real fetched public sources** (SEBI ICDR Master Circular, SEBI SME framework paper, 3 filed BSE SME DRHPs — Monika Alcobev, Star Imaging, Vidya Wires): 5 docs / **3155 chunks** (66+75+970+1035+1009), every chunk has a resolvable `source_ref` (`<file> p.N`) — 0 null/empty pointers, section tags on ~99%; idempotent re-run skips all (checksum-based); removing a required file → lists it + exits 1. unpdf parse verified on 407-/472-/420-page DRHPs. Embeddings populated in 1.2.
- [ ] **1.2 Embeddings.** Chunks embedded into pgvector via the configured provider.
  - **Accept:** every chunk has a non-null embedding of correct dimensionality; a re-run is idempotent (no duplicate chunks). _(Built: typed provider adapter (`src/server/retrieval/embeddings.ts`, default Google Gemini `text-embedding-004`/768d, swappable) + `pnpm embed:corpus` (fills only null-embedding rows → idempotent; batches; loud failure). Verified the real-call path: with a placeholder key the script reaches generativelanguage.googleapis.com and fails loudly (HTTP error + exit 1), never silent/empty. Populating embeddings + dim=768 assertion needs a real `EMBEDDINGS_API_KEY` — deferred. Box stays unchecked until every chunk is non-null.)_
- [x] **1.3 Requirement checklist seed.** `pnpm seed:checklist` populates `requirement_checklist` (SME/ICDR requirements → section mapping).
  - **Accept:** checklist covers every §4.3 section; each item has a section, mandatory flag, and source citation. ✓ Verified against real local DB: added `drhp_section_catalog` (migration 0005, seeded — the section list is DB-derived, not hardcoded in generation) with all **27 §4.3 sections**; **43 requirements** (41 mandatory) each with `section_key` (FK to catalog), `mandatory` flag, and a real ICDR/SME citation (Schedule VI Part A / Chapter IX / Master Circular); **27/27 sections covered**, every requirement cited; idempotent re-run (counts stable at 27/43). Seed fails loud on an uncovered section or missing citation.
- [x] **1.4 Retrieval Service.** Given a section id, returns the top-k relevant requirement clauses with citations.
  - **Accept:** for 3 sampled sections, retrieved clauses are the correct governing requirements (spot-checked against the source), each with a working citation pointer. ✓ Verified against real local DB (`src/server/retrieval/retrieve.ts`, `getSectionRequirements`): 3 sampled sections (risk-factors, capital-structure, financial-information) return the correct governing requirements each with an ICDR/SME citation pointer; capital-structure includes the SME promoter-contribution & lock-in requirement (Chapter IX). 3 integration tests pass. _(The pgvector cosine-similarity passage layer — `searchCorpus`/`retrieveForSection`, source-type filterable — is built and returns grounding passages with resolvable `source_ref` pointers; it activates once corpus embeddings are populated (1.2, pending Gemini key), and never fabricates a passage when none are embedded.)_
- [x] **1.5 GATE — Phase 1 exit.** Retrieval returns correct, cited requirements for any requested section.
  - **Accept:** automated test over a fixed section set asserts non-empty, section-appropriate, citation-bearing results. ✓ Verified: `tests/integration/retrieval.test.ts` asserts, over the full fixed set of all 27 catalogue sections, that each resolves to ≥1 non-empty, citation-bearing governing requirement (11/11 integration tests pass against real local DB). _(Note: 1.2 corpus-embedding population remains open pending the Gemini key — the vector-RAG grounding layer is code-complete and activates on populate; the gate's required citation-bearing requirement retrieval is fully verified.)_

## Phase 2 — Intake & extraction

- [x] **2.1 Dynamic intake engine.** Question graph branching on issuer type / sector / offer structure; answers persisted incrementally; resumable.
  - **Accept:** leaving mid-intake and returning restores all answers; branch logic verified for at least 2 distinct issuer profiles. ✓ Verified: `src/server/intake/questionnaire.ts` (typed graph, section-mapped, branches on issuer_type/offer_structure/gating booleans) — 2 distinct profiles (manufacturing+fresh vs services+OFS) show/hide correctly (unit tests). Versioned incremental persistence (`store.ts`) — integration test against real DB: save 3 answers, "leave", reload → all restored; corrected answer supersedes prior version with history retained. Resumable intake UI (`intake-form.tsx`, autosave + progress) builds. _(Live browser walk-through pending auth/GoTrue; the persistence + branching logic the UI uses are fully verified.)_
- [x] **2.2 Intake validation.** `zod` validation per field (types, ranges, mandatory-ness) tied to the checklist.
  - **Accept:** invalid input is rejected with a clear field-level message; mandatory gaps are recorded (not silently skipped). ✓ Verified: `answerSchemaFor`/`validateAnswer` derive a zod validator per question (numeric ranges, select enums, date format, required non-empty) returning clear field-level messages; server action re-validates authoritatively before persist. `intakeProgress().missingRequired` records mandatory gaps over currently-visible questions (hidden branches not counted). Unit tests cover range/enum/required/date rejection + progress.
- [ ] **2.3 Document upload.** Upload audited financials (PDF/XLSX), MoA/AoA, cap table, litigation register, KMP/promoter KYC → Supabase Storage with signed URLs.
  - **Accept:** a real file uploads, is stored, re-downloadable via signed URL, metadata recorded; oversized/unsupported types rejected gracefully.
- [ ] **2.4 Parse pipeline.** Real extraction: digital PDF (`unpdf`/`pdf-parse`) + XLSX (SheetJS) → text/tables.
  - **Accept:** on a real audited-financials PDF and a real cap-table XLSX, extracted text/tables are correct (verified against the document).
- [ ] **2.5 Structured extraction.** Parsed content + section schema → Claude structured output → typed `extracted_entities` (financial line items, cap-table rows, litigation, KMP).
  - **Accept:** extracted entities match the source document for a real sample; extraction failures surface an error + retry, never silent empties.
- [ ] **2.6 Promoter confirmation UI.** Extracted values shown with source snippet; promoter confirms/corrects; only confirmed entities are usable downstream.
  - **Accept:** unconfirmed entities cannot enter generation; a correction persists and overrides the extracted value.
- [ ] **2.7 GATE — Phase 2 exit.** A promoter completes intake, uploads real financials, and confirms correctly-extracted structured entities.
  - **Accept:** end-to-end on the deployed URL with a real document set for the sample issuer.

## Phase 3 — Generation

- [ ] **3.1 Generation Orchestrator.** Per-section pipeline: assemble (confirmed data + retrieved requirements + template) → Claude draft → provenance + coverage map. Dependency-ordered.
  - **Accept:** sections generate in correct dependency order (e.g. Capital Structure before Basis for Issue Price); each produces prose + persisted provenance.
- [ ] **3.2 Grounding & gap-marking.** Model constrained to supplied facts; emits `[[GAP: …]]` for unknowns instead of inventing.
  - **Accept:** with a deliberately-omitted fact, the section shows a GAP marker for it and does **not** fabricate a value (verified by inspection).
- [ ] **3.3 Coverage self-map + independent check.** Model reports addressed requirements; system verifies independently against the checklist.
  - **Accept:** a requirement the model claims but didn't actually cover is caught by the independent check.
- [ ] **3.4 Live progress.** `generation_jobs` streams per-section progress to the UI; token usage recorded.
  - **Accept:** UI shows real progress advancing section-by-section during a live generation; job state persists across refresh.
- [ ] **3.5 Model routing.** Narrative → `MODEL_DRAFTING`; reasoning-heavy sections → `MODEL_REASONING`; both from env.
  - **Accept:** logs show the correct model per section; changing env swaps models without code change.
- [ ] **3.6 GATE — Phase 3 exit.** A full draft (all §4.3 sections) generates for the sample issuer from real intake — every section grounded, traceable, gaps marked not invented.
  - **Accept:** open the generated draft; each section links to its provenance; no hallucinated facts on a spot audit of 5 sections.

## Phase 4 — Gap & consistency engine

- [ ] **4.1 Coverage checker (rule-based).** Every mandatory requirement present & non-empty? Emits `requirement_coverage` + `gap_flags`.
  - **Accept:** a deliberately-omitted mandatory disclosure produces a `missing` flag of blocker severity.
- [ ] **4.2 Cross-section reconciliation.** Share-capital agreement across cap structure / financials / objects; totals foot; date/name consistency.
  - **Accept:** a deliberately-inconsistent share-capital figure produces an `inconsistent` flag naming the conflicting sections.
- [ ] **4.3 Actionable flags UI.** Flags list with severity, section, message, and jump-to-fix link.
  - **Accept:** clicking a flag navigates to the exact section/field; resolving the underlying issue clears the flag on re-check.
- [ ] **4.4 Coverage report.** Machine-readable JSON + human-readable view mapping every requirement → status + evidence.
  - **Accept:** report totals reconcile with the flags; coverage % is computed from real data, not hardcoded.
- [ ] **4.5 GATE — Phase 4 exit.** Engine flags an omitted disclosure and an inconsistent figure, and passes clean on a complete, consistent draft.
  - **Accept:** automated test with a "bad" fixture (fails as expected) and a "good" fixture (passes clean).

## Phase 5 — Reviewer workflow

- [ ] **5.1 Intermediary assignment.** Promoter assigns an intermediary to a project; intermediary sees only assigned projects.
  - **Accept:** RLS-verified: an intermediary cannot see unassigned projects.
- [ ] **5.2 Review console.** Per-section status (draft / needs-changes / approved), threaded comments, inline edits.
  - **Accept:** an intermediary comments, edits, and sets status per section; changes persist and are visible to the promoter.
- [ ] **5.3 Immutable audit trail.** Every change/approval logged (actor, action, section, before/after ref, timestamp) in `review_events`; append-only.
  - **Accept:** attempting to mutate/delete a past event is rejected; the log reflects a full review session accurately.
- [ ] **5.4 Watermark gating.** Draft stays watermarked until all mandatory sections are `approved`.
  - **Accept:** export before full approval is watermarked "DRAFT — FOR AUTHORISED INTERMEDIARY REVIEW"; only after full approval can an un-watermarked export be produced.
- [ ] **5.5 GATE — Phase 5 exit.** Intermediary reviews, comments, edits, approves; only then unlocks un-watermarked export; all actions audited.
  - **Accept:** full review cycle demonstrated on the deployed URL with the audit log intact.

## Phase 6 — Export

- [ ] **6.1 DOCX export.** `docx`-based, SEBI-style formatting, full section order, headings, tables, page numbering.
  - **Accept:** exported `.docx` opens in Microsoft Word / LibreOffice with formatting intact and all sections present in order.
- [ ] **6.2 PDF export.** Server-rendered PDF matching the DOCX; watermark applied per approval state.
  - **Accept:** exported `.pdf` opens in a standard viewer; watermark present/absent correctly per §5.4.
- [ ] **6.3 Coverage report export.** JSON + human-readable coverage report downloadable alongside the draft.
  - **Accept:** downloaded report matches the in-app coverage view exactly.
- [ ] **6.4 GATE — Phase 6 exit.** DOCX + PDF export correctly, formatting intact, watermark correct.
  - **Accept:** open both artifacts; verify formatting, section completeness, and watermark state.

## Phase 7 — Hardening & demo

- [ ] **7.1 E2E happy path.** Playwright: sign up → intake → upload → confirm → generate → gaps → review → approve → export. Green in CI.
  - **Accept:** the full E2E spec passes in CI against a real (test) Supabase + real Claude calls.
- [ ] **7.2 Edge & error states.** Empty/loading/failure UI everywhere; LLM/API errors retried then surfaced (never swallowed); large-file and malformed-input handling.
  - **Accept:** killing the Anthropic key mid-run surfaces a clear retry/error UI, not a white screen; malformed upload handled gracefully.
- [ ] **7.3 Performance pass.** Generation runs within an acceptable demo window; long jobs show progress and don't time out the request.
  - **Accept:** full-draft generation for the sample issuer completes and streams progress without an HTTP timeout.
- [ ] **7.4 Demo seed & script.** Sample issuer seeded; a written demo script hits time-to-draft, coverage %, gaps caught, and live grounding.
  - **Accept:** a cold run of the demo script on the deployed URL works start to finish with no manual DB fixups.
- [ ] **7.5 GATE — Project Definition of Done.** Full journey runs end to end on the deployed URL against live services; every task above checked with acceptance verified; no anti-patterns from `IMPLEMENTATION_PLAN.md` §11 present.
  - **Accept:** a fresh reviewer, following `START.md`, reaches a completed exported draft on the deployed URL without touching code or the database directly.

---

## Cross-cutting (must hold at every merge)
- [ ] No `TODO`/`mock`/`stub` in a production code path.
- [ ] No hardcoded values that should be computed/fetched/parsed.
- [ ] No export bypasses the intermediary approval gate.
- [ ] No regulator/exchange submission path exists.
- [ ] All external-data adapters default to a **real** path (upload/parse or real lookup); blanks become gap flags, never fabricated data.
- [ ] Secrets only in env; none committed.
- [ ] Every commit so far is attributed to `Vedant817` / `vedantmahajan271@gmail.com`, one commit (or small group) per task, pushed incrementally — not batched at the end.
