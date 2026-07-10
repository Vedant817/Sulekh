import type { Sql } from "postgres";

/**
 * Machine-readable coverage report: every requirement mapped to its status +
 * evidence, with totals and a coverage % computed from real data. Totals
 * reconcile with the gap flags (missing mandatory == blocker coverage gaps).
 */

export type CoverageReportItem = {
  code: string;
  title: string;
  sectionKey: string;
  mandatory: boolean;
  status: string;
  citation: string;
};

export type CoverageReport = {
  totals: {
    total: number;
    covered: number;
    partial: number;
    missing: number;
    notApplicable: number;
    mandatory: number;
    mandatoryMissing: number;
  };
  coveragePercent: number;
  requirements: CoverageReportItem[];
  gaps: {
    flagType: string;
    severity: string;
    sectionKey: string | null;
    fieldKey: string | null;
    message: string;
  }[];
};

export async function buildCoverageReport(sql: Sql, projectId: string): Promise<CoverageReport> {
  const rows = await sql<
    {
      code: string;
      title: string;
      section_key: string;
      mandatory: boolean;
      citation: string;
      status: string | null;
    }[]
  >`
    select r.code, r.title, r.section_key, r.mandatory, r.source_citation as citation,
           rc.status
    from public.requirement_checklist r
    left join public.requirement_coverage rc
      on rc.requirement_id = r.id and rc.project_id = ${projectId}
    order by r.ordinal`;

  const requirements: CoverageReportItem[] = rows.map((r) => ({
    code: r.code,
    title: r.title,
    sectionKey: r.section_key,
    mandatory: r.mandatory,
    status: r.status ?? "missing",
    citation: r.citation,
  }));

  const total = requirements.length;
  const covered = requirements.filter((r) => r.status === "covered").length;
  const partial = requirements.filter((r) => r.status === "partial").length;
  const notApplicable = requirements.filter((r) => r.status === "not_applicable").length;
  const missing = requirements.filter((r) => r.status === "missing").length;
  const mandatory = requirements.filter((r) => r.mandatory).length;
  const mandatoryMissing = requirements.filter((r) => r.mandatory && r.status === "missing").length;
  const applicable = total - notApplicable;
  const coveragePercent = applicable === 0 ? 0 : Math.round((covered / applicable) * 1000) / 10;

  const gapRows = await sql<
    { flag_type: string; severity: string; section_key: string | null; field_key: string | null; message: string }[]
  >`select flag_type, severity, section_key, field_key, message
    from public.gap_flags where project_id = ${projectId} and status = 'open'
    order by case severity when 'blocker' then 0 when 'warning' then 1 else 2 end`;

  return {
    totals: { total, covered, partial, missing, notApplicable, mandatory, mandatoryMissing },
    coveragePercent,
    requirements,
    gaps: gapRows.map((g) => ({
      flagType: g.flag_type,
      severity: g.severity,
      sectionKey: g.section_key,
      fieldKey: g.field_key,
      message: g.message,
    })),
  };
}
