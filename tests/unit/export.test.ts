import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";

import { buildDocx, buildPdf, WATERMARK_TEXT, type ExportInput } from "@/server/export/render";

const base: ExportInput = {
  projectName: "Acme Manufacturing Ltd",
  board: "BSE_SME",
  sections: [
    { title: "Risk Factors", ordinal: 3, markdown: "# Risk Factors\n\nThe business faces supply concentration risk. [[GAP: quantification pending]]" },
    { title: "Capital Structure", ordinal: 6, markdown: "# Capital Structure\n\n## Share capital\nPre-issue paid-up capital is disclosed." },
  ],
  generatedAt: "2026-07-11",
  watermarked: true,
};

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

function docxDocumentXml(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  return strFromU8(files["word/document.xml"]);
}

describe("DOCX export", () => {
  it("produces a valid .docx (zip) containing all section titles in order", async () => {
    const bytes = await buildDocx(base);
    // Zip/OOXML magic bytes.
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
    const xml = docxDocumentXml(bytes);
    expect(xml).toContain("Risk Factors");
    expect(xml).toContain("Capital Structure");
    expect(xml.indexOf("Risk Factors")).toBeLessThan(xml.indexOf("Capital Structure"));
  });

  it("includes the watermark when not approved and omits it when approved", async () => {
    const wm = docxDocumentXml(await buildDocx({ ...base, watermarked: true }));
    // Header lives in a separate part; document.xml references headers only when present.
    expect(wm).toContain("headerReference");

    const clean = await buildDocx({ ...base, watermarked: false });
    const cleanFiles = unzipSync(clean);
    const hasHeaderPart = Object.keys(cleanFiles).some((f) => /header\d*\.xml/.test(f));
    expect(hasHeaderPart).toBe(false);
  });
});

describe("PDF export", () => {
  it("produces a valid PDF with section titles", async () => {
    const bytes = await buildPdf(base);
    expect(strFromU8(bytes.slice(0, 5))).toBe("%PDF-");
    const text = await pdfText(bytes);
    expect(text).toContain("Risk Factors");
    expect(text).toContain("Capital Structure");
    expect(text).toContain("Acme Manufacturing Ltd");
  });

  it("stamps the watermark only when not approved", async () => {
    const watermarked = await pdfText(await buildPdf({ ...base, watermarked: true }));
    expect(watermarked).toContain(WATERMARK_TEXT);

    const clean = await pdfText(await buildPdf({ ...base, watermarked: false }));
    expect(clean).not.toContain(WATERMARK_TEXT);
  });

  it("renders common Indian financial and model punctuation safely", async () => {
    const text = await pdfText(
      await buildPdf({
        ...base,
        sections: [
          {
            title: "Financial Information",
            ordinal: 1,
            markdown: "Revenue was ₹4,200 lakhs for the pre‑issue period ending FY 2025.",
          },
        ],
      }),
    );
    expect(text).toContain("INR 4,200");
    expect(text).toContain("pre-issue");
    expect(text).toContain("FY 2025");
  });
});
