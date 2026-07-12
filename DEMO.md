# Sulekh — Demo Script

A cold, end-to-end run for the jury. Target: **intake → confirmed data → generated draft → gaps → intermediary review → watermarked/final export**, showing grounding and the human-in-the-loop gates.

> Prerequisite (one-time): real services configured (`GROQ_API_KEY`, `EMBEDDINGS_API_KEY`, cloud Supabase, Vercel) per `START.md`, then:
> ```
> pnpm db:migrate && pnpm seed:corpus && pnpm embed:corpus && pnpm seed:checklist && pnpm seed:sample-issuer
> ```

## Metrics to call out (IMPLEMENTATION_PLAN §10)
- **Time-to-draft** — wall-clock from "Generate" to full draft (progress streams section-by-section).
- **Coverage %** — from the coverage report, computed from real data.
- **Gaps caught** — count + list of missing/inconsistent items surfaced.
- **Grounding** — every section links to its provenance (intake fields + citations); GAPs are marked, never invented.

## Script (≈8 minutes)

1. **Sign in** as a promoter. Open the seeded **DemoTech Manufacturing Limited (SAMPLE)** project (or create a fresh one to show intake).
2. **Guided intake** — show the branching questionnaire (manufacturing + fresh-issue branch), autosave, and the required-progress bar. (Sample issuer is pre-filled.)
3. **Documents & extraction** — upload a real audited-financials PDF and a cap-table XLSX. Click **Extract**: Claude returns structured entities with a source snippet. **Confirm** (and optionally **Correct**) each — stress that *only confirmed values feed generation*.
4. **Generate draft** — click **Generate**. Watch progress advance section-by-section in dependency order (Capital Structure before Basis for Issue Price). Note the model per section (drafting vs reasoning).
5. **Gaps & coverage** — show coverage %, the requirement table, and flags: a **missing mandatory** blocker and an **inconsistent figure** naming the conflicting sections. Click **Fix →** to jump to the source; fix; **Re-run checks**; the flag clears. Download the **coverage report JSON**.
6. **Intermediary review** — sign in as the assigned intermediary. Comment on a section, make an inline edit, set statuses, and **Approve** each mandatory section. Show the **append-only audit trail**.
7. **Export** — before full approval, download the **watermarked** DOCX/PDF ("DRAFT — FOR AUTHORISED INTERMEDIARY REVIEW"). After all mandatory sections are approved, the gate unlocks and the export is **un-watermarked (final)**.

## The one-liner
Manual DRHP drafting takes months of heavy intermediary involvement; Sulekh reaches a reviewable, grounded draft in one session — with the intermediary preserved as the reviewer, not replaced.
