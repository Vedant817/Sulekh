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
export const MAX_UPLOAD_BATCH_BYTES = 25 * 1024 * 1024; // Keep one request bounded.

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv",
};

export type UploadValidation = { ok: true } | { ok: false; error: string };

/**
 * Suggest a category from the filename to reduce repetitive form work. This is
 * only a UI default: the promoter sees and can change every suggestion before
 * upload, so no document is classified silently.
 */
export function suggestDocumentType(fileName: string): DocumentType {
  const normalized = fileName.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (/\b(financial|financials|balance sheet|profit loss|cash flow|annual report)\b/.test(normalized)) {
    return "audited_financials";
  }
  if (/\b(moa|aoa|memorandum|articles)\b/.test(normalized)) return "moa_aoa";
  if (/\b(cap table|capitalisation|capitalization|shareholding)\b/.test(normalized)) {
    return "cap_table";
  }
  if (/\b(litigation|legal cases|court cases)\b/.test(normalized)) {
    return "litigation_register";
  }
  if (/\b(kmp|kyc|promoter|director)\b/.test(normalized)) return "kmp_kyc";
  if (/\b(board resolution|resolution)\b/.test(normalized)) return "board_resolution";
  return "other";
}

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

/** Validate the aggregate request before any file is persisted. */
export function validateUploadBatch(files: { sizeBytes: number }[]): UploadValidation {
  if (files.length === 0) return { ok: false, error: "Select at least one file to upload." };
  const total = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (total > MAX_UPLOAD_BATCH_BYTES) {
    return {
      ok: false,
      error: `This upload is too large (${(total / 1_048_576).toFixed(1)} MB combined). Upload up to ${MAX_UPLOAD_BATCH_BYTES / 1_048_576} MB at a time.`,
    };
  }
  return { ok: true };
}
