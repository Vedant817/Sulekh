import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createIntegrationSql, type Sql } from "./db";

import { runGapEngine } from "@/server/gaps/engine";
import { buildCoverageReport } from "@/server/gaps/report";

/**
 * Gap & Consistency Engine, verified against the real DB (task 4.5 gate):
 * a "good" fully-covered consistent draft passes clean; a "bad" draft (an
 * omitted mandatory section + an inconsistent share figure) is flagged. Also
 * checks the coverage report reconciles with the flags (4.4). Requires a
 * migrated + seeded DB (seed:checklist).
 */
const TEST_DB = process.env.TEST_DATABASE_URL;

const OWNER = "c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9";
const PROJECT = "d9d9d9d9-d9d9-d9d9-d9d9-d9d9d9d9d9d9";

describe.skipIf(!TEST_DB)("Gap & consistency engine", () => {
  let sql: Sql;

  /** Seed a draft for every catalogue section whose text covers all its reqs. */
  async function seedFullyCoveredDraft() {
    const cat = await sql<{ section_key: string; title: string; ordinal: number }[]>`
      select section_key, title, ordinal from public.drhp_section_catalog`;
    for (const c of cat) {
      const reqs = await sql<{ title: string }[]>`
        select title from public.requirement_checklist where section_key = ${c.section_key}`;
      const md = `# ${c.title}\n\n` + reqs.map((r) => `## ${r.title}\n${r.title} is disclosed.`).join("\n\n");
      await sql`insert into public.drhp_sections (project_id, section_key, title, ordinal, status, draft_markdown)
        values (${PROJECT}, ${c.section_key}, ${c.title}, ${c.ordinal}, 'draft', ${md})
        on conflict (project_id, section_key) do update set draft_markdown = excluded.draft_markdown`;
    }
  }

  beforeAll(async () => {
    sql = createIntegrationSql(TEST_DB!);
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      await tx`delete from auth.users where id = ${OWNER}`;
    });
    await sql`insert into auth.users (id, email, raw_user_meta_data)
              values (${OWNER}, 'gap@example.com', ${sql.json({ role: "promoter" })})`;
    await sql`insert into public.ipo_projects (id, owner_id, name)
              values (${PROJECT}, ${OWNER}, 'Gap Engine Test')`;
    await seedFullyCoveredDraft();
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      await tx`delete from auth.users where id = ${OWNER}`;
    });
    await sql.end({ timeout: 5 });
  });

  it("passes clean on a complete, consistent draft (good fixture)", async () => {
    const result = await runGapEngine(sql, PROJECT);
    expect(result.missingMandatory).toBe(0);
    expect(result.inconsistencies).toBe(0);

    const report = await buildCoverageReport(sql, PROJECT);
    expect(report.totals.mandatoryMissing).toBe(0);
    expect(report.coveragePercent).toBeGreaterThan(90);
    // No open blocker gaps.
    expect(report.gaps.filter((g) => g.severity === "blocker")).toHaveLength(0);
  });

  it("flags an omitted mandatory disclosure as a blocker (4.1)", async () => {
    // Remove the risk-factors draft entirely.
    await sql`delete from public.drhp_sections where project_id = ${PROJECT} and section_key = 'risk-factors'`;
    const result = await runGapEngine(sql, PROJECT);
    expect(result.missingMandatory).toBeGreaterThan(0);

    const [{ blockers }] = await sql<{ blockers: number }[]>`
      select count(*)::int as blockers from public.gap_flags
      where project_id = ${PROJECT} and section_key = 'risk-factors'
        and severity = 'blocker' and flag_type = 'missing' and details->>'engine' = 'true'`;
    expect(blockers).toBeGreaterThan(0);

    // Coverage report totals reconcile with the flags (4.4).
    const report = await buildCoverageReport(sql, PROJECT);
    const reportBlockerCoverageGaps = report.gaps.filter(
      (g) => g.severity === "blocker" && g.flagType === "missing",
    ).length;
    expect(report.totals.mandatoryMissing).toBe(reportBlockerCoverageGaps);
  });

  it("flags an inconsistent share-capital figure naming the sections (4.2)", async () => {
    // Stated pre-issue shares = 1,000,000 but confirmed cap table sums to 900,000.
    await sql`insert into public.intake_answers (project_id, question_id, answer_key, value, version)
      values (${PROJECT}, 'pre_issue_shares', 'pre_issue_shares', ${sql.json(1_000_000)}, 1)`;
    await sql`insert into public.extracted_entities (project_id, entity_type, data, confirmed_by_promoter)
      values (${PROJECT}, 'cap_table_row', ${sql.json({ holder_name: "Promoter A", shares: 900_000, percentage: 100 })}, true)`;

    await runGapEngine(sql, PROJECT);
    const [flag] = await sql<{ message: string; details: { sections: string[] } }[]>`
      select message, details from public.gap_flags
      where project_id = ${PROJECT} and flag_type = 'inconsistent'
        and details->>'code' = 'RECON-SHARES'`;
    expect(flag).toBeDefined();
    expect(flag.details.sections).toContain("capital-structure");
    expect(flag.details.sections).toContain("general-information");
  });

  it("resolving the underlying issue clears the flag on re-check (4.3)", async () => {
    // The RECON-SHARES flag exists from the previous test. Fix the source data
    // (remove the inconsistent cap-table row) and re-run.
    await sql`delete from public.extracted_entities
      where project_id = ${PROJECT} and entity_type = 'cap_table_row'`;
    await runGapEngine(sql, PROJECT);
    const remaining = await sql`
      select 1 from public.gap_flags
      where project_id = ${PROJECT} and details->>'code' = 'RECON-SHARES'`;
    expect(remaining).toHaveLength(0);
  });

  it("re-check is idempotent for engine-owned flags", async () => {
    const before = await sql<{ n: number }[]>`
      select count(*)::int as n from public.gap_flags
      where project_id = ${PROJECT} and details->>'engine' = 'true'`;
    await runGapEngine(sql, PROJECT);
    const after = await sql<{ n: number }[]>`
      select count(*)::int as n from public.gap_flags
      where project_id = ${PROJECT} and details->>'engine' = 'true'`;
    expect(after[0].n).toBe(before[0].n);
  });
});
