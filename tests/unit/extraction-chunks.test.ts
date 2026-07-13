import { describe, expect, it } from "vitest";

import {
  formatGroqRateLimitError,
  isStructuredOutputValidationError,
} from "@/lib/groq-errors";
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

  it("selects audited-statement windows beyond the front of a long offer document", () => {
    const text = [
      "DOCUMENT COVER SHOULD NOT BE SELECTED",
      "FRONT-ONLY ".repeat(13_000),
      "RESTATED STATEMENT OF ASSETS AND LIABILITIES\nEquity share capital 541.83\n",
      "middle ".repeat(8_000),
      "RESTATED STATEMENT OF PROFIT AND LOSS\nRevenue from operations 4820.34\n",
      "end ".repeat(5_000),
    ].join("\n");

    const result = chunkExtractionText(text, "financial_line_item");
    const selected = result.chunks.join("\n");

    expect(result.truncated).toBe(true);
    expect(selected).toContain("RESTATED STATEMENT OF ASSETS AND LIABILITIES");
    expect(selected).toContain("Equity share capital 541.83");
    expect(selected).toContain("RESTATED STATEMENT OF PROFIT AND LOSS");
    expect(selected).toContain("Revenue from operations 4820.34");
    expect(selected).not.toContain("DOCUMENT COVER SHOULD NOT BE SELECTED");
    expect(result.chunks.every((chunk) => chunk.length <= EXTRACTION_CHUNK_CHARS)).toBe(true);
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

describe("formatGroqRateLimitError", () => {
  it("keeps recovery timing while removing provider internals", () => {
    const result = formatGroqRateLimitError({
      status: 429,
      message:
        '429 {"error":{"message":"Rate limit reached for model `model-id` in organization `org_secret` on tokens per day. Please try again in 5m1.0176s. Need more tokens?","code":"rate_limit_exceeded"}}',
    });

    expect(result).toBe(
      "AI extraction is temporarily paused because the provider token limit was reached. Retry in about 5m 2s. Your document is stored securely and does not need to be uploaded again.",
    );
    expect(result).not.toContain("org_secret");
    expect(result).not.toContain("model-id");
  });

  it("does not rewrite unrelated failures", () => {
    expect(formatGroqRateLimitError(new Error("network failure"))).toBeNull();
  });
});
