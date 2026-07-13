import { describe, expect, it } from "vitest";

import { isStructuredOutputValidationError } from "@/lib/groq-errors";
import {
  EXTRACTION_CHUNK_CHARS,
  MAX_EXTRACTION_TEXT_CHARS,
  chunkExtractionText,
} from "@/server/extraction/chunks";
import { hasMinimumEntityIdentity } from "@/server/extraction/quality";

describe("chunkExtractionText", () => {
  it("leaves a small document in one request", () => {
    expect(chunkExtractionText("Revenue from operations: 100")).toEqual({
      chunks: ["Revenue from operations: 100"],
      truncated: false,
    });
  });

  it("keeps every request below the model-safe character budget", () => {
    const line = `${"x".repeat(199)}\n`;
    const text = line.repeat(500);
    const result = chunkExtractionText(text);

    expect(result.truncated).toBe(false);
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.chunks.every((chunk) => chunk.length <= EXTRACTION_CHUNK_CHARS)).toBe(true);
    expect(result.chunks.join("\n").replaceAll("\n", "")).toBe(text.replaceAll("\n", ""));
  });

  it("reports the bounded-document safety cap instead of silently over-reading", () => {
    const result = chunkExtractionText("x".repeat(MAX_EXTRACTION_TEXT_CHARS + 50));

    expect(result.truncated).toBe(true);
    expect(result.chunks.reduce((sum, chunk) => sum + chunk.length, 0)).toBe(
      MAX_EXTRACTION_TEXT_CHARS,
    );
  });
});

describe("hasMinimumEntityIdentity", () => {
  it("rejects unrelated cover-page figures from financial extraction", () => {
    expect(
      hasMinimumEntityIdentity("financial_line_item", {
        statement: null,
        period_label: null,
        line_item: "Offer size",
        amount: null,
        unit: "INR lakhs",
      }),
    ).toBe(false);
  });

  it("keeps an identified financial-statement row", () => {
    expect(
      hasMinimumEntityIdentity("financial_line_item", {
        statement: "profit_and_loss",
        period_label: "FY24",
        line_item: "Revenue from operations",
        amount: 4200,
        unit: "INR lakhs",
      }),
    ).toBe(true);
  });
});

describe("isStructuredOutputValidationError", () => {
  it("limits fallback to Groq's explicit strict-schema validation failure", () => {
    expect(
      isStructuredOutputValidationError({
        message: "code: json_validate_failed",
      }),
    ).toBe(true);
    expect(isStructuredOutputValidationError({ status: 429, message: "rate limit" })).toBe(false);
    expect(isStructuredOutputValidationError(new Error("network failure"))).toBe(false);
  });
});
