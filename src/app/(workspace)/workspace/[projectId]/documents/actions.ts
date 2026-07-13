"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  uploadDocument,
  getDocumentSignedUrl,
  downloadDocumentBytes,
} from "@/server/extraction/documents";
import { extractFromDocument } from "@/server/extraction/extract";
import { parsePdf, parseXlsx, workbookToText } from "@/server/extraction/parse";
import { getProject } from "@/server/projects";
import {
  documentTypeSchema,
  validateUpload,
  validateUploadBatch,
  type DocumentType,
} from "@/schemas/document";
import { DOC_TYPE_ENTITIES } from "@/schemas/extraction";

export type UploadedForExtraction = {
  id: string;
  fileName: string;
  extractable: boolean;
};

export type UploadState = {
  ok: boolean;
  error: string | null;
  uploaded: number;
  documents: UploadedForExtraction[];
};

function revalidateSetup(projectId: string): void {
  revalidatePath(`/workspace/${projectId}`);
  revalidatePath(`/workspace/${projectId}/intake`);
  revalidatePath(`/workspace/${projectId}/documents`);
}

export async function uploadDocumentAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "You must be signed in.", uploaded: 0, documents: [] };
  }

  const projectId = String(formData.get("projectId") ?? "");
  const project = await getProject(projectId);
  if (!project || project.owner_id !== user.id) {
    return {
      ok: false,
      error: "Project not found or not accessible.",
      uploaded: 0,
      documents: [],
    };
  }

  const files = formData
    .getAll("file")
    .filter((value): value is File => value instanceof File && value.name.length > 0);
  const batchValidation = validateUploadBatch(files.map((file) => ({ sizeBytes: file.size })));
  if (!batchValidation.ok) {
    return { ok: false, error: batchValidation.error, uploaded: 0, documents: [] };
  }

  const typeValues = formData.getAll("docType");
  if (typeValues.length !== files.length) {
    return {
      ok: false,
      error: "Choose a document type for every selected file.",
      uploaded: 0,
      documents: [],
    };
  }

  const docTypes: DocumentType[] = [];
  for (const value of typeValues) {
    const parsed = documentTypeSchema.safeParse(value);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Choose a valid document type for every selected file.",
        uploaded: 0,
        documents: [],
      };
    }
    docTypes.push(parsed.data);
  }

  for (const file of files) {
    const validation = validateUpload({
      mimeType: file.type,
      sizeBytes: file.size,
      fileName: file.name,
    });
    if (!validation.ok) {
      return { ok: false, error: `${file.name}: ${validation.error}`, uploaded: 0, documents: [] };
    }
  }

  const uploaded: UploadedForExtraction[] = [];
  for (const [index, file] of files.entries()) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const document = await uploadDocument({
        projectId,
        uploaderId: user.id,
        docType: docTypes[index],
        fileName: file.name,
        mimeType: file.type,
        bytes,
      });
      uploaded.push({
        id: document.id,
        fileName: document.file_name,
        extractable: (DOC_TYPE_ENTITIES[document.doc_type] ?? []).length > 0,
      });
    } catch (err) {
      revalidateSetup(projectId);
      return {
        ok: false,
        error: `${file.name}: ${err instanceof Error ? err.message : "Upload failed."}`,
        uploaded: uploaded.length,
        documents: uploaded,
      };
    }
  }

  revalidateSetup(projectId);
  return { ok: true, error: null, uploaded: uploaded.length, documents: uploaded };
}

export async function signedUrlAction(
  documentId: string,
): Promise<{ url: string | null; error: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { url: null, error: "You must be signed in." };
  try {
    const url = await getDocumentSignedUrl(documentId);
    return { url, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : "Could not generate link." };
  }
}

export type ExtractState = { ok: boolean; error: string | null; total?: number };

type StoredDocument = {
  id: string;
  project_id: string;
  doc_type: string;
  mime_type: string | null;
  storage_path: string;
};

async function extractStoredDocument(doc: StoredDocument): Promise<number> {
  if (!doc.mime_type) throw new Error("Document metadata is missing its MIME type.");
  const bytes = await downloadDocumentBytes(doc.storage_path);
  let text: string;
  if (doc.mime_type === "application/pdf") {
    const { pages } = await parsePdf(bytes);
    text = pages.join("\n\n");
  } else {
    text = workbookToText(parseXlsx(bytes));
  }
  if (text.trim().length === 0) {
    throw new Error("No extractable text (scanned document? OCR is a v2 path).");
  }

  const result = await extractFromDocument({
    projectId: doc.project_id,
    documentId: doc.id,
    docType: doc.doc_type,
    text,
  });
  return result.total;
}

/** Parse a stored document and run structured extraction into unconfirmed entities. */
export async function parseAndExtractAction(
  projectId: string,
  documentId: string,
  revalidateAfter = true,
): Promise<ExtractState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("uploaded_documents")
    .select("id, project_id, doc_type, mime_type, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!doc || doc.project_id !== projectId) {
    return { ok: false, error: "Document not found or not accessible." };
  }

  try {
    const total = await extractStoredDocument(doc);
    if (revalidateAfter) revalidateSetup(projectId);
    return { ok: true, error: null, total };
  } catch (err) {
    if (revalidateAfter) revalidateSetup(projectId);
    return { ok: false, error: err instanceof Error ? err.message : "Extraction failed." };
  }
}

/** Confirm an extracted entity (optionally with a promoter correction). */
export async function confirmEntityAction(
  projectId: string,
  entityId: string,
  correctedData?: unknown,
): Promise<{ ok: boolean; error: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("extracted_entities")
    .update({
      confirmed_by_promoter: true,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
      ...(correctedData !== undefined ? { corrected_data: correctedData as never } : {}),
    })
    .eq("id", entityId);
  if (error) return { ok: false, error: error.message };
  revalidateSetup(projectId);
  return { ok: true, error: null };
}

const entityIdsSchema = z.array(z.string().uuid()).min(1).max(500);

/**
 * Confirm a reviewed entity group in one explicit promoter action. The UI
 * requires a review attestation first; this action still re-checks ownership
 * and the full ID set before changing any row.
 */
export async function confirmEntitiesAction(
  projectId: string,
  entityIds: string[],
): Promise<{ ok: boolean; error: string | null; confirmed: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in.", confirmed: 0 };

  const project = await getProject(projectId);
  if (!project || project.owner_id !== user.id) {
    return { ok: false, error: "Project not found or not accessible.", confirmed: 0 };
  }

  const parsedIds = entityIdsSchema.safeParse([...new Set(entityIds)]);
  if (!parsedIds.success) {
    return { ok: false, error: "Choose a valid group of extracted values.", confirmed: 0 };
  }

  const supabase = await createClient();
  const { data: rows, error: loadError } = await supabase
    .from("extracted_entities")
    .select("id")
    .eq("project_id", projectId)
    .in("id", parsedIds.data);
  if (loadError) return { ok: false, error: loadError.message, confirmed: 0 };
  if ((rows ?? []).length !== parsedIds.data.length) {
    return {
      ok: false,
      error: "One or more extracted values are no longer available. Refresh and review again.",
      confirmed: 0,
    };
  }

  const { error } = await supabase
    .from("extracted_entities")
    .update({
      confirmed_by_promoter: true,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("project_id", projectId)
    .in("id", parsedIds.data);
  if (error) return { ok: false, error: error.message, confirmed: 0 };

  revalidateSetup(projectId);
  return { ok: true, error: null, confirmed: parsedIds.data.length };
}
