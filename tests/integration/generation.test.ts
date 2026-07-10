import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateDraft, type SectionDrafter } from "@/server/generation/orchestrator";
import { generationOrder } from "@/server/generation/sections";

/**
 * Verifies the Generation Orchestrator end-to-end against the real DB with an
 * injected (deterministic) drafter — covering dependency-ordered generation
 * (3.1), persisted provenance (3.1), independent coverage + over-claim → gap
 * flag (3.3), grounding gap markers (3.2), and job progress (3.4). The live
 * Claude drafter is exercised separately once a key exists. Requires
 * TEST_DATABASE_URL against a migrated + seeded DB (seed:checklist).
 */
const TEST_DB = process.env.TEST_DATABASE_URL;

const OWNER = "a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9";
const PROJECT = "b9b9b9b9-b9b9-b9b9-b9b9-b9b9b9b9b9b9";

describe.skipIf(!TEST_DB)("Generation orchestrator", () => {
  let sql: Sql;
  const order: string[] = [];

  // Deterministic drafter: covers most requirements, but deliberately OMITS one
  // mandatory requirement's topic while still CLAIMING it (to trigger the
  // independent over-claim catch), and emits a [[GAP]] marker.
  const fakeDrafter: SectionDrafter = async (input) => {
    order.push(input.sectionKey);
    const covered = input.requirements.filter((r) => r.code !== "CS-04");
    const body = covered.map((r) => `## ${r.title}\n${r.title} is disclosed for the issuer.`).join("\n\n");
    const gap = "\n\n[[GAP: shareholding pattern not provided by promoter]]";
    return {
      markdown: `# ${input.sectionTitle}\n\n${body}${gap}`,
      // Claim ALL codes including CS-04 (which we did not actually cover) → over-claim.
      addressedCodes: input.requirements.map((r) => r.code),
      modelId: input.modelKind === "reasoning" ? "test-reasoning" : "test-drafting",
      promptTokens: 100,
      completionTokens: 200,
    };
  };

  beforeAll(async () => {
    sql = postgres(TEST_DB!, { max: 1, ssl: false, onnotice: () => {} });
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      await tx`delete from auth.users where id = ${OWNER}`;
    });
    await sql`insert into auth.users (id, email, raw_user_meta_data)
              values (${OWNER}, 'gen@example.com', ${sql.json({ role: "promoter" })})`;
    await sql`insert into public.ipo_projects (id, owner_id, name)
              values (${PROJECT}, ${OWNER}, 'Generation Test')`;
    await sql`insert into public.intake_answers (project_id, question_id, answer_key, value, version)
              values (${PROJECT}, 'legal_name', 'legal_name', ${sql.json("Acme SME Ltd")}, 1)`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      await tx`delete from auth.users where id = ${OWNER}`;
    });
    await sql.end({ timeout: 5 });
  });

  it("generates all sections in dependency order and records a completed job", async () => {
    const result = await generateDraft(sql, PROJECT, fakeDrafter);

    // Dependency order respected (capital-structure before basis-for-issue-price).
    expect(order.indexOf("capital-structure")).toBeLessThan(order.indexOf("basis-for-issue-price"));
    expect(order.indexOf("financial-information")).toBeLessThan(order.indexOf("mda"));

    // Order matches the orchestrator's computed order.
    const catalog = await sql<{ sectionKey: string; ordinal: number }[]>`
      select section_key as "sectionKey", ordinal from public.drhp_section_catalog`;
    expect(order).toEqual(generationOrder(catalog));

    // Job completed with progress + token accounting.
    const [job] = await sql<{ state: string; progress: number; completed_sections: number; total_sections: number; prompt_tokens: number }[]>`
      select state, progress::int as progress, completed_sections, total_sections,
             prompt_tokens::int as prompt_tokens
      from public.generation_jobs where id = ${result.jobId}`;
    expect(job.state).toBe("succeeded");
    expect(job.progress).toBe(100);
    expect(job.completed_sections).toBe(job.total_sections);
    expect(job.prompt_tokens).toBeGreaterThan(0);
  });

  it("persists a draft + provenance for every section", async () => {
    const [{ sections }] = await sql<{ sections: number }[]>`
      select count(*)::int as sections from public.drhp_sections where project_id = ${PROJECT}`;
    const [{ provenance }] = await sql<{ provenance: number }[]>`
      select count(*)::int as provenance from public.section_provenance where project_id = ${PROJECT}`;
    expect(sections).toBeGreaterThan(0);
    expect(provenance).toBe(sections);

    // Provenance references the intake field that was present.
    const [prov] = await sql<{ intake_field_keys: string[] }[]>`
      select intake_field_keys from public.section_provenance where project_id = ${PROJECT} limit 1`;
    expect(prov.intake_field_keys).toContain("legal_name");
  });

  it("independently catches an over-claimed mandatory requirement as a blocker gap", async () => {
    // CS-04 (shareholding pattern) was claimed but not covered → over-claim.
    const [cov] = await sql<{ status: string; evidence: { overclaimed: boolean } }[]>`
      select rc.status, rc.evidence
      from public.requirement_coverage rc
      join public.requirement_checklist r on r.id = rc.requirement_id
      where rc.project_id = ${PROJECT} and r.code = 'CS-04'`;
    expect(cov.status).toBe("missing");
    expect(cov.evidence.overclaimed).toBe(true);

    const [{ blockers }] = await sql<{ blockers: number }[]>`
      select count(*)::int as blockers from public.gap_flags
      where project_id = ${PROJECT} and field_key = 'CS-04' and severity = 'blocker' and flag_type = 'unaddressed'`;
    expect(blockers).toBeGreaterThan(0);
  });

  it("records drafter [[GAP]] markers as gap flags", async () => {
    const [{ gapMarkers }] = await sql<{ gapMarkers: number }[]>`
      select count(*)::int as "gapMarkers" from public.gap_flags
      where project_id = ${PROJECT} and details->>'source' = 'gap_marker'`;
    expect(gapMarkers).toBeGreaterThan(0);
  });

  it("surfaces a drafter failure and marks the job failed (never swallowed)", async () => {
    const throwing: SectionDrafter = async () => {
      throw new Error("simulated model outage");
    };
    await expect(generateDraft(sql, PROJECT, throwing)).rejects.toThrow(/simulated model outage/);
    const [job] = await sql<{ state: string; error: string }[]>`
      select state, error from public.generation_jobs
      where project_id = ${PROJECT} order by created_at desc limit 1`;
    expect(job.state).toBe("failed");
    expect(job.error).toMatch(/simulated model outage/);
  });
});
