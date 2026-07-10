"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { uploadDocument, getDocumentSignedUrl } from "@/server/extraction/documents";
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
