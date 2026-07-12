# Sulekh

A production web application for **SEBI Securities Market TechSprint (GFF 2026), Problem Statement 4 — _Simplifying IPO Offer Document Preparation for SMEs._**

Sulekh captures an SME issuer's business, financial, and legal particulars through a guided intake and generates a **substantially complete, disclosure-ready draft DRHP** aligned to SEBI's SME IPO framework — with automated gap/consistency flagging and a **mandatory authorised-intermediary review gate** before any export. It is the _author_ (produces the clean first draft), complementing the _checkers_ that BSE/SEBI already provide.

> This tool produces a **draft** for authorised-intermediary review. It never submits anything to any regulator or exchange.

## Documentation

- `START.md` — bootstrap & kickoff
- `IMPLEMENTATION_PLAN.md` — architecture + non-negotiables
- `TASKS.md` — execution backlog (phase-gated)
- `CLAUDE.md` / `AGENTS.md` — agent working rules

## Stack

Next.js (App Router) · TypeScript strict · Tailwind CSS v4 + shadcn/ui · Supabase (Postgres + pgvector + Auth + Storage) · Groq LLM API (OpenAI-compatible) · `docx`/server-rendered PDF · `zod` · Vitest + Playwright.

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in real credentials
pnpm dev                     # http://localhost:3000
pnpm typecheck               # strict, must be clean
pnpm lint                    # must be clean
pnpm test                    # vitest unit
pnpm test:e2e                # playwright e2e
```

See `START.md` for database migrations, corpus ingest, and deployment.
