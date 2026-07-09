import { createSqlClient } from "../client";
import { SECTION_CATALOG } from "./data/section-catalog";
import { REQUIREMENT_CHECKLIST } from "./data/requirement-checklist";

async function main() {
  // Guard: every requirement must map to a known catalogue section.
  const sectionKeys = new Set(SECTION_CATALOG.map((s) => s.sectionKey));
  const orphans = REQUIREMENT_CHECKLIST.filter((r) => !sectionKeys.has(r.sectionKey));
  if (orphans.length) {
    console.error("✖ Requirement(s) reference unknown section keys:");
    for (const o of orphans) console.error(`  - ${o.code} -> ${o.sectionKey}`);
    process.exitCode = 1;
    return;
  }

  const sql = createSqlClient();
  try {
    // Section catalogue.
    for (const s of SECTION_CATALOG) {
      await sql`
        insert into public.drhp_section_catalog (section_key, title, ordinal, mandatory, description)
        values (${s.sectionKey}, ${s.title}, ${s.ordinal}, ${s.mandatory}, ${s.description})
        on conflict (section_key) do update
          set title = excluded.title, ordinal = excluded.ordinal,
              mandatory = excluded.mandatory, description = excluded.description`;
    }

    // Requirement checklist.
    for (const r of REQUIREMENT_CHECKLIST) {
      await sql`
        insert into public.requirement_checklist
          (code, section_key, title, description, mandatory, source_citation, ordinal)
        values (${r.code}, ${r.sectionKey}, ${r.title}, ${r.description},
                ${r.mandatory}, ${r.sourceCitation}, ${r.ordinal})
        on conflict (code) do update
          set section_key = excluded.section_key, title = excluded.title,
              description = excluded.description, mandatory = excluded.mandatory,
              source_citation = excluded.source_citation, ordinal = excluded.ordinal`;
    }

    // Coverage report: every catalogue section must have >= 1 requirement.
    const coverage = await sql<{ section_key: string; title: string; reqs: number }[]>`
      select c.section_key, c.title,
             (select count(*) from public.requirement_checklist r where r.section_key = c.section_key)::int as reqs
      from public.drhp_section_catalog c
      order by c.ordinal`;

    const uncovered = coverage.filter((c) => c.reqs === 0);
    console.log(
      `✔ Seeded ${SECTION_CATALOG.length} section(s), ${REQUIREMENT_CHECKLIST.length} requirement(s).`,
    );
    console.log(`  Sections with requirements: ${coverage.length - uncovered.length}/${coverage.length}`);

    // Integrity: no requirement missing a citation or mandatory flag.
    const [{ count: noCitation }] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.requirement_checklist
      where source_citation is null or source_citation = ''`;

    if (uncovered.length) {
      console.error("✖ Sections with NO requirement (coverage gap):");
      for (const u of uncovered) console.error(`  - ${u.section_key} (${u.title})`);
      process.exitCode = 1;
      return;
    }
    if (noCitation > 0) {
      console.error(`✖ ${noCitation} requirement(s) missing a source citation.`);
      process.exitCode = 1;
      return;
    }
    console.log("  Every section covered; every requirement has a citation.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("✖ Checklist seed failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
