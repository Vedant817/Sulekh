import "server-only";

import { getGroq, getModels } from "@/lib/groq";
import { buildUserPrompt, GENERATION_SYSTEM } from "@/server/generation/prompt";
import type { DrafterInput, DrafterOutput, SectionDrafter } from "@/server/generation/orchestrator";

const SUBMIT_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_section",
    description: "Submit the drafted DRHP section and the requirement codes it addressed.",
    parameters: {
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
  },
};

/**
 * Groq-backed section drafter (OpenAI-compatible function calling). Routes to
 * MODEL_DRAFTING / MODEL_REASONING per section, grounds strictly in the provided
 * data, and returns the draft plus the model's self-reported coverage (verified
 * independently by the orchestrator). Errors propagate (SDK retries transient
 * failures); never returns a silent empty.
 */
export const groqDrafter: SectionDrafter = async (input: DrafterInput): Promise<DrafterOutput> => {
  const client = getGroq();
  const models = getModels();
  const modelId = input.modelKind === "reasoning" ? models.reasoning : models.drafting;

  const response = await client.chat.completions.create({
    model: modelId,
    max_tokens: 16000,
    temperature: 0.2,
    messages: [
      { role: "system", content: GENERATION_SYSTEM },
      { role: "user", content: buildUserPrompt(input) },
    ],
    tools: [SUBMIT_TOOL],
    tool_choice: { type: "function", function: { name: "submit_section" } },
  });

  const call = response.choices[0]?.message?.tool_calls?.[0];
  if (!call) {
    throw new Error(
      `Generation for ${input.sectionKey} returned no section (finish_reason: ${response.choices[0]?.finish_reason}).`,
    );
  }

  let out: { markdown?: unknown; addressed_requirement_codes?: unknown };
  try {
    out = JSON.parse(call.function.arguments);
  } catch {
    throw new Error(`Generation for ${input.sectionKey} returned invalid JSON arguments.`);
  }
  if (typeof out.markdown !== "string" || out.markdown.trim().length === 0) {
    throw new Error(`Generation for ${input.sectionKey} produced empty markdown.`);
  }

  return {
    markdown: out.markdown,
    addressedCodes: Array.isArray(out.addressed_requirement_codes)
      ? out.addressed_requirement_codes.filter((c): c is string => typeof c === "string")
      : [],
    modelId,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  };
};
