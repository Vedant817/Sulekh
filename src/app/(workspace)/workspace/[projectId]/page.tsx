import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { listDocuments } from "@/server/extraction/documents";
import { listExtractedEntities } from "@/server/extraction/entities";
import { intakeProgress } from "@/server/intake/questionnaire";
import { loadAnswers } from "@/server/intake/store";
import { getProject } from "@/server/projects";

import { AssignForm } from "./assign-form";

const STAGES = [
  { key: "setup", label: "Issuer setup", href: (id: string) => `/workspace/${id}/intake` },
  { key: "generate", label: "Generate draft", href: (id: string) => `/workspace/${id}/generate` },
  { key: "gaps", label: "Gaps & coverage", href: (id: string) => `/workspace/${id}/gaps` },
  { key: "review", label: "Intermediary review", href: (id: string) => `/workspace/${id}/review` },
  { key: "export", label: "Export", href: (id: string) => `/workspace/${id}/export` },
];

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, project, answers, documents, entities] = await Promise.all([
    getCurrentUser(),
    getProject(projectId),
    loadAnswers(projectId),
    listDocuments(projectId),
    listExtractedEntities(projectId),
  ]);
  if (!project) notFound();

  const progress = intakeProgress(answers);
  const confirmedEntities = entities.filter((entity) => entity.confirmed_by_promoter).length;
  const isOwner = user?.id === project.owner_id;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/workspace" className="text-sm text-muted-foreground hover:underline">
          ← All projects
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize">
            {project.status}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {project.target_board.replace("_", " ")} · Draft DRHP workspace
        </p>
      </div>

      <div className="grid gap-3">
        {STAGES.map((s) => (
          <Link
            key={s.key}
            href={s.href(projectId)}
            className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted"
          >
            <span className="font-medium">{s.label}</span>
            {s.key === "setup" ? (
              <span className="text-sm text-muted-foreground">
                {progress.requiredAnswered}/{progress.requiredVisible} answers · {documents.length} files ·{" "}
                {confirmedEntities}/{entities.length} reviewed
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Open →</span>
            )}
          </Link>
        ))}
      </div>

      {isOwner ? (
        <AssignForm projectId={projectId} assigned={Boolean(project.assigned_intermediary_id)} />
      ) : null}
    </div>
  );
}
