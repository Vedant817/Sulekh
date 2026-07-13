import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { listDocuments } from "@/server/extraction/documents";
import { listExtractedEntities } from "@/server/extraction/entities";
import { getGapCount, listSections } from "@/server/generation/status";
import { intakeProgress } from "@/server/intake/questionnaire";
import { loadAnswers } from "@/server/intake/store";
import { getProject } from "@/server/projects";
import { getApprovalState } from "@/server/review/service";

import { AssignForm } from "./assign-form";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, project, answers, documents, entities, sections, gaps, approval] = await Promise.all([
    getCurrentUser(),
    getProject(projectId),
    loadAnswers(projectId),
    listDocuments(projectId),
    listExtractedEntities(projectId),
    listSections(projectId),
    getGapCount(projectId),
    getApprovalState(projectId),
  ]);
  if (!project) notFound();

  const progress = intakeProgress(answers);
  const confirmedEntities = entities.filter((entity) => entity.confirmed_by_promoter).length;
  const isOwner = user?.id === project.owner_id;
  const isIntermediary = user?.profile?.role === "intermediary";
  const setupComplete =
    progress.complete &&
    documents.length > 0 &&
    entities.length > 0 &&
    confirmedEntities === entities.length;
  const hasDraft = sections.length > 0;

  const nextAction = isIntermediary
    ? {
        href: `/workspace/${projectId}/review`,
        label: "Open review workspace",
        detail: "Review coverage issues and draft sections together, then record comments or approvals.",
      }
    : !setupComplete
      ? {
          href: `/workspace/${projectId}/intake`,
          label: "Continue issuer setup",
          detail: "Complete required answers, upload source documents, and confirm extracted values.",
        }
      : !hasDraft
        ? {
            href: `/workspace/${projectId}/generate`,
            label: "Generate the grounded draft",
            detail: "Issuer setup is complete. Generate all sections from confirmed facts and current requirements.",
          }
        : gaps.total > 0
          ? {
              href: `/workspace/${projectId}/gaps`,
              label: "Resolve gaps and inconsistencies",
              detail: `${gaps.total} open issue${gaps.total === 1 ? "" : "s"}${gaps.blockers > 0 ? `, including ${gaps.blockers} blocker${gaps.blockers === 1 ? "" : "s"}` : ""}.`,
            }
          : !project.assigned_intermediary_id
            ? {
                href: "#assignment",
                label: "Assign an authorised intermediary",
                detail: "Coverage checks pass. Assign the reviewer who will approve the mandatory sections.",
              }
            : !approval.fullyApproved
              ? {
                  href: `/workspace/${projectId}/review`,
                  label: "Continue intermediary review",
                  detail: `${approval.mandatoryApproved}/${approval.mandatoryTotal} mandatory sections approved.`,
                }
              : {
                  href: `/workspace/${projectId}/export`,
                  label: "Export the reviewed draft",
                  detail: "All mandatory sections are approved. Download the DRHP and coverage report.",
                };

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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Project status">
        <StatusCard
          label="Issuer setup"
          value={`${progress.requiredAnswered}/${progress.requiredVisible}`}
          detail={`${documents.length} files · ${confirmedEntities}/${entities.length} values reviewed`}
          complete={setupComplete}
        />
        <StatusCard
          label="Draft"
          value={hasDraft ? `${sections.length} sections` : "Not generated"}
          detail={hasDraft ? "Grounded draft available" : "Complete setup first"}
          complete={hasDraft}
        />
        <StatusCard
          label="Open issues"
          value={`${gaps.total}`}
          detail={gaps.blockers > 0 ? `${gaps.blockers} blockers` : "No blockers"}
          complete={hasDraft && gaps.total === 0}
        />
        <StatusCard
          label="Approvals"
          value={`${approval.mandatoryApproved}/${approval.mandatoryTotal}`}
          detail="Mandatory sections"
          complete={approval.fullyApproved}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recommended next action</p>
          <h2 className="mt-1 text-xl font-semibold">{nextAction.label}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{nextAction.detail}</p>
        </div>
        <Button size="lg" render={<Link href={nextAction.href} />}>
          Continue <ArrowRight aria-hidden="true" />
        </Button>
      </section>

      {isOwner ? (
        <div id="assignment" className="scroll-mt-28">
          <AssignForm projectId={projectId} assigned={Boolean(project.assigned_intermediary_id)} />
        </div>
      ) : null}
    </div>
  );
}

function StatusCard({
  label,
  value,
  detail,
  complete,
}: {
  label: string;
  value: string;
  detail: string;
  complete: boolean;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {complete ? (
          <CheckCircle2 className="size-4 text-emerald-700" aria-label="Complete" />
        ) : (
          <CircleDashed className="size-4 text-muted-foreground" aria-label="In progress" />
        )}
      </div>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
