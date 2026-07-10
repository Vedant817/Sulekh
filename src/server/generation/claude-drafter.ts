import "server-only";

import { getAnthropic, getModels } from "@/lib/anthropic";
import { buildUserPrompt, GENERATION_SYSTEM } from "@/server/generation/prompt";
import type { DrafterInput, DrafterOutput, SectionDrafter } from "@/server/generation/orchestrator";

const SUBMIT_TOOL = {
  name: "submit_section",
  description: "Submit the drafted DRHP section and the requirement codes it addressed.",
  input_schema: {
    type: "object" as const,
    properties: {
      markdown: { type: "string", description: "The full section draft in Markdown." },
      addressed_requirement_codes: {
        type: "array",
        items: { type: "string" },
        description: "Requirement codes substantively addressed (exclude GAP-only ones).",
      },
    },
    required: ["markdown", "addressed_requirement_codes"],
    additionalProperties: false,
  },
};

/**
 * Claude-backed section drafter. Routes to MODEL_DRAFTING / MODEL_REASONING per
 * section, grounds strictly in the provided data, and returns the draft plus the
 * model's self-reported coverage (verified independently by the orchestrator).
 * Errors propagate (SDK retries transient failures); never returns silent empty.
 */
export const claudeDrafter: SectionDrafter = async (input: DrafterInput): Promise<DrafterOutput> => {
  const client = getAnthropic();
  const models = getModels();
  const modelId = input.modelKind === "reasoning" ? models.reasoning : models.drafting;

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 16000,
    thinking: { type: "disabled" },
    system: GENERATION_SYSTEM,
    tools: [SUBMIT_TOOL as never],
    tool_choice: { type: "tool", name: "submit_section" },
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `Generation for ${input.sectionKey} returned no section (stop_reason: ${response.stop_reason}).`,
    );
  }
  const out = toolUse.input as { markdown?: unknown; addressed_requirement_codes?: unknown };
  if (typeof out.markdown !== "string" || out.markdown.trim().length === 0) {
    throw new Error(`Generation for ${input.sectionKey} produced empty markdown.`);
  }

  return {
    markdown: out.markdown,
    addressedCodes: Array.isArray(out.addressed_requirement_codes)
      ? out.addressed_requirement_codes.filter((c): c is string => typeof c === "string")
      : [],
    modelId,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
  };
};
