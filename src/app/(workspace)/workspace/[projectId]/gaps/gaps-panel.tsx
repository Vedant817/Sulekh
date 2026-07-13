"use client";

import { ArrowRight, CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

import { recheckGapsAction } from "./actions";
import { gapAction } from "./gap-navigation";

type Gap = {
  flagType: string;
  severity: string;
  sectionKey: string | null;
  fieldKey: string | null;
  message: string;
};

const SEV_STYLE: Record<string, string> = {
  blocker: "bg-destructive/10 text-destructive",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-muted text-muted-foreground",
};

export function GapsPanel({
  projectId,
  gaps,
  canReview,
}: {
  projectId: string;
  gaps: Gap[];
  canReview: boolean;
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
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium">Resolve issues from the source, then re-check</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {canReview
              ? "Each action opens and highlights the affected review section so you can edit it or request a promoter correction."
              : "Each action takes you to issuer setup so you can correct evidence-backed data before regenerating the draft."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <Button size="sm" variant="outline" onClick={recheck} disabled={pending}>
            <RefreshCw className={pending ? "animate-spin" : ""} aria-hidden="true" />
            {pending ? "Re-checking…" : "Re-run checks"}
          </Button>
          <span className="text-xs text-muted-foreground">Uses the latest draft and confirmed source data.</span>
        </div>
      </div>
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Open flags ({gaps.length})
      </h2>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {gaps.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-emerald-700">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          No open flags — coverage and consistency checks pass. Continue to intermediary review.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {gaps.map((g) => {
            const action = gapAction(projectId, g, canReview);
            return (
              <li
                key={`${g.flagType}-${g.sectionKey}-${g.fieldKey}-${g.message}`}
                className={`flex flex-col gap-3 rounded-xl border p-4 ${g.severity === "blocker" ? "border-destructive/30 bg-destructive/[0.025]" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <TriangleAlert
                    className={`mt-0.5 size-4 shrink-0 ${g.severity === "blocker" ? "text-destructive" : "text-amber-600"}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
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
                    <p className="mt-1 text-sm font-medium">{g.message}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.guidance}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link
                    href={action.href}
                    aria-label={`${action.label}: ${g.message}`}
                    className={buttonVariants({ variant: g.severity === "blocker" ? "default" : "outline", size: "sm" })}
                  >
                    {action.label} <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
