"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  generationStatusAction,
  startGenerationAction,
  type GenerationStatus,
} from "./actions";

const ACTIVE = new Set(["queued", "running"]);

export function GeneratePanel({
  projectId,
  initial,
}: {
  projectId: string;
  initial: GenerationStatus;
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
        <div className="flex flex-col">
          <span className="font-medium">Generate the draft DRHP</span>
          <span className="text-sm text-muted-foreground">
            Every section is grounded in your confirmed data and the SME requirement
            checklist; unknowns are marked as gaps, never invented.
          </span>
        </div>
        <Button onClick={start} disabled={starting || active}>
          {active ? "Generating…" : starting ? "Starting…" : job?.state === "succeeded" ? "Regenerate" : "Generate"}
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
          {job.error ? <p className="text-sm text-destructive">{job.error}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No draft generated yet.</p>
      )}

      {status.sections.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Sections ({status.sections.length})
          </h2>
          <ul className="flex flex-col gap-1.5">
            {status.sections.map((s) => (
              <li
                key={s.sectionKey}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
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
