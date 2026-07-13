import { z } from "zod";

/**
 * Structured-extraction target schemas. Claude is constrained to these shapes
 * (structured outputs) and instructed to extract ONLY values present in the
 * source document — emitting an empty list when a category is absent rather
 * than inventing data. Every extracted entity is later confirmed by the
 * promoter before it can enter a draft.
 */

export const financialLineItemSchema = z.object({
  statement: z
    .enum(["profit_and_loss", "balance_sheet", "cash_flow"])
    .nullable()
    .describe("Null when the source does not identify a recognised financial statement"),
  period_label: z.string().nullable().describe("e.g. FY24, FY23, H1FY25; null if absent"),
  line_item: z
    .string()
    .nullable()
    .describe("The line item label as printed; null when the chunk has no financial row"),
  amount: z.number().nullable().describe("Numeric amount; null if not legible"),
  unit: z.string().nullable().describe("e.g. INR lakhs, INR crores"),
});

export const capTableRowSchema = z.object({
  holder_name: z.string(),
  category: z.string().nullable().describe("Promoter / Public / Investor etc."),
  shares: z.number().nullable(),
  percentage: z.number().nullable(),
});

export const litigationItemSchema = z.object({
  case_title: z.string(),
  parties: z.string().nullable(),
  forum: z.string().nullable().describe("Court/tribunal/authority"),
  nature: z.string().nullable().describe("Civil / criminal / tax / statutory"),
  amount_involved: z.number().nullable(),
  status: z.string().nullable(),
});

export const kmpPersonSchema = z.object({
  name: z.string(),
  designation: z.string().nullable(),
  din_or_pan: z.string().nullable(),
  date_of_appointment: z.string().nullable(),
});

export const promoterSchema = z.object({
  name: z.string(),
  relationship: z.string().nullable(),
  shareholding_percentage: z.number().nullable(),
});

/** The kinds of structured entity a document can yield. */
export const extractionEntityType = z.enum([
  "financial_line_item",
  "cap_table_row",
  "litigation_item",
  "kmp_person",
  "promoter",
]);
export type ExtractionEntityType = z.infer<typeof extractionEntityType>;

export const ENTITY_SCHEMAS = {
  financial_line_item: financialLineItemSchema,
  cap_table_row: capTableRowSchema,
  litigation_item: litigationItemSchema,
  kmp_person: kmpPersonSchema,
  promoter: promoterSchema,
} as const;

/** Which entity types each uploaded document type should yield. */
export const DOC_TYPE_ENTITIES: Record<string, ExtractionEntityType[]> = {
  audited_financials: ["financial_line_item"],
  cap_table: ["cap_table_row"],
  litigation_register: ["litigation_item"],
  kmp_kyc: ["kmp_person", "promoter"],
  moa_aoa: [],
  board_resolution: [],
  other: [],
};
