# AGENTS.md

Conventions for any coding agent (Codex and others) working in this repo. Companion to `CLAUDE.md`; the two carry the same rules in each agent's expected format. Read `IMPLEMENTATION_PLAN.md` → `TASKS.md` → this file before acting.

## Project
**DRHP Studio** — a production web app for SEBI TechSprint Problem Statement 4: an SME promoter captures business, financial, and legal particulars and the app generates a disclosure-ready **draft** DRHP aligned to SEBI's SME IPO framework, with automated gap/consistency flagging and a mandatory authorised-intermediary review gate before export.

## Prime directive
Deliver a **fully functional, production-grade** system — real DB, real auth, real LLM calls, real document parsing, real RAG, real DOCX/PDF export. No MVP shortcuts, no stubs in production paths, no fabricated data. If something can't genuinely work, **stop and report the blocker**; do not fake completion.

## Working agreement
- Announce the current `TASKS.md` task id before starting.
- Execute tasks in order; never skip a phase **GATE** task.
- Mark a task done only after its **Accept** bullets pass against real services; note the verification in the PR.
- Keep `main` runnable and deployable at all times. Branch → PR → review → merge.
- **Commit per task, not in a batch.** As soon as a task's Accept criteria pass, commit (one commit or small tightly-related group) and push immediately. Message format: `[<task-id>] <short description>`.
- **Git identity is fixed and non-negotiable:** every commit is authored as `Vedant817` / `vedantmahajan271@gmail.com`, configured locally per repo per `START.md` §2.0 — never the machine's default or an org identity. Re-verify `git config user.name` / `git config user.email` at the start of every session and after any fresh clone, before the first commit.

## Non-negotiable rules
1. **No fabricated data.** Never hardcode values that should be computed, parsed, or fetched. External data sources go behind the typed adapters in `src/server/adapters/`; the default implementation is a **real** upload/parse or real public lookup. Missing value with no real source → emit a **gap flag**, never invent.
2. **No mocks/stubs outside tests.** No lingering `TODO`/`FIXME` in shipped paths.
3. **Grounded generation.** Sections are grounded in confirmed issuer data + retrieved requirements, with persisted provenance. Model emits `[[GAP: …]]` for unknowns. Coverage is verified independently against the checklist, not taken from the model's word.
4. **Intermediary gate preserved.** No un-watermarked export before all mandatory sections are approved by an authorised intermediary. No regulator/exchange submission path, ever.
5. **Human-in-the-loop extraction.** Promoter confirms extracted values before they enter a draft.
6. **Fail loud.** Retry+backoff around LLM/API/DB calls; surface clear errors; never swallow or return silent empties.
7. **Security.** Secrets via typed env loader only; enforce Supabase RLS; no PII in URLs/query strings; data-localization path documented for production.

## Stack & structure
- Next.js App Router, TypeScript strict, Tailwind + shadcn/ui.
- Supabase (Postgres + pgvector + Auth + Storage); migrations `db/migrations`, seeds `db/seed`.
- Groq SDK (OpenAI-compatible); model ids from `MODEL_DRAFTING` / `MODEL_REASONING` env (never hardcoded).
- `zod` at every boundary; shared schemas in `src/schemas/`.
- DOCX via `docx`; PDF via server render; exports must open cleanly in Word and a PDF viewer.
- Service layout under `src/server/{intake,extraction,retrieval,generation,gaps,review,export,adapters}` (see `START.md` §2).

## Commands
```
pnpm dev          # run
pnpm typecheck    # must be clean (strict)
pnpm lint         # must be clean
pnpm test         # vitest unit
pnpm test:e2e     # playwright — happy path must pass before demo
pnpm db:migrate   # apply migrations
pnpm seed:corpus  # ingest+embed regulatory corpus
pnpm seed:checklist
pnpm seed:sample-issuer
```

## Definition of Done (project)
`TASKS.md` Phase 7 GATE: a fresh reviewer following `START.md` reaches a completed, exported draft on the **deployed** URL against live services, all tasks checked, no `IMPLEMENTATION_PLAN.md` §11 anti-pattern present.

## Multi-agent coordination
Codex and Claude Code share this backlog. Split by service boundary (`START.md` §8), not by file. Separate branches; review each other's PRs strictly against `TASKS.md` acceptance criteria; never edit the same file at the same time. Both agents commit under the same fixed identity above — do not let a merge/squash reattribute authorship.

## If blocked
Report the exact blocker (missing corpus file, missing credential, ambiguous spec) and the minimal real input needed to continue. Do not substitute fabricated data or a stub to look finished.
