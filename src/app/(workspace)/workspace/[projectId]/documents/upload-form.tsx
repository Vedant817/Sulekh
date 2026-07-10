"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DOCUMENT_TYPE_LABELS, documentTypeSchema } from "@/schemas/document";

import { uploadDocumentAction, type UploadState } from "./actions";

const initial: UploadState = { ok: false, error: null };
const DOC_TYPES = documentTypeSchema.options;

export function UploadForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(uploadDocumentAction, initial);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border p-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="docType">Document type</Label>
          <select
            id="docType"
            name="docType"
            defaultValue="audited_financials"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="file">File (PDF, XLSX/XLS, CSV — max 25 MB)</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            required
            className="text-sm"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : state.ok ? (
        <p className="text-sm text-emerald-600">Uploaded.</p>
      ) : null}
    </form>
  );
}
