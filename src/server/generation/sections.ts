/**
 * Section dependency ordering for generation. Some DRHP sections must be drafted
 * before others (e.g. Capital Structure before Basis for Issue Price, which
 * cites EPS/NAV derived from capital + financials). The orchestrator generates
 * sections in a dependency-respecting topological order, using the catalogue
 * ordinal as a deterministic tie-break.
 */

/** section_key -> section_keys that must be generated before it. */
export const SECTION_DEPENDENCIES: Record<string, string[]> = {
  "objects-of-issue": ["capital-structure"],
  "basis-for-issue-price": [
    "capital-structure",
    "financial-information",
    "objects-of-issue",
  ],
  mda: ["financial-information"],
  introduction: ["business-overview", "industry-overview", "financial-information"],
  "risk-factors": [
    "business-overview",
    "financial-information",
    "legal-proceedings",
  ],
  promoters: ["capital-structure"],
  "group-companies": ["promoters"],
};

export type CatalogSection = { sectionKey: string; ordinal: number };

/**
 * Deterministic topological order: a section appears after all its
 * dependencies; independent sections keep catalogue order. Throws on a cycle or
 * an unknown dependency (fail loud rather than silently reorder).
 */
export function generationOrder(sections: CatalogSection[]): string[] {
  const known = new Set(sections.map((s) => s.sectionKey));
  const ordinal = new Map(sections.map((s) => [s.sectionKey, s.ordinal]));

  // Validate dependencies reference real sections.
  for (const [section, deps] of Object.entries(SECTION_DEPENDENCIES)) {
    if (!known.has(section)) continue;
    for (const dep of deps) {
      if (!known.has(dep)) {
        throw new Error(`Section "${section}" depends on unknown section "${dep}"`);
      }
    }
  }

  const result: string[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();

  const visit = (key: string) => {
    if (done.has(key)) return;
    if (visiting.has(key)) {
      throw new Error(`Cyclic section dependency involving "${key}"`);
    }
    visiting.add(key);
    const deps = (SECTION_DEPENDENCIES[key] ?? [])
      .filter((d) => known.has(d))
      .sort((a, b) => (ordinal.get(a) ?? 0) - (ordinal.get(b) ?? 0));
    for (const dep of deps) visit(dep);
    visiting.delete(key);
    done.add(key);
    result.push(key);
  };

  // Process in catalogue order so independent sections stay in filing order.
  for (const s of [...sections].sort((a, b) => a.ordinal - b.ordinal)) {
    visit(s.sectionKey);
  }
  return result;
}
