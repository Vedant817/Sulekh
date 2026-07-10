import Link from "next/link";
import { notFound } from "next/navigation";

import { listDocuments } from "@/server/extraction/documents";
import { listExtractedEntities } from "@/server/extraction/entities";
import { getProject } from "@/server/projects";

import { DocumentList } from "./document-list";
import { ExtractedEntities } from "./extracted-entities";
import { UploadForm } from "./upload-form";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [documents, entities] = await Promise.all([
    listDocuments(projectId),
    listExtractedEntities(projectId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/workspace/${projectId}`} className="text-sm text-muted-foreground hover:underline">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Documents & extraction</h1>
        <p className="text-muted-foreground">
          Upload source documents (audited financials, MoA/AoA, cap table, litigation
          register, KYC). Extracted values are confirmed by you before they enter the draft.
        </p>
      </div>
      <UploadForm projectId={projectId} />
      <DocumentList projectId={projectId} documents={documents} />
      <ExtractedEntities projectId={projectId} entities={entities} />
    </div>
  );
}
