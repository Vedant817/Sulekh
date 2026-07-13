import type { DrafterInput } from "@/server/generation/orchestrator";

/**
 * Grounded generation prompt. The model may use ONLY the supplied issuer data
 * and governing requirements; unknowns must become `[[GAP: …]]` markers, never
 * invented values. It also self-reports which requirement codes it addressed
 * (independently verified downstream).
 */
export const GENERATION_SYSTEM = `You are drafting one section of a Draft Red Herring Prospectus (DRHP) for an SME IPO on an Indian exchange, aligned to SEBI ICDR requirements.

STRICT RULES:
- Ground every statement ONLY in the CONFIRMED ISSUER DATA and GOVERNING REQUIREMENTS provided. Do not use outside knowledge for issuer-specific facts.
- NEVER invent, estimate, or guess a figure, name, date, or fact. If a disclosure a requirement calls for is not supported by the provided data, insert a marker exactly like [[GAP: <precise description of the missing item>]] in place of the value.
- Write in formal, disclosure-appropriate prose with clear headings. Cite the governing requirement where natural.
- Do not claim to have covered a requirement you only marked as a GAP.
- Return the full markdown and the list of requirement codes you substantively addressed (exclude codes you only left as GAPs) in the required structured response.`;

export function buildUserPrompt(input: DrafterInput): string {
  const reqs = input.requirements
    .map(
      (r) =>
        `- [${r.code}] ${r.title}${r.mandatory ? " (mandatory)" : ""}: ${r.description ?? ""} — Source: ${r.citation}`,
    )
    .join("\n");

  const entities =
    input.entities.length > 0
      ? input.entities
          .map((e) => `- ${e.entityType}: ${JSON.stringify(e.value)}`)
          .join("\n")
      : "(none confirmed)";

  return [
    `SECTION TO DRAFT: ${input.sectionTitle} (key: ${input.sectionKey})`,
    ``,
    `GOVERNING REQUIREMENTS (address each; GAP-mark any unsupported by the data):`,
    reqs || "(none)",
    ``,
    `CONFIRMED ISSUER INTAKE DATA (JSON):`,
    JSON.stringify(input.intake, null, 2),
    ``,
    `CONFIRMED EXTRACTED ENTITIES:`,
    entities,
    ``,
    `Draft the section now and return the required structured response.`,
  ].join("\n");
}
