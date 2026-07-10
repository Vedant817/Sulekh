"use server";

import { revalidatePath } from "next/cache";

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
import { documentTypeSchema, validateUpload } from "@/schemas/document";

export type UploadState = { ok: boolean; error: string | null };

export async function uploadDocumentAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const projectId = String(formData.get("projectId") ?? "");
  const project = await getProject(projectId);
  if (!project) return { ok: false, error: "Project not found or not accessible." };

  const docTypeParsed = documentTypeSchema.safeParse(formData.get("docType"));
  if (!docTypeParsed.success) return { ok: false, error: "Choose a valid document type." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Select a file to upload." };

  const validation = validateUpload({
    mimeType: file.type,
    sizeBytes: file.size,
    fileName: file.name,
  });
  if (!validation.ok) return { ok: false, error: validation.error };

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadDocument({
      projectId,
      uploaderId: user.id,
      docType: docTypeParsed.data,
      fileName: file.name,
      mimeType: file.type,
      bytes,
    });
    revalidatePath(`/workspace/${projectId}/documents`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
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

/** Parse a stored document and run structured extraction into unconfirmed entities. */
export async function parseAndExtractAction(
  projectId: string,
  documentId: string,
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
      projectId,
      documentId,
      docType: doc.doc_type,
      text,
    });
    revalidatePath(`/workspace/${projectId}/documents`);
    return { ok: true, error: null, total: result.total };
  } catch (err) {
    revalidatePath(`/workspace/${projectId}/documents`);
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
  revalidatePath(`/workspace/${projectId}/documents`);
  return { ok: true, error: null };
}
