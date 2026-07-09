/**
 * Real document parsing. Digital PDFs via unpdf (pdf.js under the hood);
 * spreadsheets via SheetJS. No OCR in v1 (digital audited statements are the
 * norm); a scanned-PDF OCR path is a documented v2 extension.
 *
 * These functions never invent content — an unreadable/empty document surfaces
 * an error or empty result to the caller, which must handle it (never a silent
 * fabricated value).
 */
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";

export type ParsedPdf = {
  totalPages: number;
  /** One string per page, preserving page boundaries for source pointers. */
  pages: string[];
};

export async function parsePdf(data: Uint8Array): Promise<ParsedPdf> {
  const pdf = await getDocumentProxy(data);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return { totalPages, pages };
}

export type ParsedSheet = {
  name: string;
  /** Rows of cell values (strings/numbers/null), preserving row/column order. */
  rows: (string | number | boolean | null)[][];
};

export type ParsedWorkbook = {
  sheets: ParsedSheet[];
};

export function parseXlsx(data: Uint8Array): ParsedWorkbook {
  const wb = XLSX.read(data, { type: "array" });
  const sheets: ParsedSheet[] = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
    return { name, rows };
  });
  return { sheets };
}

/** Render a parsed workbook to plain text (for chunking/embedding of tables). */
export function workbookToText(wb: ParsedWorkbook): string {
  return wb.sheets
    .map((s) => {
      const body = s.rows
        .map((r) => r.map((c) => (c == null ? "" : String(c))).join("\t"))
        .join("\n");
      return `# Sheet: ${s.name}\n${body}`;
    })
    .join("\n\n");
}
