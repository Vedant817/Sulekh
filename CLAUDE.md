# CLAUDE.md — Rules for Claude Code

You are building **Sulekh**, a production application for SEBI TechSprint Problem Statement 4. Read `IMPLEMENTATION_PLAN.md` (architecture + non-negotiables), then `TASKS.md` (the backlog you execute), then this file.

## Prime directive
Ship a **fully functional, production-grade** application — not an MVP, not a demo shell. Every path works against real services on real input. If you cannot make something genuinely work, **stop and report what's missing** — do not fake it.

## How you work
1. Always state which `TASKS.md` task you are on before starting it.
2. Do tasks in order; respect phase GATE tasks — never skip a gate.
3. A task is done only when its **Accept** bullets are run and observed to pass against real DB / real LLM (Groq) API / real files. Record how you verified in the PR description.
4. Keep `main` always runnable and deployable. Work on a branch, open a PR, keep changes reviewable.
5. Update the checkbox in `TASKS.md` only after acceptance is verified.
6. **Commit as each task completes — never in one large end-of-session batch.** One commit (or small tightly-related group) per task ID, pushed right after, formatted `[<task-id>] <short description>`.
7. **Git identity is fixed and non-negotiable:** every commit is authored as `Vedant817` / `vedantmahajan271@gmail.com` — set locally per repo (`START.md` §2.0), not the machine's default or any org identity. Re-verify `git config user.name` and `git config user.email` at the start of every session, and again after any fresh clone or container restart, before your first commit.

## Hard rules (violating any = a defect)
- **No fabricated data.** Never hardcode a value that should be computed, parsed, or fetched. If a data source needs credentials you don't have, route it through the typed adapter in `src/server/adapters/` whose default is a **real** upload/parse or real public lookup. If no real value is available, emit a **gap flag** — never invent one.
- **No stubs/mocks in production paths.** Mocks are allowed only inside test files. No `TODO`/`FIXME` left in shipped code paths.
- **Grounded generation only.** Generated DRHP sections must be grounded in confirmed issuer data + retrieved regulatory requirements, with persisted provenance. Instruct the model to emit `[[GAP: …]]` rather than guess. Never trust the model's self-reported coverage — verify independently against the checklist.
- **Preserve the intermediary gate.** No un-watermarked export before an authorised intermediary approves all mandatory sections. Never build any submission-to-regulator/exchange path.
- **Human-in-the-loop on extraction.** Extracted values must be confirmed by the promoter before they enter a draft.
- **Errors surface.** Wrap LLM/API/DB calls with retry + backoff; on final failure, surface a clear UI error and log it. Never swallow errors or return silent empty results.
- **Security.** Secrets only via env (typed loader). Enforce Supabase RLS. No user/PII data in URLs or query strings.

## Tech constraints
- Next.js App Router + TypeScript **strict**. `zod` for all boundaries (shared client/server schemas in `src/schemas/`).
- Groq SDK (OpenAI-compatible); models from `MODEL_DRAFTING` / `MODEL_REASONING` env vars (never hardcode model ids).
- Supabase (Postgres + pgvector + Auth + Storage). Migrations in `db/migrations`, idempotent seeds in `db/seed`.
- DOCX via `docx`; PDF via server render. Exports must open cleanly in Word and a PDF viewer.
- For any UI work, follow the `frontend-design` skill's tokens and accessibility guidance; components via shadcn/ui; handle empty/loading/error states everywhere.

## Definition of Done (project)
Phase 7's GATE in `TASKS.md`: a fresh reviewer following `START.md` reaches a completed, exported draft on the **deployed** URL against live services, with every task checked and no `IMPLEMENTATION_PLAN.md` §11 anti-pattern present.

## When stuck
State the specific blocker (missing corpus file, missing credential, ambiguous requirement) and the smallest real thing needed to proceed. Do not paper over it with fake data or a stub to appear finished.

## Coordination with Codex
If Codex is also active, stay within your assigned service boundary (see `START.md` §8), work on separate branches, and review each other's PRs strictly against the `TASKS.md` acceptance criteria before merge. Never edit the same file simultaneously. Both agents' commits use the same fixed identity above — do not let a PR merge/squash reattribute authorship to a bot or default account.
