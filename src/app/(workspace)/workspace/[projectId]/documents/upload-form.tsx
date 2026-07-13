"use client";

import { FileText, LoaderCircle, Sparkles, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DOCUMENT_TYPE_LABELS,
  documentTypeSchema,
  suggestDocumentType,
  type DocumentType,
} from "@/schemas/document";

import {
  parseAndExtractAction,
  uploadDocumentAction,
  type UploadState,
} from "./actions";

const initial: UploadState = {
  ok: false,
  error: null,
  uploaded: 0,
  documents: [],
};
const DOC_TYPES = documentTypeSchema.options;

type QueuedFile = {
  key: string;
  name: string;
  size: number;
  docType: DocumentType;
};

function fileSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function UploadForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const handledBatchRef = useRef("");
  const [state, formAction, pending] = useActionState(uploadDocumentAction, initial);
  const [queued, setQueued] = useState<QueuedFile[]>([]);
  const [extracting, setExtracting] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [extractionNotice, setExtractionNotice] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const batchSignature = state.documents.map((document) => document.id).join(",");

  useEffect(() => {
    if (!batchSignature || handledBatchRef.current === batchSignature) return;
    handledBatchRef.current = batchSignature;
    formRef.current?.reset();
    let active = true;
    queueMicrotask(() => {
      if (active) setQueued([]);
    });

    const extractable = state.documents.filter((document) => document.extractable);
    if (extractable.length === 0) {
      router.refresh();
      return () => {
        active = false;
      };
    }

    async function runExtraction() {
      let extractedItems = 0;
      const failures: string[] = [];
      setExtractionError(null);
      setExtractionNotice(null);

      for (const [index, document] of extractable.entries()) {
        if (!active) return;
        setExtracting({ current: index + 1, total: extractable.length, fileName: document.fileName });
        const result = await parseAndExtractAction(projectId, document.id, false);
        if (result.ok) extractedItems += result.total ?? 0;
        else failures.push(`${document.fileName}: ${result.error ?? "Extraction failed."}`);
      }

      if (!active) return;
      setExtracting(null);
      if (failures.length > 0) {
        setExtractionError(failures.join(" "));
      } else {
        setExtractionNotice(
          `Upload complete. ${extractedItems} value${extractedItems === 1 ? "" : "s"} extracted and ready for your review below.`,
        );
      }
      router.refresh();
    }

    void runExtraction();
    return () => {
      active = false;
    };
  }, [batchSignature, projectId, router, state.documents, state.uploaded]);

  function queueFiles(files: FileList | null): void {
    const next = Array.from(files ?? []).map((file, index) => ({
      key: `${file.lastModified}-${file.size}-${index}`,
      name: file.name,
      size: file.size,
      docType: suggestDocumentType(file.name),
    }));
    setQueued(next);
    setExtractionNotice(null);
    setExtractionError(null);
  }

  function setDocumentType(key: string, docType: DocumentType): void {
    setQueued((current) =>
      current.map((file) => (file.key === key ? { ...file, docType } : file)),
    );
  }

  const busy = pending || extracting !== null;
  const storedOnlyNotice =
    batchSignature && state.documents.every((document) => !document.extractable)
      ? `${state.uploaded} document${state.uploaded === 1 ? "" : "s"} stored securely. No structured extraction is required for the selected categories.`
      : null;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="projectId" value={projectId} />

      <label
        htmlFor="files"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-8 text-center transition-colors hover:border-foreground/30 hover:bg-muted/50"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-background shadow-sm">
          <UploadCloud className="size-5" aria-hidden="true" />
        </span>
        <span className="font-medium">Choose all source documents</span>
        <span className="max-w-md text-sm text-muted-foreground">
          PDF, XLSX, XLS, or CSV. Select several files together, then verify the suggested type for each.
        </span>
      </label>
      <input
        id="files"
        name="file"
        type="file"
        accept=".pdf,.xlsx,.xls,.csv"
        multiple
        required
        disabled={busy}
        onChange={(event) => queueFiles(event.target.files)}
        className="sr-only"
      />

      {queued.length > 0 ? (
        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
            <span className="text-sm font-medium">
              {queued.length} file{queued.length === 1 ? "" : "s"} selected
            </span>
            <span className="text-xs text-muted-foreground">
              {fileSize(queued.reduce((total, file) => total + file.size, 0))} combined
            </span>
          </div>
          <ul className="divide-y">
            {queued.map((file) => (
              <li key={file.key} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_15rem] sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{fileSize(file.size)}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`doc-type-${file.key}`} className="sr-only">
                    Document type for {file.name}
                  </Label>
                  <select
                    id={`doc-type-${file.key}`}
                    name="docType"
                    value={file.docType}
                    onChange={(event) =>
                      setDocumentType(file.key, event.target.value as DocumentType)
                    }
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    {DOC_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DOCUMENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Up to 25 MB combined per upload. Extractable documents are processed automatically after storage.
        </p>
        <Button type="submit" disabled={busy || queued.length === 0} size="lg">
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" /> Uploading…
            </>
          ) : extracting ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" /> Extracting {extracting.current}/
              {extracting.total}
            </>
          ) : (
            <>
              <Sparkles aria-hidden="true" /> Upload and prepare {queued.length || "files"}
            </>
          )}
        </Button>
      </div>

      {extracting ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status">
          Reading {extracting.fileName} and extracting source-grounded values. You can stay on this page.
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
          {state.uploaded > 0 ? ` ${state.uploaded} earlier file(s) in this batch were stored.` : ""}
        </p>
      ) : null}
      {extractionError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {extractionError} Use Retry extraction beside the affected document below.
        </p>
      ) : extractionNotice || storedOnlyNotice ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {extractionNotice ?? storedOnlyNotice}
        </p>
      ) : null}
    </form>
  );
}
