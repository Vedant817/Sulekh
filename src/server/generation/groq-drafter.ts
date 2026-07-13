import "server-only";

import { z } from "zod";

import { getGroq, getModels } from "@/lib/groq";
import { isStructuredOutputValidationError } from "@/lib/groq-errors";
import { buildUserPrompt, GENERATION_SYSTEM } from "@/server/generation/prompt";
import type { DrafterInput, DrafterOutput, SectionDrafter } from "@/server/generation/orchestrator";

const SUBMIT_SCHEMA = {
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
};

const submitOutputSchema = z.object({
  markdown: z.string().min(1),
  addressed_requirement_codes: z.array(z.string()),
});

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

  const userPrompt = buildUserPrompt(input);
  const request = (strict: boolean) =>
    client.chat.completions.create({
      model: modelId,
      max_tokens: 4096,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: strict
            ? GENERATION_SYSTEM
            : `${GENERATION_SYSTEM}\nReturn only one JSON object matching this schema. Do not repeat or describe the schema:\n${JSON.stringify(SUBMIT_SCHEMA)}`,
        },
        { role: "user", content: userPrompt },
      ],
      response_format: strict
        ? {
            type: "json_schema",
            json_schema: {
              name: "drhp_section",
              strict: true,
              schema: SUBMIT_SCHEMA,
            },
          }
        : { type: "json_object" },
    });

  let response;
  try {
    response = await request(true);
  } catch (error) {
    if (!isStructuredOutputValidationError(error)) throw error;
    response = await request(false);
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(
      `Generation for ${input.sectionKey} returned no structured content (finish_reason: ${response.choices[0]?.finish_reason}).`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error(`Generation for ${input.sectionKey} returned invalid JSON arguments.`);
  }
  const parsed = submitOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Generation for ${input.sectionKey} did not match the expected schema: ${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
  }

  return {
    markdown: parsed.data.markdown,
    addressedCodes: parsed.data.addressed_requirement_codes,
    modelId,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  };
};
