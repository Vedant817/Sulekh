import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import {
  getApprovalState,
  getAuditLog,
  getComments,
  getReviewSections,
} from "@/server/review/service";
import { getProject } from "@/server/projects";

import { ReviewConsole } from "./review-console";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, project] = await Promise.all([getCurrentUser(), getProject(projectId)]);
  if (!project) notFound();

  const [sections, comments, approval, audit] = await Promise.all([
    getReviewSections(projectId),
    getComments(projectId),
    getApprovalState(projectId),
    getAuditLog(projectId),
  ]);

  const role = user?.profile?.role ?? "promoter";
  const isAssignedIntermediary = role === "intermediary" && project.assigned_intermediary_id === user?.id;
  const canReview = isAssignedIntermediary || role === "admin";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href={`/workspace/${projectId}`} className="text-sm text-muted-foreground hover:underline">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Intermediary review</h1>
        <p className="text-muted-foreground">
          {canReview
            ? "Comment, edit, and approve each section. Every action is recorded in an immutable audit trail."
            : "Review status and comments from your authorised intermediary. Only they can approve sections."}
        </p>
      </div>

      <ReviewConsole
        projectId={projectId}
        sections={sections.map((s) => ({
          id: s.id,
          sectionKey: s.section_key,
          title: s.title,
          status: s.status,
          markdown: s.draft_markdown ?? "",
          isMandatory: s.is_mandatory,
        }))}
        comments={comments.map((c) => ({
          sectionKey: c.section_key,
          comment: c.comment,
          createdAt: c.created_at,
        }))}
        approval={{
          mandatoryApproved: approval.mandatoryApproved,
          mandatoryTotal: approval.mandatoryTotal,
          fullyApproved: approval.fullyApproved,
        }}
        canReview={canReview}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Audit trail ({audit.length})
        </h2>
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {audit.slice(0, 50).map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="tabular-nums">{new Date(e.created_at).toLocaleString("en-IN")}</span>
              <span className="font-medium text-foreground">{e.action}</span>
              {e.section_key ? <span>· {e.section_key}</span> : null}
              {e.comment ? <span>· “{e.comment}”</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
