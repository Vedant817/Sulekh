import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BATCH_BYTES,
  MAX_UPLOAD_BYTES,
  suggestDocumentType,
  validateUpload,
  validateUploadBatch,
} from "@/schemas/document";

describe("validateUpload", () => {
  it("accepts a PDF within the size limit", () => {
    expect(
      validateUpload({ mimeType: "application/pdf", sizeBytes: 1_000_000, fileName: "f.pdf" }),
    ).toEqual({ ok: true });
  });

  it("accepts an XLSX", () => {
    expect(
      validateUpload({
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 50_000,
        fileName: "cap.xlsx",
      }).ok,
    ).toBe(true);
  });

  it("rejects an unsupported type gracefully", () => {
    const r = validateUpload({ mimeType: "image/png", sizeBytes: 10, fileName: "x.png" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unsupported/);
  });

  it("rejects an oversized file", () => {
    const r = validateUpload({
      mimeType: "application/pdf",
      sizeBytes: MAX_UPLOAD_BYTES + 1,
      fileName: "big.pdf",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/too large/);
  });

  it("rejects an empty file", () => {
    expect(
      validateUpload({ mimeType: "application/pdf", sizeBytes: 0, fileName: "e.pdf" }).ok,
    ).toBe(false);
  });
});

describe("document upload queue", () => {
  it("suggests visible, editable categories from common filenames", () => {
    expect(suggestDocumentType("FY24 Audited Financial Statements.pdf")).toBe(
      "audited_financials",
    );
    expect(suggestDocumentType("Promoter Shareholding Cap Table.xlsx")).toBe("cap_table");
    expect(suggestDocumentType("board-resolution.pdf")).toBe("board_resolution");
    expect(suggestDocumentType("unrecognised-source.pdf")).toBe("other");
  });

  it("accepts a bounded multi-file request", () => {
    expect(validateUploadBatch([{ sizeBytes: 1_000 }, { sizeBytes: 2_000 }])).toEqual({
      ok: true,
    });
  });

  it("rejects a combined request above the batch limit", () => {
    const result = validateUploadBatch([
      { sizeBytes: MAX_UPLOAD_BATCH_BYTES },
      { sizeBytes: 1 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/combined/);
  });
});
