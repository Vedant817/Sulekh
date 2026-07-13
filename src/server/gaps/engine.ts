import type { Sql } from "postgres";

import { checkCoverage, type CoverageStatus, type RequirementRef } from "@/server/generation/coverage";
import { reconcile, type ReconInput } from "@/server/gaps/reconciliation";

/**
 * Gap & Consistency Engine. Runs two independent layers over the current draft:
 *  (a) rule-based coverage — is every mandatory requirement present and non-empty
 *      in its section? and
 *  (b) cross-section reconciliation — do the numbers agree across sections?
 * Persists per-requirement coverage and actionable gap flags (idempotent: the
 * engine owns flags tagged `details.engine=true` and replaces them each run).
 */

type ReqRow = RequirementRef & { id: string; sectionKey: string };

export type CoverageAssessment = {
  requirementId: string;
  code: string;
  sectionKey: string;
  status: CoverageStatus;
  mandatory: boolean;
};

/** Pure: assess each requirement against the drafted section text it maps to. */
export function assessCoverage(
  requirements: ReqRow[],
  sectionMarkdownByKey: Map<string, string>,
): CoverageAssessment[] {
  const bySection = new Map<string, ReqRow[]>();
  for (const r of requirements) {
    const list = bySection.get(r.sectionKey) ?? [];
    list.push(r);
    bySection.set(r.sectionKey, list);
  }

  const out: CoverageAssessment[] = [];
  for (const [sectionKey, reqs] of bySection) {
    const md = sectionMarkdownByKey.get(sectionKey);
    if (!md || md.trim().length === 0) {
      // No draft for this section → every requirement is missing.
      for (const r of reqs) {
        out.push({ requirementId: r.id, code: r.code, sectionKey, status: "missing", mandatory: r.mandatory });
      }
      continue;
    }
    const results = checkCoverage(md, reqs, []); // rule-based: no model claims
    for (const c of results) {
      const r = reqs.find((x) => x.code === c.code)!;
      out.push({ requirementId: r.id, code: c.code, sectionKey, status: c.status, mandatory: r.mandatory });
    }
  }
  return out;
}

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

function num(v: unknown): number | null {
  return typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : null;
}

async function buildReconInput(sql: Sql, projectId: string): Promise<ReconInput> {
  const intake = await loadIntake(sql, projectId);
  const capRows = await sql<{ value: unknown }[]>`
    select coalesce(corrected_data, data) as value from public.extracted_entities
    where project_id = ${projectId} and confirmed_by_promoter = true and entity_type = 'cap_table_row'`;
  const capTable = capRows.map((r) => {
    const v = (r.value ?? {}) as Record<string, unknown>;
    return { holder: String(v.holder_name ?? ""), shares: num(v.shares), percentage: num(v.percentage) };
  });

  const [capStruct] = await sql<{ pre_issue_capital: number | null }[]>`
    select pre_issue_capital from public.capital_structure where project_id = ${projectId} limit 1`;
  const [offer] = await sql<{ objects: unknown; fresh_issue_amount: number | null }[]>`
    select objects, fresh_issue_amount from public.offer_details where project_id = ${projectId} limit 1`;

  const offerObjects = Array.isArray(offer?.objects)
    ? (offer!.objects as Record<string, unknown>[]).map((o) => ({
        label: String(o.label ?? o.name ?? ""),
        amount: num(o.amount),
      }))
    : [];

  return {
    intake: {
      faceValue: num(intake.face_value),
      preIssueShares: num(intake.pre_issue_shares),
      freshIssueAmount: num(intake.fresh_issue_amount),
      netWorth: num(intake.net_worth),
    },
    capTable,
    capitalStructure: capStruct ? { preIssueCapital: capStruct.pre_issue_capital } : null,
    offer: offer ? { objects: offerObjects, freshIssueAmount: offer.fresh_issue_amount } : null,
  };
}

export type GapEngineResult = {
  covered: number;
  partial: number;
  missing: number;
  missingMandatory: number;
  inconsistencies: number;
};

export async function runGapEngine(sql: Sql, projectId: string): Promise<GapEngineResult> {
  const requirements = await sql<
    { id: string; code: string; title: string; mandatory: boolean; sectionKey: string }[]
  >`select id, code, title, mandatory, section_key as "sectionKey" from public.requirement_checklist`;

  const sections = await sql<{ section_key: string; draft_markdown: string | null }[]>`
    select section_key, draft_markdown from public.drhp_sections where project_id = ${projectId}`;
  const mdByKey = new Map(sections.map((s) => [s.section_key, s.draft_markdown ?? ""]));

  const coverage = assessCoverage(requirements as ReqRow[], mdByKey);
  const reconInput = await buildReconInput(sql, projectId);
  const findings = reconcile(reconInput);

  // Persist coverage + engine-owned gap flags atomically.
  await sql.begin(async (tx) => {
    for (const c of coverage) {
      await tx`insert into public.requirement_coverage (project_id, requirement_id, status, evidence)
        values (${projectId}, ${c.requirementId}, ${c.status}, ${tx.json({ engine: true, sectionKey: c.sectionKey })})
        on conflict (project_id, requirement_id) do update
          set status = excluded.status, evidence = excluded.evidence, updated_at = now()`;
    }

    // Replace engine-owned flags (idempotent re-check).
    await tx`delete from public.gap_flags where project_id = ${projectId} and details->>'engine' = 'true'`;

    for (const c of coverage) {
      if (c.status !== "covered" && c.mandatory) {
        await tx`insert into public.gap_flags (project_id, flag_type, severity, section_key, field_key, message, details)
          values (${projectId}, 'missing', 'blocker', ${c.sectionKey}, ${c.code},
                  ${`Mandatory disclosure ${c.code} is missing or incomplete in "${c.sectionKey}".`},
                  ${tx.json({ engine: true, kind: "coverage" })})`;
      }
    }
    for (const f of findings) {
      await tx`insert into public.gap_flags (project_id, flag_type, severity, section_key, message, details)
        values (${projectId}, 'inconsistent', ${f.severity}, ${f.sections[0] ?? null}, ${f.message},
                ${tx.json({ engine: true, kind: "reconciliation", code: f.code, sections: f.sections, ...f.details })})`;
    }
  });

  const missingMandatory = coverage.filter((c) => c.status !== "covered" && c.mandatory).length;
  return {
    covered: coverage.filter((c) => c.status === "covered").length,
    partial: coverage.filter((c) => c.status === "partial").length,
    missing: coverage.filter((c) => c.status === "missing").length,
    missingMandatory,
    inconsistencies: findings.length,
  };
}
