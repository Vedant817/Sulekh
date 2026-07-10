# DRHP Studio — Implementation Plan

> **Problem statement:** SEBI Securities Market TechSprint (GFF 2026), Problem Statement 4 — *Simplifying IPO Offer Document Preparation for SMEs.*
> **What we build:** A promoter-facing web application that captures an SME issuer's business, financial, and legal particulars through a guided intake, and generates a **substantially complete, disclosure-ready draft DRHP** aligned to SEBI's SME IPO framework — with automated gap/consistency flagging and a mandatory authorised-intermediary review gate before any export.
> **Positioning:** BSE and SEBI already build *checkers* (pre-vetting a draft a merchant banker wrote, and a standardised template + AI review). We build the *author* — the tool that produces a clean draft in the first place and feeds it into that pipeline. This is deliberate whitespace, not a rebuild.

---

## 0. Non-negotiables (read before writing any code)

These override convenience. Any agent that violates these has produced a defect, not a shortcut.

1. **Production-grade, not MVP.** Every feature ships fully wired: real database, real auth, real LLM calls, real document parsing, real DOCX/PDF generation, real RAG retrieval. No screen is a dead end.
2. **No fake data, ever.** Never hardcode a value that in production would come from a computation, a document, or an API. If a data source needs credentials we don't have yet, it goes behind a typed **adapter interface** whose *default implementation is a real path* (document upload + parse, or a real public lookup) — never a stub that returns invented numbers. See §7.
3. **No silent stopping.** A task is done only when its acceptance criteria in `TASKS.md` pass. "Compiles" is not "done." "Renders" is not "done." "Returns 200" is not "done" unless the payload is correct and verified.
4. **Real-time means real-time.** LLM generation, retrieval, financial parsing, and consistency checks run live against real services on real user input. Nothing is pre-baked for the demo except the seeded regulatory corpus and one clearly-labelled sample issuer.
5. **Regulatory safety.** The app NEVER submits anything to any regulator or exchange. The final action is "export draft for intermediary review." A DRHP produced here is a *draft*, watermarked as such until an authorised intermediary signs off in-app. This is a hard requirement of the problem statement.
6. **Grounded generation.** Every generated disclosure is grounded in (a) the issuer's own captured data and (b) retrieved SEBI ICDR / SME-framework requirements. No section is free-hallucinated. Each generated clause carries a provenance trail (which intake fields + which regulatory citations produced it).

---

## 1. Product overview

### 1.1 Primary user
A first-time SME promoter (or their in-house finance person) with limited capital-market expertise, preparing to list on **BSE SME** (v1) — architecture ready for **NSE Emerge** (v2).

### 1.2 Secondary user
The authorised intermediary — merchant banker / legal counsel — who reviews, comments on, corrects, and certifies the draft before it leaves the platform.

### 1.3 Core user journey
1. **Onboard** → issuer signs up, creates an "IPO project."
2. **Intake** → a dynamic, plain-language guided interview captures business, financial, legal, promoter, and offer particulars. Promoter uploads source documents (audited financials, MoA/AoA, board resolutions, KYC, litigation list, licences).
3. **Extract** → uploaded documents are parsed into structured entities; extracted values are shown for promoter confirmation (human-in-the-loop, no blind trust).
4. **Generate** → an agentic pipeline drafts each DRHP section, grounded in the confirmed intake data and the retrieved regulatory requirements for that section.
5. **Review gaps** → a gap-and-consistency engine flags missing mandatory disclosures, internally inconsistent figures (e.g. capital structure vs. financials), and unaddressed ICDR requirements, with jump-to-fix links.
6. **Intermediary review** → merchant banker / legal counsel reviews section-by-section, comments, edits, and approves. Draft stays watermarked until all mandatory sections are approved.
7. **Export** → generate a formatted **DOCX and PDF** draft DRHP, plus a machine-readable requirements-coverage report.

### 1.4 What "substantially complete" means (v1 scope)
Full draft covering all **material disclosure sections of ICDR Part A** as applicable to SME issuers. Enumerated in §4.3. Gap-flagging covers every section, including ones the promoter left incomplete (flagged, not fabricated).

---

## 2. Architecture

### 2.1 High-level

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Client (Next.js App Router)                    │
│  Promoter workspace · Guided intake · Draft editor · Reviewer console  │
└───────────────┬────────────────────────────────────────────────────────┘
                │ (typed API routes / server actions, authenticated)
┌───────────────▼────────────────────────────────────────────────────────┐
│                        Application layer (Next.js server)               │
│                                                                          │
│  Intake Service    Extraction Service   Generation Orchestrator          │
│  (dynamic Q&A,     (document parse →     (per-section agentic pipeline,   │
│   validation)       structured entities)  grounded, provenance-tracked)  │
│                                                                          │
│  Retrieval Service   Gap & Consistency Engine   Review Service           │
│  (RAG over corpus)   (rules + cross-section      (comments, approvals,   │
│                       reconciliation)             audit trail)           │
│                                                                          │
│  Export Service (DOCX + PDF + coverage report)                          │
│  External Data Adapters (§7 — MCA/GST/financial; default = upload/parse)│
└───────┬─────────────────────┬───────────────────────┬───────────────────┘
        │                     │                       │
┌───────▼───────┐   ┌─────────▼─────────┐   ┌─────────▼──────────┐
│  Postgres      │   │  Groq LLM │   │  Object storage    │
│  (Supabase)    │   │  API              │   │  (Supabase Storage)│
│  + pgvector    │   │  drafting +       │   │  uploads + exports │
│  app data +    │   │  extraction +     │   │                    │
│  corpus embeds │   │  gap reasoning    │   │                    │
└────────────────┘   └───────────────────┘   └────────────────────┘
```

### 2.2 Services (each is a real module with tests)

- **Intake Service** — serves a dynamic questionnaire whose branches depend on issuer type, sector, and offer structure. Persists answers incrementally (resumable). Validates types, ranges, and mandatory-ness per the SME framework.
- **Extraction Service** — accepts uploaded PDFs/XLSX (audited financials, incorporation docs, cap table, litigation register). Uses a real parse pipeline (see §5) → LLM structured-extraction → normalised entities. Always surfaces extracted values for promoter confirmation before use.
- **Retrieval Service** — RAG over the embedded regulatory corpus (ICDR Regulations, SME DRHP template/checklist, 2–3 reference DRHPs). Returns the specific requirement clauses relevant to each section so generation is grounded and citable.
- **Generation Orchestrator** — the agentic core. For each DRHP section: assembles (issuer data + retrieved requirements + section template) → prompts the LLM → produces draft prose + a provenance record + a per-requirement coverage map. Runs sections in dependency order (e.g. Capital Structure before Basis for Issue Price).
- **Gap & Consistency Engine** — two layers: (a) **rule-based** coverage check against the SME requirement checklist (is each mandatory disclosure present and non-empty?); (b) **cross-section reconciliation** (do share-capital figures agree across cap structure, financials, and objects; do totals foot; are dates consistent). Emits actionable flags with severity.
- **Review Service** — intermediary console: per-section status (draft / needs-changes / approved), threaded comments, inline edits, immutable audit trail of who changed/approved what and when.
- **Export Service** — deterministic DOCX (via `docx`) and PDF renderers producing SEBI-style formatting; watermarks "DRAFT — FOR AUTHORISED INTERMEDIARY REVIEW" until fully approved; emits a coverage report (JSON + human-readable) mapping every requirement to its status and evidence.

### 2.3 Trust & human-in-the-loop
- Extracted figures require promoter confirmation before they enter the draft.
- Generated sections are never auto-final; they enter the reviewer queue.
- No export is un-watermarked without recorded intermediary approval of all mandatory sections.

---

## 3. Tech stack (confirmed defaults)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 14+ (App Router) + TypeScript (strict)** | Server actions + route handlers; RSC where sensible |
| Styling/UI | **Tailwind CSS + shadcn/ui** | Accessible components; see `frontend-design` skill for tokens |
| DB | **Postgres via Supabase** + **pgvector** | App data + corpus embeddings in one place |
| Auth | **Supabase Auth** | Email/password + magic link; row-level security |
| Storage | **Supabase Storage** | Uploaded source docs + generated exports; signed URLs |
| LLM | **Groq LLM API (OpenAI-compatible)** | Drafting: `openai/gpt-oss-20b`; hard reasoning/gap analysis: `openai/gpt-oss-120b`. Model IDs in env, swappable. |
| Embeddings | Provider-hosted embedding model (configurable) → pgvector | For RAG over the corpus |
| Doc parsing | `unpdf`/`pdf-parse` + `xlsx` (SheetJS) + LLM structured extraction | Real parse, no OCR assumption for v1 (digital PDFs); OCR path documented |
| DOCX export | `docx` (npm) | Deterministic, template-driven |
| PDF export | Server-side render of the DOCX/HTML → PDF (`puppeteer` or `docx`→PDF) | Watermarking supported |
| Validation | `zod` end-to-end | Shared schemas client + server |
| Testing | **Vitest** (unit) + **Playwright** (E2E) | E2E is part of Definition of Done |
| Jobs | Next.js route handlers + a lightweight queue (DB-backed) | Long generations run as tracked jobs with progress |
| Hosting | **Vercel** (demo) | Production path to AWS Mumbai / MeitY-empanelled region documented in §8 |
| Repo | Single repo in **scaiorg** GitHub org | Monorepo-lite; one Next.js app + `/packages` for shared types |

---

## 4. Data model & domain

### 4.1 Core entities (Postgres)

- `users` (Supabase auth) — roles: `promoter`, `intermediary`, `admin`.
- `ipo_projects` — one per issuer engagement; owner = promoter; assigned intermediary; status; target board (BSE_SME).
- `issuer_profile` — company identity, incorporation, registered office, sector, group structure.
- `intake_answers` — normalised key/value per project, versioned; links to the question that produced them.
- `uploaded_documents` — file metadata, type, storage path, parse status.
- `extracted_entities` — structured outputs from parsing (financial line items, cap table rows, litigation items, KMP, promoters), each with `confirmed_by_promoter` flag + source doc reference.
- `financial_statements` — normalised P&L, balance sheet, cash flow, restated financials per period.
- `capital_structure` — pre/post issue share capital, shareholding pattern, history of allotments.
- `offer_details` — issue type, fresh issue / OFS split, objects of the issue, deployment schedule.
- `drhp_sections` — one row per section per project: status, current draft (rich text/markdown), template version.
- `section_provenance` — for each section: which intake fields + which corpus citations produced it.
- `requirement_checklist` — the SME/ICDR requirement catalogue (seeded); each item mapped to a section.
- `requirement_coverage` — per project × requirement: status (covered / partial / missing / n-a), evidence pointer.
- `gap_flags` — open issues: type (missing | inconsistent | unaddressed), severity, section, message, resolution status.
- `review_events` — immutable audit log: actor, action, section, before/after ref, timestamp, comment.
- `corpus_documents` + `corpus_chunks` (with `embedding vector`) — the regulatory knowledge base.
- `generation_jobs` — async generation tracking: state, progress, section, model used, token usage.

### 4.2 The regulatory corpus (seeded, versioned)
- **SEBI ICDR Regulations** (public) — the disclosure obligations.
- **SME IPO framework / standardised DRHP template & checklist** (public).
- **2–3 real filed SME DRHPs** (public, from BSE SME) — used as *structure and style* references, chunked and embedded. (These inform structure/tone; they are never copied — generation is grounded in the issuer's own data.)
- Corpus is versioned so a re-run is reproducible; each chunk retains source + section tag for citation.

### 4.3 DRHP sections to generate (ICDR Part A — material set, v1)
Cover page & general info · Definitions & abbreviations · Risk factors · Introduction (summary of industry/business/offer) · General information · Capital structure · Objects of the issue · Basis for issue price · Statement of special tax benefits · Industry overview · Business overview · Key regulations & policies · History & corporate structure · Management (board & KMP) · Promoters & promoter group · Group companies · Related-party transactions · Dividend policy · Financial information (restated) · Management discussion & analysis · Legal proceedings & material developments · Government & statutory approvals · Other regulatory & statutory disclosures · Offer-related information (structure, terms, procedure) · Main provisions of Articles of Association · Material contracts & documents for inspection · Declaration.

> The exact catalogue is encoded in the seeded `requirement_checklist` derived from the current SME framework — the list above is the working set the checklist must cover. Agents must derive the authoritative list from the seeded checklist, not hardcode this prose.

---

## 5. Document extraction pipeline (real, not stubbed)

1. Upload → store → detect type (PDF/XLSX) → record `parse status = pending`.
2. **Text/table extraction**: digital PDFs via `unpdf`/`pdf-parse`; spreadsheets via SheetJS. (Scanned-PDF OCR is a documented v2 path; v1 assumes digital audited statements, which is the norm.)
3. **Structured extraction**: extracted text/tables + a section-specific schema (zod) → LLM structured-output call → typed entities (e.g. restated P&L line items, cap-table rows).
4. **Confirmation**: entities are shown to the promoter with the source snippet; promoter confirms or corrects. Only confirmed entities feed generation.
5. **Reconciliation hooks**: confirmed financial entities feed the consistency engine (§2.2) so cross-section checks are real.

---

## 6. Generation pipeline (agentic, grounded)

For each section, in dependency order:
1. **Assemble context**: confirmed issuer data relevant to the section + retrieved requirement clauses (Retrieval Service) + section template + style reference.
2. **Draft**: the LLM generates disclosure prose constrained to the supplied facts; instructed to emit `[[GAP: <what's missing>]]` markers rather than invent unknowns.
3. **Coverage map**: model returns which checklist requirements it addressed; Gap Engine verifies independently (never trust the model's self-report alone).
4. **Provenance**: persist which intake fields + which corpus citations produced the section.
5. **Queue for review**: section enters reviewer console as `draft`.
6. **Progress**: `generation_jobs` streams progress to the UI (real-time), section by section.

Model routing: default `openai/gpt-oss-20b` for narrative sections; escalate to `openai/gpt-oss-120b` for reasoning-heavy sections (Basis for Issue Price, Risk Factors prioritisation, MD&A). Configurable via env.

---

## 7. External data adapters (the honesty layer)

Some inputs (MCA company master, GST, credit/financial-bureau data) require regulated/paid API access we may not have during the sprint. To honour "everything works, no fake data":

- Define a typed **adapter interface** per source, e.g. `CompanyMasterProvider`, `GstProvider`.
- **Default implementation = a real path**, not a stub:
  - `CompanyMasterProvider.default` → promoter uploads the incorporation certificate / MoA-AoA; Extraction Service parses real values. (Real data, from a real document.)
  - Where an official free public lookup exists, implement it as a real HTTP call.
- **Credentialed implementations** (e.g. a licensed MCA API) drop in behind the same interface when a key is provided via env — no code change elsewhere.
- **Forbidden:** an adapter that returns invented constants. If no real source and no upload, the field is surfaced as a **gap flag**, never fabricated.

This keeps the running app fully functional on real inputs today, and API-ready the moment credentials exist.

---

## 8. Environments, security, hosting

- **Secrets** in env only (`.env.local` dev, Vercel/host env prod). Never commit keys. `GROQ_API_KEY`, Supabase URL/keys, embedding key, model IDs.
- **Auth & isolation**: Supabase RLS so a promoter sees only their projects; intermediaries see only assigned projects; audit log immutable.
- **PII & data localization**: uploaded financials and promoter data are sensitive. Demo runs on Vercel; production section documents the India-region path (Supabase India region / AWS Mumbai, MeitY-empanelled) per SEBI's cyber-resilience and localization expectations. No user data in URLs/query strings.
- **No auto-submission** to any regulator/exchange, by design.
- **Rate/limit handling**: LLM calls wrapped with retry/backoff; token usage tracked per job.

---

## 9. Phased build (each phase ends production-ready, not "to be finished later")

- **Phase 0 — Foundation.** Repo, Next.js+TS strict, Tailwind+shadcn, Supabase project, schema migrations, auth with roles, RLS, CI (typecheck+lint+test), env wiring, health checks. *Exit:* a signed-in promoter can create an empty IPO project persisted in Postgres, on a deployed URL.
- **Phase 1 — Corpus & retrieval.** Ingest + chunk + embed ICDR / SME framework / reference DRHPs into pgvector. Retrieval Service returns relevant requirement clauses for a given section. Seed `requirement_checklist`. *Exit:* querying a section returns correct, cited requirement clauses, verified against the source.
- **Phase 2 — Intake & extraction.** Dynamic guided interview persisted + resumable; document upload; real parse → LLM structured extraction → promoter confirmation. *Exit:* a promoter completes intake, uploads real audited financials, and confirms correctly-extracted structured entities.
- **Phase 3 — Generation.** Orchestrator drafts all §4.3 sections grounded + provenance-tracked, with live progress. *Exit:* a full draft is generated for the sample issuer from real intake, every section grounded and traceable, gaps marked not invented.
- **Phase 4 — Gap & consistency engine.** Rule-based coverage + cross-section reconciliation; actionable flags with jump-to-fix; coverage report. *Exit:* engine correctly flags a deliberately-omitted disclosure and a deliberately-inconsistent figure, and passes clean on a complete consistent draft.
- **Phase 5 — Reviewer workflow.** Intermediary console, comments, edits, per-section approval, immutable audit trail, watermark gating. *Exit:* an intermediary can review, comment, edit, approve, and only then unlock an un-watermarked export; every action is in the audit log.
- **Phase 6 — Export.** DOCX + PDF SEBI-style formatting, watermark logic, coverage report export. *Exit:* export opens correctly in Word and a PDF viewer, formatting intact, watermark correct per approval state.
- **Phase 7 — Hardening & demo.** E2E happy-path + edge cases green in CI; error states; empty/loading/failure UI; seed the demo issuer; performance pass on generation; deployed, stable, no dead ends. *Exit:* full journey runs end to end on the deployed URL against live services.

Definition of Done for the whole project = Phase 7 exit criteria all green **and** every task in `TASKS.md` checked with its acceptance criteria verified.

---

## 10. Metrics to show the jury (build these into the app)
- **Time-to-draft**: wall-clock from intake-complete to full draft generated.
- **Coverage %**: requirements covered / total applicable, from the coverage report.
- **Gaps caught**: count + list of missing/inconsistent items surfaced.
- **Grounding**: every section links to its provenance (intake fields + citations) — demonstrable live.
- **Before/after narrative**: manual DRHP drafting takes months and heavy intermediary involvement; show the same reaching a reviewable draft in one session, with the intermediary preserved as reviewer.

---

## 11. Explicit anti-patterns (auto-fail on review)
- Hardcoded financial/company values presented as if computed or fetched.
- `TODO`, `mock`, or `stub` left in a production code path.
- A section marked "generated" that wasn't grounded in real intake + retrieval.
- Any export path that bypasses the intermediary approval gate.
- Any code that submits to a regulator/exchange.
- Marking a `TASKS.md` item done without running and passing its acceptance criteria.
- Swallowing LLM/API errors silently instead of surfacing + retrying.
