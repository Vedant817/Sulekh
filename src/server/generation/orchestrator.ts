import type { Sql } from "postgres";

import { checkCoverage, parseGapMarkers, type RequirementRef } from "@/server/generation/coverage";
import { modelKindForSection } from "@/server/generation/model-routing";
import { generationOrder, type CatalogSection } from "@/server/generation/sections";

/**
 * Generation Orchestrator. For each DRHP section, in dependency order, it
 * assembles grounding context (confirmed issuer data + the section's governing
 * requirements), asks a drafter to produce prose, then INDEPENDENTLY verifies
 * coverage and gaps — persisting the draft, its provenance, per-requirement
 * coverage, and gap flags, while streaming progress via generation_jobs.
 *
 * The drafter is injected so the whole pipeline is testable without a live LLM;
 * production passes the Groq-backed drafter (groq-drafter.ts).
 */

export type SectionRequirement = RequirementRef & {
  id: string;
  description: string | null;
  citation: string;
};

export type DrafterInput = {
  sectionKey: string;
  sectionTitle: string;
  modelKind: "drafting" | "reasoning";
  requirements: SectionRequirement[];
  intake: Record<string, unknown>;
  entities: { entityType: string; value: unknown }[];
};

export type DrafterOutput = {
  markdown: string;
  addressedCodes: string[];
  modelId: string;
  promptTokens: number;
  completionTokens: number;
};

export type SectionDrafter = (input: DrafterInput) => Promise<DrafterOutput>;

async function loadIntake(sql: Sql, projectId: string): Promise<Record<string, unknown>> {
  const rows = await sql<{ answer_key: string; value: unknown; version: number }[]>`
    select answer_key, value, version from public.intake_answers
    where project_id = ${projectId} order by version desc`;
  const latest: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const r of rows) {
    if (!seen.has(r.answer_key)) {
      seen.add(r.answer_key);
      latest[r.answer_key] = r.value;
    }
  }
  return latest;
}

async function loadConfirmedEntities(
  sql: Sql,
  projectId: string,
): Promise<{ entityType: string; value: unknown }[]> {
  const rows = await sql<{ entity_type: string; data: unknown; corrected_data: unknown }[]>`
    select entity_type, data, corrected_data from public.extracted_entities
    where project_id = ${projectId} and confirmed_by_promoter = true`;
  return rows.map((r) => ({ entityType: r.entity_type, value: r.corrected_data ?? r.data }));
}

async function loadCatalog(sql: Sql): Promise<(CatalogSection & { title: string; mandatory: boolean })[]> {
  return sql<{ sectionKey: string; ordinal: number; title: string; mandatory: boolean }[]>`
    select section_key as "sectionKey", ordinal, title, mandatory
    from public.drhp_section_catalog order by ordinal`;
}

async function loadRequirementsBySection(
  sql: Sql,
): Promise<Map<string, SectionRequirement[]>> {
  const rows = await sql<
    {
      id: string;
      section_key: string;
      code: string;
      title: string;
      description: string | null;
      mandatory: boolean;
      source_citation: string;
    }[]
  >`select id, code, title, description, mandatory, source_citation
    , section_key from public.requirement_checklist order by section_key, ordinal`;
  const bySection = new Map<string, SectionRequirement[]>();
  for (const row of rows) {
    const requirements = bySection.get(row.section_key) ?? [];
    requirements.push({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      mandatory: row.mandatory,
      citation: row.source_citation,
    });
    bySection.set(row.section_key, requirements);
  }
  return bySection;
}

export type GenerationResult = {
  jobId: string;
  sectionsGenerated: string[];
  totalGaps: number;
  totalOverclaims: number;
};

/** Create a queued generation job up front so the UI can track it immediately. */
export async function createGenerationJob(sql: Sql, projectId: string): Promise<string> {
  const catalog = await loadCatalog(sql);
  const [job] = await sql<{ id: string }[]>`
    insert into public.generation_jobs (project_id, state, total_sections)
    values (${projectId}, 'queued', ${catalog.length})
    returning id`;
  return job.id;
}

/**
 * Run a full-draft generation for a project. Returns the job id and a summary.
 * On failure the job is marked failed and the error is rethrown (never swallowed).
 * Pass an existing `jobId` to resume/attach to a pre-created (queued) job.
 */
export async function generateDraft(
  sql: Sql,
  projectId: string,
  drafter: SectionDrafter,
  opts: { jobId?: string } = {},
): Promise<GenerationResult> {
  const catalog = await loadCatalog(sql);
  if (catalog.length === 0) throw new Error("Section catalogue is empty — run seed:checklist.");
  const order = generationOrder(catalog.map((c) => ({ sectionKey: c.sectionKey, ordinal: c.ordinal })));
  const meta = new Map(catalog.map((c) => [c.sectionKey, c]));

  let jobId: string;
  if (opts.jobId) {
    jobId = opts.jobId;
    await sql`update public.generation_jobs
      set state = 'running', total_sections = ${order.length}, current_section = ${order[0] ?? null},
          completed_sections = 0, progress = 0, error = null
      where id = ${jobId}`;
  } else {
    const [job] = await sql<{ id: string }[]>`
      insert into public.generation_jobs (project_id, state, total_sections, current_section)
      values (${projectId}, 'running', ${order.length}, ${order[0] ?? null})
      returning id`;
    jobId = job.id;
  }

  try {
    const intake = await loadIntake(sql, projectId);
    const entities = await loadConfirmedEntities(sql, projectId);
    const requirementsBySection = await loadRequirementsBySection(sql);

    const sectionsGenerated: string[] = [];
    let totalGaps = 0;
    let totalOverclaims = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    for (let i = 0; i < order.length; i++) {
      const sectionKey = order[i];
      const info = meta.get(sectionKey)!;
      const requirements = requirementsBySection.get(sectionKey) ?? [];
      const modelKind = modelKindForSection(sectionKey);

      const out = await drafter({
        sectionKey,
        sectionTitle: info.title,
        modelKind,
        requirements,
        intake,
        entities,
      });
      promptTokens += out.promptTokens;
      completionTokens += out.completionTokens;

      // Independent coverage verification (never trust the model's self-report).
      const coverage = checkCoverage(out.markdown, requirements, out.addressedCodes);
      const requirementsByCode = new Map(requirements.map((requirement) => [requirement.code, requirement]));
      const coverageRows = coverage.map((item) => ({
        requirement_id: requirementsByCode.get(item.code)!.id,
        status: item.status,
        evidence: {
          claimedByModel: item.claimedByModel,
          present: item.present,
          overclaimed: item.overclaimed,
          section: sectionKey,
        },
      }));

      // Gap flags: explicit [[GAP]] markers, missing mandatory requirements, and over-claims.
      const gapMarkers = parseGapMarkers(out.markdown);
      const gapRows: {
        flag_type: "missing" | "unaddressed";
        severity: "warning" | "blocker";
        section_key: string;
        field_key: string | null;
        message: string;
        details: Record<string, unknown>;
      }[] = gapMarkers.map((gap) => ({
        flag_type: "missing",
        severity: "warning",
        section_key: sectionKey,
        field_key: null,
        message: `Gap noted by drafter: ${gap}`,
        details: { source: "gap_marker" },
      }));
      totalGaps += gapMarkers.length;
      for (const c of coverage) {
        const req = requirementsByCode.get(c.code)!;
        if (c.status === "missing" && req.mandatory) {
          gapRows.push({
            flag_type: c.overclaimed ? "unaddressed" : "missing",
            severity: "blocker",
            section_key: sectionKey,
            field_key: c.code,
            message: `Mandatory requirement ${c.code} (${req.title}) not covered${c.overclaimed ? " despite model claim" : ""}.`,
            details: { source: "coverage_check", overclaimed: c.overclaimed },
          });
          totalGaps += 1;
          if (c.overclaimed) totalOverclaims += 1;
        }
      }

      sectionsGenerated.push(sectionKey);
      const intakeKeys = Object.keys(intake);
      const provenanceNotes = `model=${out.modelId}; requirements=${requirements.map((r) => r.code).join(",")}`;

      // Persist one section atomically in one round-trip. Keeping the job update
      // in the same statement preserves section-by-section visible progress,
      // while avoiding hundreds of sequential calls through a cloud pooler.
      await sql`
        with upserted_section as (
          insert into public.drhp_sections
            (project_id, section_key, title, ordinal, status, draft_markdown, model_used, is_mandatory)
          values (${projectId}, ${sectionKey}, ${info.title}, ${info.ordinal}, 'draft',
                  ${out.markdown}, ${out.modelId}, ${info.mandatory})
          on conflict (project_id, section_key) do update
            set status = 'draft', draft_markdown = excluded.draft_markdown,
                model_used = excluded.model_used, title = excluded.title, ordinal = excluded.ordinal
          returning id
        ), deleted_provenance as (
          delete from public.section_provenance
          where section_id = (select id from upserted_section)
        ), inserted_provenance as (
          insert into public.section_provenance
            (section_id, project_id, intake_field_keys, entity_ids, notes)
          select id, ${projectId}, ${sql.array(intakeKeys)}, ${sql.array([])}, ${provenanceNotes}
          from upserted_section
        ), coverage_input as (
          select * from jsonb_to_recordset(${sql.json(coverageRows)}::jsonb)
            as row(requirement_id uuid, status text, evidence jsonb)
        ), upserted_coverage as (
          insert into public.requirement_coverage (project_id, requirement_id, status, evidence)
          select ${projectId}, requirement_id, status::public.coverage_status, evidence
          from coverage_input
          on conflict (project_id, requirement_id) do update
            set status = excluded.status, evidence = excluded.evidence, updated_at = now()
        ), gap_input as (
          select * from jsonb_to_recordset(${sql.json(gapRows as never)}::jsonb)
            as row(flag_type text, severity text, section_key text, field_key text, message text, details jsonb)
        ), inserted_gaps as (
          insert into public.gap_flags
            (project_id, flag_type, severity, section_key, field_key, message, details)
          select ${projectId}, flag_type::public.gap_type, severity::public.gap_severity,
                 section_key, field_key, message, details
          from gap_input
        )
        update public.generation_jobs
        set current_section = ${order[i + 1] ?? null}, state = 'running',
            completed_sections = ${i + 1},
            progress = ${Math.round(((i + 1) / order.length) * 100)},
            prompt_tokens = ${promptTokens}, completion_tokens = ${completionTokens},
            model_used = ${out.modelId}
        where id = ${jobId}`;
    }

    await sql`update public.generation_jobs
      set state = 'succeeded', progress = 100, current_section = null where id = ${jobId}`;

    return { jobId, sectionsGenerated, totalGaps, totalOverclaims };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await sql`update public.generation_jobs set state = 'failed', error = ${message} where id = ${jobId}`;
    throw err;
  }
}
