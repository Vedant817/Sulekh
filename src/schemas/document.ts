import { z } from "zod";

/** Document categories the promoter uploads (map to extraction schemas). */
export const documentTypeSchema = z.enum([
  "audited_financials",
  "moa_aoa",
  "cap_table",
  "litigation_register",
  "kmp_kyc",
  "board_resolution",
  "other",
]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  audited_financials: "Audited financial statements",
  moa_aoa: "MoA / AoA",
  cap_table: "Capitalisation table",
  litigation_register: "Litigation register",
  kmp_kyc: "KMP / promoter KYC",
  board_resolution: "Board resolution",
  other: "Other",
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv",
};

export type UploadValidation = { ok: true } | { ok: false; error: string };

/** Validate a file's type and size before it is accepted for upload. */
export function validateUpload(input: {
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}): UploadValidation {
  if (input.sizeBytes <= 0) {
    return { ok: false, error: "The file is empty." };
  }
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File is too large (${(input.sizeBytes / 1_048_576).toFixed(1)} MB). Max is ${MAX_UPLOAD_BYTES / 1_048_576} MB.`,
    };
  }
  if (!ALLOWED_MIME_TYPES[input.mimeType]) {
    return {
      ok: false,
      error: `Unsupported file type "${input.mimeType || "unknown"}". Allowed: PDF, XLSX/XLS, CSV.`,
    };
  }
  return { ok: true };
}
