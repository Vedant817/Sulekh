"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { recheckGapsAction } from "./actions";

type Gap = {
  flagType: string;
  severity: string;
  sectionKey: string | null;
  fieldKey: string | null;
  message: string;
};

/** Map a flag to the editor where it can be fixed (jump-to-fix). */
function fixHref(projectId: string, gap: Gap): string {
  if (gap.flagType === "inconsistent") {
    // Reconciliation issues are fixed in the confirmed source data.
    return `/workspace/${projectId}/documents`;
  }
  // Coverage gaps are fixed by (re)generating / editing the section.
  return `/workspace/${projectId}/generate${gap.sectionKey ? `#${gap.sectionKey}` : ""}`;
}

const SEV_STYLE: Record<string, string> = {
  blocker: "bg-destructive/10 text-destructive",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-muted text-muted-foreground",
};

export function GapsPanel({
  projectId,
  gaps,
}: {
  projectId: string;
  gaps: Gap[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function recheck() {
    setError(null);
    startTransition(async () => {
      const res = await recheckGapsAction(projectId);
      if (!res.ok) setError(res.error ?? "Re-check failed.");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Open flags ({gaps.length})
        </h2>
        <Button size="sm" variant="outline" onClick={recheck} disabled={pending}>
          {pending ? "Re-checking…" : "Re-run checks"}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {gaps.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-emerald-600">
          No open flags — coverage and consistency checks pass.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {gaps.map((g, i) => (
            <li
              key={`${g.sectionKey}-${g.fieldKey}-${i}`}
              className="flex items-start justify-between gap-3 rounded-xl border p-3"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEV_STYLE[g.severity] ?? ""}`}
                  >
                    {g.severity}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {g.flagType}
                    {g.sectionKey ? ` · ${g.sectionKey}` : ""}
                    {g.fieldKey ? ` · ${g.fieldKey}` : ""}
                  </span>
                </div>
                <span className="text-sm">{g.message}</span>
              </div>
              <Button size="sm" variant="ghost" render={<Link href={fixHref(projectId, g)} />}>
                Fix →
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
