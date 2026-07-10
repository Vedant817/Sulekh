"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/schemas/document";

import { signedUrlAction } from "./actions";

type DocItem = {
  id: string;
  file_name: string;
  doc_type: string;
  parse_status: string;
  size_bytes: number | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Not parsed",
  parsing: "Parsing…",
  parsed: "Parsed",
  failed: "Parse failed",
};

export function DocumentList({ documents }: { documents: DocItem[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(id: string) {
    setBusy(id);
    setError(null);
    const res = await signedUrlAction(id);
    setBusy(null);
    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    else setError(res.error ?? "Could not open document.");
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
      <ul className="flex flex-col gap-2">
        {documents.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between rounded-xl border p-3"
          >
            <div className="flex flex-col">
              <span className="font-medium">{d.file_name}</span>
              <span className="text-xs text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[d.doc_type as DocumentType] ?? d.doc_type} ·{" "}
                {d.size_bytes ? `${(d.size_bytes / 1024).toFixed(0)} KB` : "—"} ·{" "}
                {STATUS_LABEL[d.parse_status] ?? d.parse_status}
              </span>
            </div>
            <Button variant="outline" size="sm" disabled={busy === d.id} onClick={() => open(d.id)}>
              {busy === d.id ? "Opening…" : "Download"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
