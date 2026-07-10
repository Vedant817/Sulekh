import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_BYTES, validateUpload } from "@/schemas/document";

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
