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
 * production passes the Claude-backed drafter (claude-drafter.ts).
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

async function loadRequirements(sql: Sql, sectionKey: string): Promise<SectionRequirement[]> {
  const rows = await sql<
    { id: string; code: string; title: string; description: string | null; mandatory: boolean; source_citation: string }[]
  >`select id, code, title, description, mandatory, source_citation
    from public.requirement_checklist where section_key = ${sectionKey} order by ordinal`;
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    mandatory: r.mandatory,
    citation: r.source_citation,
  }));
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

    const sectionsGenerated: string[] = [];
    let totalGaps = 0;
    let totalOverclaims = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    for (let i = 0; i < order.length; i++) {
      const sectionKey = order[i];
      const info = meta.get(sectionKey)!;
      const requirements = await loadRequirements(sql, sectionKey);
      const modelKind = modelKindForSection(sectionKey);

      await sql`update public.generation_jobs
        set current_section = ${sectionKey}, state = 'running' where id = ${jobId}`;

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

      // Persist the section draft.
      const [section] = await sql<{ id: string }[]>`
        insert into public.drhp_sections
          (project_id, section_key, title, ordinal, status, draft_markdown, model_used, is_mandatory)
        values (${projectId}, ${sectionKey}, ${info.title}, ${info.ordinal}, 'draft',
                ${out.markdown}, ${out.modelId}, ${info.mandatory})
        on conflict (project_id, section_key) do update
          set status = 'draft', draft_markdown = excluded.draft_markdown,
              model_used = excluded.model_used, title = excluded.title, ordinal = excluded.ordinal
        returning id`;

      // Provenance: which intake fields + entities produced this section.
      const intakeKeys = Object.keys(intake);
      await sql`delete from public.section_provenance where section_id = ${section.id}`;
      await sql`insert into public.section_provenance
          (section_id, project_id, intake_field_keys, entity_ids, notes)
        values (${section.id}, ${projectId}, ${sql.array(intakeKeys)}, ${sql.array([])},
                ${`model=${out.modelId}; requirements=${requirements.map((r) => r.code).join(",")}`})`;

      // Independent coverage verification (never trust the model's self-report).
      const coverage = checkCoverage(out.markdown, requirements, out.addressedCodes);
      for (const c of coverage) {
        const req = requirements.find((r) => r.code === c.code)!;
        await sql`insert into public.requirement_coverage
            (project_id, requirement_id, status, evidence)
          values (${projectId}, ${req.id}, ${c.status},
                  ${sql.json({ claimedByModel: c.claimedByModel, present: c.present, overclaimed: c.overclaimed, section: sectionKey })})
          on conflict (project_id, requirement_id) do update
            set status = excluded.status, evidence = excluded.evidence, updated_at = now()`;
      }

      // Gap flags: explicit [[GAP]] markers, missing mandatory requirements, and over-claims.
      const gapMarkers = parseGapMarkers(out.markdown);
      for (const g of gapMarkers) {
        await sql`insert into public.gap_flags (project_id, flag_type, severity, section_key, message, details)
          values (${projectId}, 'missing', 'warning', ${sectionKey}, ${`Gap noted by drafter: ${g}`},
                  ${sql.json({ source: "gap_marker" })})`;
        totalGaps += 1;
      }
      for (const c of coverage) {
        const req = requirements.find((r) => r.code === c.code)!;
        if (c.status === "missing" && req.mandatory) {
          await sql`insert into public.gap_flags (project_id, flag_type, severity, section_key, field_key, message, details)
            values (${projectId}, ${c.overclaimed ? "unaddressed" : "missing"}, 'blocker', ${sectionKey}, ${c.code},
                    ${`Mandatory requirement ${c.code} (${req.title}) not covered${c.overclaimed ? " despite model claim" : ""}.`},
                    ${sql.json({ source: "coverage_check", overclaimed: c.overclaimed })})`;
          totalGaps += 1;
          if (c.overclaimed) totalOverclaims += 1;
        }
      }

      sectionsGenerated.push(sectionKey);
      await sql`update public.generation_jobs
        set completed_sections = ${i + 1},
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
