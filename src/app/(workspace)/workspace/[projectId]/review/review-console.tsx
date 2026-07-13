"use client";

import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

import { recheckGapsAction } from "../gaps/actions";

import {
  addCommentAction,
  editSectionAction,
  setSectionStatusAction,
} from "./actions";

export type ConsoleSection = {
  id: string;
  sectionKey: string;
  title: string;
  status: string;
  markdown: string;
  isMandatory: boolean;
};
export type ConsoleComment = { sectionKey: string | null; comment: string | null; createdAt: string };
export type ReviewGap = {
  flagType: string;
  severity: string;
  sectionKey: string | null;
  fieldKey: string | null;
  message: string;
};

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  needs_changes: "bg-amber-100 text-amber-700",
  draft: "bg-muted text-muted-foreground",
  empty: "bg-muted text-muted-foreground",
  generating: "bg-blue-100 text-blue-700",
};

function SectionCard({
  projectId,
  section,
  comments,
  gaps,
  isFocused,
  focusedRequirement,
  canReview,
  onChanged,
}: {
  projectId: string;
  section: ConsoleSection;
  comments: ConsoleComment[];
  gaps: ReviewGap[];
  isFocused: boolean;
  focusedRequirement: string | null;
  canReview: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.markdown ?? "");
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const blockers = gaps.filter((gap) => gap.severity === "blocker");

  function act(fn: () => Promise<{ ok: boolean; error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed.");
      else onChanged();
    });
  }

  return (
    <li
      id={section.sectionKey}
      data-focused={isFocused ? "true" : undefined}
      className={`flex scroll-mt-32 flex-col gap-3 rounded-xl border p-4 transition-all ${isFocused ? "border-amber-400 bg-amber-50/60 ring-4 ring-amber-200" : blockers.length > 0 ? "border-destructive/30" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">
          {section.title}
          {section.isMandatory ? <span className="text-destructive"> *</span> : null}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[section.status] ?? ""}`}>
          {section.status.replace("_", " ")}
        </span>
      </div>

      {isFocused ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Opened from Gaps & coverage{focusedRequirement ? <> for <strong>{focusedRequirement}</strong></> : null}. This highlight identifies the section that needs attention.
        </div>
      ) : null}

      {gaps.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/[0.035] p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
            {gaps.length} open issue{gaps.length === 1 ? "" : "s"} for this section
          </div>
          <ul className="space-y-1.5 text-xs leading-5 text-muted-foreground">
            {gaps.map((gap) => (
              <li key={`${gap.flagType}-${gap.sectionKey}-${gap.fieldKey}-${gap.message}`}>
                <span className="font-medium uppercase text-foreground">{gap.severity}</span>
                {gap.fieldKey ? ` · ${gap.fieldKey}` : ""}: {gap.message}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Resolve the text or source data, then use <strong>Re-run checks</strong> above before approval.
          </p>
        </div>
      ) : null}

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            className="rounded-lg border border-input bg-background p-2 font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                act(async () => {
                  const r = await editSectionAction(projectId, section.id, section.sectionKey, draft);
                  if (r.ok) setEditing(false);
                  return r;
                })
              }
            >
              Save edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-2 text-xs">
          {section.markdown?.slice(0, 4000) || "(no draft yet)"}
        </pre>
      )}

      {comments.length > 0 ? (
        <ul className="flex flex-col gap-1 border-l-2 border-muted pl-3">
          {comments.map((c, i) => (
            <li key={i} className="text-sm">
              {c.comment}
            </li>
          ))}
        </ul>
      ) : null}

      {canReview ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              className="h-8 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pending || comment.trim().length === 0}
              onClick={() =>
                act(async () => {
                  const r = await addCommentAction(projectId, section.sectionKey, comment);
                  if (r.ok) setComment("");
                  return r;
                })
              }
            >
              Comment
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {!editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => act(() => setSectionStatusAction(projectId, section.id, section.sectionKey, "needs_changes"))}
            >
              Needs changes
            </Button>
            <Button
              size="sm"
              disabled={pending || section.status === "approved"}
              onClick={() => act(() => setSectionStatusAction(projectId, section.id, section.sectionKey, "approved"))}
            >
              {section.status === "approved" ? "Approved" : "Approve"}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </li>
  );
}

export function ReviewConsole({
  projectId,
  sections,
  comments,
  approval,
  coverage,
  gaps,
  focusedSection,
  focusedRequirement,
  canReview,
}: {
  projectId: string;
  sections: ConsoleSection[];
  comments: ConsoleComment[];
  approval: { mandatoryApproved: number; mandatoryTotal: number; fullyApproved: boolean };
  coverage: { percent: number; mandatoryMissing: number; openFlags: number };
  gaps: ReviewGap[];
  focusedSection: string | null;
  focusedRequirement: string | null;
  canReview: boolean;
}) {
  const router = useRouter();
  const [checking, startChecking] = useTransition();
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const commentsBySection = new Map<string, ConsoleComment[]>();
  for (const c of comments) {
    if (!c.sectionKey) continue;
    const list = commentsBySection.get(c.sectionKey) ?? [];
    list.push(c);
    commentsBySection.set(c.sectionKey, list);
  }
  const gapsBySection = new Map<string, ReviewGap[]>();
  for (const gap of gaps) {
    if (!gap.sectionKey) continue;
    const list = gapsBySection.get(gap.sectionKey) ?? [];
    list.push(gap);
    gapsBySection.set(gap.sectionKey, list);
  }
  const openBlockers = gaps.filter((gap) => gap.severity === "blocker").length;

  function recheck() {
    setCheckMessage(null);
    setCheckError(null);
    startChecking(async () => {
      const result = await recheckGapsAction(projectId);
      if (!result.ok) {
        setCheckError(result.error ?? "Re-check failed.");
        return;
      }
      const mandatoryMissing = result.summary?.missingMandatory ?? 0;
      const inconsistencies = result.summary?.inconsistencies ?? 0;
      setCheckMessage(
        `Checks refreshed: ${mandatoryMissing} mandatory gap${mandatoryMissing === 1 ? "" : "s"}, ${inconsistencies} ${inconsistencies === 1 ? "inconsistency" : "inconsistencies"}.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={`flex flex-col gap-4 rounded-xl border p-4 ${openBlockers > 0 ? "border-destructive/30 bg-destructive/[0.025]" : "bg-muted/20"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {openBlockers > 0 ? (
                <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4 text-emerald-700" aria-hidden="true" />
              )}
              <h2 className="font-medium">Coverage is part of this review</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {coverage.percent}% covered · {coverage.mandatoryMissing} mandatory missing · {coverage.openFlags} open flags
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={recheck} disabled={checking}>
              <RefreshCw className={checking ? "animate-spin" : ""} aria-hidden="true" />
              {checking ? "Re-checking…" : "Re-run checks"}
            </Button>
            <Link href={`/workspace/${projectId}/gaps`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Full coverage report
            </Link>
          </div>
        </div>
        {openBlockers > 0 ? (
          <p className="text-sm text-destructive">
            Resolve the highlighted blocker messages before approval whenever possible. You can edit and re-check without leaving this workspace.
          </p>
        ) : (
          <p className="text-sm text-emerald-700">No blocker flags are open. Continue the section-by-section legal and factual review.</p>
        )}
        {checkMessage ? <p aria-live="polite" className="text-sm text-emerald-700">{checkMessage}</p> : null}
        {checkError ? <p role="alert" className="text-sm text-destructive">{checkError}</p> : null}
      </section>

      <div className="flex items-center justify-between rounded-xl border p-4">
        <div className="flex flex-col">
          <span className="font-medium">
            {approval.fullyApproved
              ? "All mandatory sections approved — un-watermarked export unlocked."
              : "Draft is watermarked until all mandatory sections are approved."}
          </span>
          <span className="text-sm text-muted-foreground">
            {approval.mandatoryApproved}/{approval.mandatoryTotal} mandatory sections approved
          </span>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${approval.mandatoryTotal ? (approval.mandatoryApproved / approval.mandatoryTotal) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sections generated yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sections.map((s) => (
            <SectionCard
              key={s.id}
              projectId={projectId}
              section={s}
              comments={commentsBySection.get(s.sectionKey) ?? []}
              gaps={gapsBySection.get(s.sectionKey) ?? []}
              isFocused={focusedSection === s.sectionKey}
              focusedRequirement={focusedSection === s.sectionKey ? focusedRequirement : null}
              canReview={canReview}
              onChanged={() => router.refresh()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
