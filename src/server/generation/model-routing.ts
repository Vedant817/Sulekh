/**
 * Model routing. Narrative sections use MODEL_DRAFTING; reasoning-heavy sections
 * (quantitative justification, risk prioritisation, financial analysis) escalate
 * to MODEL_REASONING. Both IDs come from env — never hardcoded.
 */
export type ModelKind = "drafting" | "reasoning";

/** Sections that require the stronger reasoning model. */
export const REASONING_SECTIONS = new Set<string>([
  "risk-factors",
  "basis-for-issue-price",
  "mda",
  "financial-information",
]);

export function modelKindForSection(sectionKey: string): ModelKind {
  return REASONING_SECTIONS.has(sectionKey) ? "reasoning" : "drafting";
}
