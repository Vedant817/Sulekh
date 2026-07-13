import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { generationStatusAction } from "./actions";
import { getProject } from "@/server/projects";

import { GeneratePanel } from "./generate-panel";

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, user] = await Promise.all([getProject(projectId), getCurrentUser()]);
  if (!project) notFound();

  const initial = await generationStatusAction(projectId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/workspace/${projectId}`} className="text-sm text-muted-foreground hover:underline">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Generate draft</h1>
        <p className="text-muted-foreground">
          The orchestrator drafts each DRHP section in dependency order, records
          provenance, and independently verifies coverage against the checklist.
        </p>
      </div>
      <GeneratePanel
        projectId={projectId}
        initial={initial}
        role={user?.profile?.role ?? "promoter"}
      />
    </div>
  );
}
