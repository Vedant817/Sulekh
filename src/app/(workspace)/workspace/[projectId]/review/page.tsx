import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { buildCoverageReport } from "@/server/gaps/report";
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
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string; section?: string; requirement?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const [user, project] = await Promise.all([getCurrentUser(), getProject(projectId)]);
  if (!project) notFound();

  const [sections, comments, approval, audit, coverage] = await Promise.all([
    getReviewSections(projectId),
    getComments(projectId),
    getApprovalState(projectId),
    getAuditLog(projectId),
    buildCoverageReport(getSql(), projectId),
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

      {query.from === "gaps" ? (
        <aside className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Flagged section opened for review</h2>
            <p className="mt-1 text-sm text-amber-900/80">
              The affected section is highlighted below
              {query.requirement ? ` for requirement ${query.requirement}` : ""}. Review its gap messages, edit or request a source correction, then use <strong>Re-run checks</strong> without leaving this page.
            </p>
          </div>
        </aside>
      ) : null}

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
        coverage={{
          percent: coverage.coveragePercent,
          mandatoryMissing: coverage.totals.mandatoryMissing,
          openFlags: coverage.gaps.length,
        }}
        gaps={coverage.gaps}
        focusedSection={query.from === "gaps" ? query.section ?? null : null}
        focusedRequirement={query.from === "gaps" ? query.requirement ?? null : null}
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
