# START.md — Bootstrap & Kickoff

This is the first file an agent (Claude Code or Codex) or a human reads. It gets the project from empty to a running, deployed skeleton, then hands off to `TASKS.md`.

Read order: **`START.md` → `IMPLEMENTATION_PLAN.md` → `TASKS.md`**, plus your agent rules (`CLAUDE.md` for Claude Code, `AGENTS.md` for Codex). Do not start coding features before Phase 0 in `TASKS.md` is green.

---

## 1. Prerequisites

- Node.js 20 LTS+ and pnpm (`corepack enable && corepack prepare pnpm@latest --activate`)
- Git, GitHub CLI (`gh`) authenticated to the **scaiorg** org
- A Supabase project (Postgres + Auth + Storage; **pgvector enabled**)
- An **Anthropic API key** (`ANTHROPIC_API_KEY`)
- An embeddings provider key (configurable; see `.env.example`)
- Vercel account (for demo deploy)

---

## 2. Repository

### 2.0 Git identity (set this first, before any commit)

All commits in this repo — by you or by any agent (Claude Code, Codex) — must be attributed to this identity, not a default machine/org identity:

```bash
git config user.name "Vedant817"
git config user.email "vedantmahajan271@gmail.com"
```

Set this **locally in the repo** (`git config` without `--global`) so it never leaks into or gets overridden by other repos on the same machine. Verify before the first commit:

```bash
git config user.name    # must print: Vedant817
git config user.email   # must print: vedantmahajan271@gmail.com
```

If `gh` prompts for auth, authenticate as the **Vedant817** GitHub account — not any other account signed in on the machine (`gh auth status` to check; `gh auth login` / `gh auth switch` if needed).

```bash
# Create the repo in the scaiorg org (private)
gh repo create scaiorg/drhp-studio --private --clone
cd drhp-studio

# Re-confirm identity inside the freshly cloned repo (a clone can reset local config)
git config user.name "Vedant817"
git config user.email "vedantmahajan271@gmail.com"

# Scaffold Next.js (App Router, TS, Tailwind, ESLint, src dir)
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Enable TypeScript **strict** mode and add the shared tooling:

```bash
pnpm add zod @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk docx
pnpm add -D vitest @playwright/test @types/node
pnpm add class-variance-authority tailwind-merge lucide-react   # shadcn/ui deps
pnpm dlx shadcn@latest init
```

Directory layout (target):

```
drhp-studio/
├── src/
│   ├── app/                    # routes: (auth), promoter workspace, reviewer console, api/*
│   ├── components/             # UI (shadcn-based)
│   ├── server/
│   │   ├── intake/             # Intake Service
│   │   ├── extraction/         # Extraction Service (parse + Claude structured extraction)
│   │   ├── retrieval/          # RAG over corpus (pgvector)
│   │   ├── generation/         # Generation Orchestrator (agentic, per-section)
│   │   ├── gaps/               # Gap & Consistency Engine
│   │   ├── review/             # Review Service + audit log
│   │   ├── export/             # DOCX/PDF + coverage report
│   │   └── adapters/           # External data adapters (default = real upload/lookup)
│   ├── lib/                    # supabase client, anthropic client, env, utils
│   └── schemas/                # zod schemas shared client+server
├── db/
│   ├── migrations/             # SQL migrations
│   └── seed/                   # corpus ingest + requirement checklist + sample issuer
├── corpus/                     # raw regulatory source docs (see §4)
├── tests/                      # vitest unit + playwright e2e
├── .env.example
├── IMPLEMENTATION_PLAN.md
├── TASKS.md
├── CLAUDE.md
└── AGENTS.md
```

---

## 3. Environment

Create `.env.example` (commit) and `.env.local` (never commit):

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=
MODEL_DRAFTING=claude-sonnet-5
MODEL_REASONING=claude-opus-4-8

# Embeddings (configurable provider)
EMBEDDINGS_API_KEY=
EMBEDDINGS_MODEL=

# App
APP_URL=http://localhost:3000
NODE_ENV=development

# Optional credentialed external data providers (leave blank → default real upload/parse path)
MCA_API_KEY=
GST_API_KEY=
```

> Any blank credentialed provider must fall through to its **real default adapter** (document upload + parse), never a fake stub. See `IMPLEMENTATION_PLAN.md` §7.

---

## 4. Database & corpus bootstrap

```bash
# 1. Enable pgvector on the Supabase project (SQL editor or migration):
#    create extension if not exists vector;

# 2. Apply schema migrations
pnpm db:migrate            # runs db/migrations in order

# 3. Place raw regulatory sources in corpus/ :
#    - icdr-regulations.(pdf|txt)         SEBI ICDR Regulations (public)
#    - sme-drhp-template.(pdf|txt)        SME framework / standardised template + checklist (public)
#    - reference-drhp-1..3.pdf            2–3 real filed BSE SME DRHPs (public) — structure/style refs
#    (If sources are not yet placed, the ingest task lists exactly which files it needs and stops with a clear message — it does NOT invent corpus content.)

# 4. Ingest + chunk + embed the corpus and seed the requirement checklist
pnpm seed:corpus
pnpm seed:checklist

# 5. Seed ONE clearly-labelled synthetic sample issuer for the demo
pnpm seed:sample-issuer
```

---

## 5. Run & verify

```bash
pnpm dev            # http://localhost:3000
pnpm typecheck      # must be clean (strict)
pnpm lint           # must be clean
pnpm test           # vitest unit
pnpm test:e2e       # playwright — the happy path must go green before demo
```

Health check: `GET /api/health` returns DB connectivity, corpus row count, and a live Anthropic ping (non-secret). If any is red, fix before proceeding.

---

## 6. Deploy (demo)

```bash
vercel link
# set all env vars in Vercel project settings (same keys as .env.example)
vercel --prod
```

Verify the full journey on the deployed URL, not just locally.

---

## 7. Commit discipline (applies to every agent, every task)

- **Commit as you go, task by task — never in one giant batch at the end.** Each `TASKS.md` task ID gets its own commit (or tightly-related small commits) the moment its Accept criteria pass. Do not accumulate multiple tasks' worth of uncommitted work.
- **Commit message format:** `[<task-id>] <short description>` — e.g. `[2.4] Add PDF/XLSX parse pipeline for uploaded financials`. This keeps history auditable against `TASKS.md`.
- **Every commit uses the identity set in §2.0** (`Vedant817` / `vedantmahajan271@gmail.com`). Before starting work each session, re-run the verification in §2.0 — don't assume it persisted, especially across containers, fresh clones, or CI runners.
- Push after each commit (or small commit group) so progress is visible in the remote in near real time, not just at the end of a phase.
- If working across branches (see §8 division of labour), each branch's commits still carry the same identity; PRs merge into `main` with that identity preserved (prefer a merge/rebase strategy that keeps authorship, not a squash that reattributes to a bot or default account).

## 8. Kicking off the agents

Both agents work the **same** `TASKS.md` backlog, in order, respecting phase gates.

**Claude Code:**
```bash
# from repo root, with CLAUDE.md present
claude
# then: "Read START.md, IMPLEMENTATION_PLAN.md, CLAUDE.md, and TASKS.md.
#        Begin at the first unchecked task. Do not skip phase gates.
#        A task is done only when its acceptance criteria pass. Report which task you're on."
```

**Codex:**
```bash
# from repo root, with AGENTS.md present
codex
# then: "Read START.md, IMPLEMENTATION_PLAN.md, AGENTS.md, and TASKS.md.
#        Begin at the first unchecked task. Do not skip phase gates.
#        A task is done only when its acceptance criteria pass. Report which task you're on."
```

### Division of labour (if running both in parallel)
To avoid collisions, split by service boundary, not by file:
- **Claude Code:** Phases 0–1 (foundation, corpus/retrieval), then Generation + Gap engine (Phases 3–4).
- **Codex:** Intake + Extraction (Phase 2), then Reviewer workflow + Export (Phases 5–6).
- **Phase 7 (hardening/E2E):** whichever agent is free; the other reviews.
- Each agent works on its own branch, opens a PR, and the other agent reviews against the acceptance criteria before merge. Never two agents on the same file at once.

---

## 9. The one rule that prevents "MVP creep"
No task is checked off, no PR is merged, until its acceptance criteria in `TASKS.md` are **run and observed to pass** against real services. If something can't pass because a real dependency is missing, stop and report exactly what's missing — do not substitute a stub to make it look done.
