"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/schemas/document";

import { parseAndExtractAction, signedUrlAction } from "./actions";

type DocItem = {
  id: string;
  file_name: string;
  doc_type: string;
  parse_status: string;
  parse_error?: string | null;
  size_bytes: number | null;
  created_at: string;
};

const EXTRACTABLE = new Set([
  "audited_financials",
  "cap_table",
  "litigation_register",
  "kmp_kyc",
]);

const STATUS_LABEL: Record<string, string> = {
  pending: "Not parsed",
  parsing: "Parsing…",
  parsed: "Parsed",
  failed: "Parse failed",
};

export function DocumentList({
  projectId,
  documents,
}: {
  projectId: string;
  documents: DocItem[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function open(id: string) {
    setBusy(id);
    setError(null);
    const res = await signedUrlAction(id);
    setBusy(null);
    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    else setError(res.error ?? "Could not open document.");
  }

  async function extract(id: string) {
    setExtracting(id);
    setError(null);
    setNotice(null);
    const res = await parseAndExtractAction(projectId, id);
    setExtracting(null);
    if (res.ok) setNotice(`Extracted ${res.total ?? 0} item(s). Confirm them below.`);
    else setError(res.error ?? "Extraction failed.");
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
      <ul className="flex flex-col gap-2">
        {documents.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-xl border p-3"
          >
            <div className="flex flex-col">
              <span className="font-medium">{d.file_name}</span>
              <span className="text-xs text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[d.doc_type as DocumentType] ?? d.doc_type} ·{" "}
                {d.size_bytes ? `${(d.size_bytes / 1024).toFixed(0)} KB` : "—"} ·{" "}
                {STATUS_LABEL[d.parse_status] ?? d.parse_status}
              </span>
              {d.parse_status === "failed" && d.parse_error ? (
                <span className="text-xs text-destructive">{d.parse_error}</span>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              {EXTRACTABLE.has(d.doc_type) ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={extracting === d.id}
                  onClick={() => extract(d.id)}
                >
                  {extracting === d.id ? "Extracting…" : "Extract"}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" disabled={busy === d.id} onClick={() => open(d.id)}>
                {busy === d.id ? "Opening…" : "Download"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
