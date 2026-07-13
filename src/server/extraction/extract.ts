import "server-only";

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { getGroq, getModels } from "@/lib/groq";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DOC_TYPE_ENTITIES,
  ENTITY_SCHEMAS,
  type ExtractionEntityType,
} from "@/schemas/extraction";

/** Cap on document text sent to the model; truncation is surfaced, not silent. */
const MAX_TEXT_CHARS = 120_000;

const EXTRACTION_GUIDANCE = `You extract structured data from an SME issuer's source document for an IPO offer document (DRHP).
Rules:
- Extract ONLY values that are actually present in the provided text.
- If a field is not legible or not present, use null — never guess or fabricate.
- If the document contains none of the requested entities, return an empty list.
- For each entity, include a short verbatim "evidence" quote from the text that supports it.
- Preserve numbers exactly as printed (do not convert units).`;

export type ExtractedRow<T = unknown> = { data: T; evidence: string };

/** Run one structured-extraction pass for a single entity type. */
export async function extractEntities(
  entityType: ExtractionEntityType,
  text: string,
  opts: { model?: string } = {},
): Promise<{ rows: ExtractedRow[]; truncated: boolean }> {
  const entitySchema = ENTITY_SCHEMAS[entityType];
  const outputSchema = z.object({
    entities: z.array(
      z.object({
        data: entitySchema,
        evidence: z.string().describe("Short verbatim quote supporting this entity"),
      }),
    ),
  });
  const inputSchema = zodToJsonSchema(outputSchema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  }) as Record<string, unknown>;

  const truncated = text.length > MAX_TEXT_CHARS;
  const body = truncated ? text.slice(0, MAX_TEXT_CHARS) : text;

  const client = getGroq();
  const model = opts.model ?? getModels().drafting;
  // Strict structured output gives a schema-shaped result; temperature 0 for
  // deterministic extraction.
  const response = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    temperature: 0,
    messages: [
      { role: "system", content: EXTRACTION_GUIDANCE },
      {
        role: "user",
        content:
          `Extract all "${entityType}" entities from the following document text.` +
          (truncated
            ? ` NOTE: the document was truncated to the first ${MAX_TEXT_CHARS} characters.`
            : "") +
          `\n\n---\n${body}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: `${entityType}_extraction`,
        strict: true,
        schema: inputSchema,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(
      `Structured extraction for ${entityType} returned no content (finish_reason: ${response.choices[0]?.finish_reason}).`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error(`Extraction for ${entityType} returned invalid JSON arguments.`);
  }
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Extraction for ${entityType} did not match the expected schema: ${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
  }
  return { rows: parsed.data.entities as ExtractedRow[], truncated };
}

export type DocumentExtractionResult = {
  documentId: string;
  byType: { entityType: ExtractionEntityType; count: number; truncated: boolean }[];
  total: number;
};

/**
 * Extract structured entities from an uploaded document and persist them as
 * unconfirmed `extracted_entities`. Updates the document's parse status.
 * Errors are surfaced (and the document marked failed) — never swallowed.
 */
export async function extractFromDocument(params: {
  projectId: string;
  documentId: string;
  docType: string;
  text: string;
}): Promise<DocumentExtractionResult> {
  const admin = createAdminClient();
  const entityTypes = DOC_TYPE_ENTITIES[params.docType] ?? [];

  await admin
    .from("uploaded_documents")
    .update({ parse_status: "parsing", parse_error: null })
    .eq("id", params.documentId);

  try {
    const byType: DocumentExtractionResult["byType"] = [];
    let total = 0;

    for (const entityType of entityTypes) {
      const { rows, truncated } = await extractEntities(entityType, params.text);
      const { data: priorRows, error: priorError } = await admin
        .from("extracted_entities")
        .select("id")
        .eq("document_id", params.documentId)
        .eq("entity_type", entityType)
        .eq("confirmed_by_promoter", false);
      if (priorError) throw new Error(`Load prior ${entityType} failed: ${priorError.message}`);

      if (rows.length > 0) {
        const insertRows = rows.map((r) => ({
          project_id: params.projectId,
          document_id: params.documentId,
          entity_type: entityType,
          data: r.data as never,
          source_snippet: r.evidence,
          confirmed_by_promoter: false,
        }));
        const { error } = await admin.from("extracted_entities").insert(insertRows);
        if (error) throw new Error(`Persist ${entityType} failed: ${error.message}`);
      }
      const priorIds = (priorRows ?? []).map((row) => row.id);
      if (priorIds.length > 0) {
        const { error } = await admin.from("extracted_entities").delete().in("id", priorIds);
        if (error) throw new Error(`Replace prior ${entityType} failed: ${error.message}`);
      }
      byType.push({ entityType, count: rows.length, truncated });
      total += rows.length;
    }

    await admin
      .from("uploaded_documents")
      .update({ parse_status: "parsed" })
      .eq("id", params.documentId);

    return { documentId: params.documentId, byType, total };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    await admin
      .from("uploaded_documents")
      .update({ parse_status: "failed", parse_error: message })
      .eq("id", params.documentId);
    throw err;
  }
}
