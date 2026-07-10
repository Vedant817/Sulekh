import Link from "next/link";
import { notFound } from "next/navigation";

import { loadAnswers } from "@/server/intake/store";
import { getProject } from "@/server/projects";

import { IntakeForm } from "./intake-form";

export default async function IntakePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const answers = await loadAnswers(projectId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/workspace/${projectId}`} className="text-sm text-muted-foreground hover:underline">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Guided intake</h1>
        <p className="text-muted-foreground">
          Answer the questions relevant to your issuer. Answers save automatically and
          you can leave and resume anytime.
        </p>
      </div>
      <IntakeForm projectId={projectId} initialAnswers={answers} />
    </div>
  );
}
