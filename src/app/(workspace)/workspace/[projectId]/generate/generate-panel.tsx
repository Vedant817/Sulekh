"use client";

import { ArrowRight, CheckCircle2, ListChecks, MessagesSquare, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { GenerationReadiness } from "@/server/generation/readiness-rules";

import {
  generationStatusAction,
  startGenerationAction,
  type GenerationStatus,
} from "./actions";

const ACTIVE = new Set(["queued", "running"]);

export function GeneratePanel({
  projectId,
  initial,
  readiness,
  role,
}: {
  projectId: string;
  initial: GenerationStatus;
  readiness: GenerationReadiness;
  role: string;
}) {
  const [status, setStatus] = useState<GenerationStatus>(initial);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    setStatus(await generationStatusAction(projectId));
  }, [projectId]);

  // While a job is active, re-poll 2s after each status update; the effect
  // re-runs on every `status` change until the job leaves an active state.
  useEffect(() => {
    if (!(status.job && ACTIVE.has(status.job.state))) return;
    const id = setTimeout(() => {
      void poll();
    }, 2000);
    return () => clearTimeout(id);
  }, [status, poll]);

  async function start() {
    setStarting(true);
    setError(null);
    const res = await startGenerationAction(projectId);
    setStarting(false);
    if (!res.ok) {
      setError(res.error ?? "Could not start generation.");
      return;
    }
    void poll();
  }

  const job = status.job;
  const active = job ? ACTIVE.has(job.state) : false;
  const succeeded = job?.state === "succeeded";
  const resumable = job?.state === "failed" && job.completedSections > 0 && job.completedSections < job.totalSections;
  const nextHref = role === "intermediary"
    ? `/workspace/${projectId}/review`
    : `/workspace/${projectId}/gaps`;
  const nextLabel = role === "intermediary" ? "Open review workspace" : "Review gaps & coverage";

  return (
    <div className="flex flex-col gap-6">
      {!readiness.ready ? (
        <section className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Finish issuer setup before generating</h2>
              <p className="mt-1 text-sm text-amber-900/80">
                Drafting is paused so unreviewed source data cannot enter the DRHP.
              </p>
            </div>
          </div>
          <ol className="grid gap-1 text-sm">
            {readiness.issues.map((issue) => (
              <li key={`${issue.focus}-${issue.message}`} className="flex items-start gap-2">
                <span aria-hidden="true">•</span>
                <span>{issue.message}</span>
              </li>
            ))}
          </ol>
          <Link
            href={`/workspace/${projectId}/intake#${readiness.issues[0]?.focus ?? "details"}`}
            className={buttonVariants({ size: "lg" })}
          >
            Continue issuer setup <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
        <div className="flex flex-col">
          <span className="font-medium">Generate the draft DRHP</span>
          <span className="text-sm text-muted-foreground">
            Every section is grounded in your confirmed data and the SME requirement
            checklist; unknowns are marked as gaps, never invented.
          </span>
        </div>
        <Button onClick={start} disabled={!readiness.ready || starting || active}>
          {active
            ? "Generating…"
            : starting
              ? "Starting…"
              : job?.state === "succeeded"
                ? "Regenerate"
                : resumable
                  ? "Resume generation"
                  : "Generate"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {job ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${job.state === "failed" ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {job.completedSections}/{job.totalSections}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            <span>
              Status: <span className="font-medium capitalize">{job.state}</span>
            </span>
            {job.currentSection && active ? <span>Current: {job.currentSection}</span> : null}
            {job.modelUsed ? <span>Model: {job.modelUsed}</span> : null}
            <span>
              Gaps: {status.gaps.total}
              {status.gaps.blockers > 0 ? ` (${status.gaps.blockers} blocker)` : ""}
            </span>
          </div>
          {job.error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/[0.035] p-3">
              <p className="text-sm text-destructive">{job.error}</p>
              {resumable ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {job.completedSections} completed sections are preserved. Resume generation to continue with the remaining {job.totalSections - job.completedSections} section{job.totalSections - job.completedSections === 1 ? "" : "s"}; completed sections will not be billed or generated again.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No draft generated yet.</p>
      )}

      {succeeded ? (
        <section
          aria-live="polite"
          className="flex flex-col gap-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Draft generated — here is what to do next</h2>
              <p className="mt-1 text-sm text-emerald-900/80">
                {status.gaps.total > 0
                  ? `${status.gaps.total} issue${status.gaps.total === 1 ? "" : "s"} need attention before final approval${status.gaps.blockers > 0 ? `, including ${status.gaps.blockers} blocker${status.gaps.blockers === 1 ? "" : "s"}` : ""}.`
                  : "No current flags were found. The authorised intermediary still needs to review every mandatory section."}
              </p>
            </div>
          </div>
          <ol className="grid gap-2 text-sm sm:grid-cols-3">
            <li className="flex gap-2 rounded-lg bg-white/70 p-3">
              <ListChecks className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span><strong>1. Check issues.</strong> Review missing disclosures and conflicting figures.</span>
            </li>
            <li className="flex gap-2 rounded-lg bg-white/70 p-3">
              <MessagesSquare className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span><strong>2. Resolve and review.</strong> Correct source data or edit/comment on the highlighted section.</span>
            </li>
            <li className="flex gap-2 rounded-lg bg-white/70 p-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span><strong>3. Approve and export.</strong> Re-run checks before mandatory approvals.</span>
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Link href={nextHref} className={buttonVariants({ size: "lg" })}>
              {nextLabel} <ArrowRight aria-hidden="true" />
            </Link>
            {role !== "intermediary" ? (
              <Link
                href={`/workspace/${projectId}/review`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                See intermediary review
              </Link>
            ) : (
              <Link
                href={`/workspace/${projectId}/gaps`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Open full coverage report
              </Link>
            )}
          </div>
        </section>
      ) : null}

      {status.sections.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Sections ({status.sections.length})
          </h2>
          <ul className="flex flex-col gap-1.5">
            {status.sections.map((s) => (
              <li
                key={s.sectionKey}
                id={s.sectionKey}
                className="flex items-center justify-between scroll-mt-20 rounded-lg border p-3 text-sm"
              >
                <span className="font-medium">{s.title}</span>
                <span className="text-xs text-muted-foreground">
                  {s.modelUsed ? `${s.modelUsed} · ` : ""}
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
