"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

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
  canReview,
  onChanged,
}: {
  projectId: string;
  section: ConsoleSection;
  comments: ConsoleComment[];
  canReview: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.markdown ?? "");
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed.");
      else onChanged();
    });
  }

  return (
    <li id={section.sectionKey} className="flex scroll-mt-20 flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">
          {section.title}
          {section.isMandatory ? <span className="text-destructive"> *</span> : null}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[section.status] ?? ""}`}>
          {section.status.replace("_", " ")}
        </span>
      </div>

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
  canReview,
}: {
  projectId: string;
  sections: ConsoleSection[];
  comments: ConsoleComment[];
  approval: { mandatoryApproved: number; mandatoryTotal: number; fullyApproved: boolean };
  canReview: boolean;
}) {
  const router = useRouter();
  const commentsBySection = new Map<string, ConsoleComment[]>();
  for (const c of comments) {
    if (!c.sectionKey) continue;
    const list = commentsBySection.get(c.sectionKey) ?? [];
    list.push(c);
    commentsBySection.set(c.sectionKey, list);
  }

  return (
    <div className="flex flex-col gap-6">
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
              canReview={canReview}
              onChanged={() => router.refresh()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
