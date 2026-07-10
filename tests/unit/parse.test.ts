import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parsePdf, parseXlsx, workbookToText } from "@/server/extraction/parse";

describe("parseXlsx (cap-table tables)", () => {
  it("extracts rows and cell types from a real workbook", () => {
    // Build a genuine .xlsx (a cap table) and parse it back — verifies the parser
    // against known content (fixtures are permitted in tests).
    const wb = XLSX.utils.book_new();
    const rows = [
      ["Shareholder", "Category", "Shares", "% Pre-Issue"],
      ["Promoter A", "Promoter", 5_000_000, 62.5],
      ["Promoter B", "Promoter", 1_500_000, 18.75],
      ["Investor X", "Public", 1_500_000, 18.75],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "CapTable");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const parsed = parseXlsx(new Uint8Array(buf));
    expect(parsed.sheets).toHaveLength(1);
    const sheet = parsed.sheets[0];
    expect(sheet.name).toBe("CapTable");
    expect(sheet.rows[0]).toEqual(["Shareholder", "Category", "Shares", "% Pre-Issue"]);
    expect(sheet.rows[1]).toEqual(["Promoter A", "Promoter", 5_000_000, 62.5]);
    // Numbers preserved as numbers (not strings).
    expect(typeof sheet.rows[1][2]).toBe("number");

    const text = workbookToText(parsed);
    expect(text).toContain("CapTable");
    expect(text).toContain("Promoter A");
  });
});

describe("parsePdf (real audited-financials-bearing DRHP)", () => {
  const pdfPath = join(process.cwd(), "corpus", "reference-drhp-1.pdf");
  it.skipIf(!existsSync(pdfPath))(
    "extracts financial-statement text from a real filed DRHP",
    async () => {
      const { totalPages, pages } = await parsePdf(new Uint8Array(readFileSync(pdfPath)));
      expect(totalPages).toBeGreaterThan(100);
      const text = pages.join("\n").toUpperCase();
      for (const marker of [
        "RESTATED",
        "BALANCE SHEET",
        "PROFIT AND LOSS",
        "REVENUE FROM OPERATIONS",
        "CASH FLOW",
      ]) {
        expect(text, `expected marker: ${marker}`).toContain(marker);
      }
    },
    30_000,
  );
});
