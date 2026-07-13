import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createIntegrationSql, type Sql } from "./db";

import { getSectionRequirements, retrieveForSection } from "@/server/retrieval/retrieve";

/**
 * Verifies the Retrieval Service's authoritative requirement layer: for sampled
 * sections it returns the correct governing requirements, each with a citation.
 * Requires a migrated DB with the checklist seeded (pnpm seed:checklist).
 * The final test exercises the real configured embedding provider and pgvector
 * passage layer; TASKS 1.2 is not considered verified if it cannot run.
 */
const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("Retrieval — governing requirements per section", () => {
  let sql: Sql;
  beforeAll(() => {
    sql = createIntegrationSql(TEST_DB!);
  });
  afterAll(async () => {
    if (sql) await sql.end({ timeout: 5 });
  });

  const sampled = ["risk-factors", "capital-structure", "financial-information"];

  it("returns non-empty, cited requirements for each sampled section", async () => {
    for (const sectionKey of sampled) {
      const reqs = await getSectionRequirements(sql, sectionKey);
      expect(reqs.length, `section ${sectionKey}`).toBeGreaterThan(0);
      for (const r of reqs) {
        expect(r.citation, `citation for ${r.code}`).toMatch(/ICDR|Chapter IX|AS-18|Ind AS/);
        expect(r.title.length).toBeGreaterThan(0);
      }
    }
  });

  it("capital-structure includes the SME promoter contribution & lock-in requirement", async () => {
    const reqs = await getSectionRequirements(sql, "capital-structure");
    const lockIn = reqs.find((r) => r.code === "CS-03");
    expect(lockIn).toBeDefined();
    expect(lockIn!.mandatory).toBe(true);
    expect(lockIn!.citation).toMatch(/Chapter IX|Reg\. 23/);
  });

  it("every seeded section resolves to at least one governing requirement", async () => {
    const sections = await sql<{ section_key: string }[]>`
      select section_key from public.drhp_section_catalog order by ordinal`;
    for (const { section_key } of sections) {
      const reqs = await getSectionRequirements(sql, section_key);
      expect(reqs.length, `section ${section_key} has requirements`).toBeGreaterThan(0);
    }
  });

  it("uses the configured vector space to retrieve cited corpus passages", async () => {
    const result = await retrieveForSection(sql, "capital-structure", { k: 8 });

    expect(result.passagesFromVectorSearch).toBe(true);
    expect(result.passages).toHaveLength(8);
    expect(
      result.passages.some((passage) => /capital|promoter|share/i.test(passage.content)),
    ).toBe(true);
    for (const passage of result.passages) {
      expect(passage.sourceRef).toMatch(/p\.\d+/);
      expect(passage.documentTitle.length).toBeGreaterThan(0);
      expect(Number.isFinite(passage.similarity)).toBe(true);
    }
  });
});
