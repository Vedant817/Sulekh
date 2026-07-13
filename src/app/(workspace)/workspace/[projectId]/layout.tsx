import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getProject } from "@/server/projects";

import { ProjectWorkflowNav } from "./workflow-nav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, project] = await Promise.all([getCurrentUser(), getProject(projectId)]);
  if (!project) notFound();

  return (
    <div className="-mx-6 -mt-8">
      <ProjectWorkflowNav
        projectId={projectId}
        projectName={project.name}
        role={user?.profile?.role ?? "promoter"}
      />
      <div className="px-6 py-8">{children}</div>
    </div>
  );
}
