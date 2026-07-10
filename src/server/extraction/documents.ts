import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  ALLOWED_MIME_TYPES,
  validateUpload,
  type DocumentType,
} from "@/schemas/document";

export const DOCUMENTS_BUCKET = "issuer-documents";

export type UploadedDocument =
  Database["public"]["Tables"]["uploaded_documents"]["Row"];

/** Ensure the private documents bucket exists (idempotent). */
async function ensureBucket(): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(DOCUMENTS_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(DOCUMENTS_BUCKET, {
    public: false,
    fileSizeLimit: "25MB",
  });
  // Ignore "already exists" races.
  if (error && !/exists/i.test(error.message)) {
    throw new Error(`Could not create storage bucket: ${error.message}`);
  }
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

/**
 * Upload a source document: validate → store bytes in a private bucket →
 * record metadata (RLS-owner-gated). PII/data never appears in a URL; downloads
 * use short-lived signed URLs.
 */
export async function uploadDocument(params: {
  projectId: string;
  uploaderId: string;
  docType: DocumentType;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<UploadedDocument> {
  const validation = validateUpload({
    mimeType: params.mimeType,
    sizeBytes: params.bytes.byteLength,
    fileName: params.fileName,
  });
  if (!validation.ok) throw new Error(validation.error);

  await ensureBucket();
  const admin = createAdminClient();
  const ext = ALLOWED_MIME_TYPES[params.mimeType];
  const storagePath = `${params.projectId}/${randomUUID()}-${safeName(params.fileName)}`;

  const { error: uploadErr } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, params.bytes, { contentType: params.mimeType, upsert: false });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  // Metadata via the RLS-enforced user client (owner-gated insert).
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("uploaded_documents")
    .insert({
      project_id: params.projectId,
      uploader_id: params.uploaderId,
      doc_type: params.docType,
      file_name: params.fileName,
      storage_path: storagePath,
      mime_type: params.mimeType,
      size_bytes: params.bytes.byteLength,
      parse_status: "pending",
    })
    .select("*")
    .single();
  if (error) {
    // Roll back the stored object so we never orphan storage from metadata.
    await admin.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    throw new Error(`Could not record document: ${error.message} (ext: ${ext})`);
  }
  return data;
}

export async function listDocuments(projectId: string): Promise<UploadedDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("uploaded_documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list documents: ${error.message}`);
  return data ?? [];
}

/** Short-lived signed URL for a document the current user can access (RLS-checked). */
export async function getDocumentSignedUrl(
  documentId: string,
  expiresInSeconds = 300,
): Promise<string> {
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("uploaded_documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) throw new Error("Document not found or not accessible.");

  const admin = createAdminClient();
  const { data, error: signErr } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, expiresInSeconds);
  if (signErr || !data) throw new Error(`Could not sign URL: ${signErr?.message ?? "unknown"}`);
  return data.signedUrl;
}

/** Fetch the raw bytes of a stored document (server-side, for parsing). */
export async function downloadDocumentBytes(storagePath: string): Promise<Uint8Array> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(DOCUMENTS_BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Download failed: ${error?.message ?? "unknown"}`);
  return new Uint8Array(await data.arrayBuffer());
}
