import Link from "next/link";
import { notFound } from "next/navigation";

import { intakeProgress } from "@/server/intake/questionnaire";
import { loadAnswers } from "@/server/intake/store";
import { getProject } from "@/server/projects";

const STAGES = [
  { key: "intake", label: "Guided intake", href: (id: string) => `/workspace/${id}/intake`, ready: true },
  { key: "documents", label: "Documents & extraction", href: (id: string) => `/workspace/${id}/documents`, ready: true },
];

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const answers = await loadAnswers(projectId);
  const progress = intakeProgress(answers);

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
            {s.key === "intake" ? (
              <span className="text-sm text-muted-foreground">
                {progress.requiredAnswered}/{progress.requiredVisible} required
                {progress.complete ? " · complete" : ""}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Open →</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
