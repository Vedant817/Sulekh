"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const STEPS = [
  { segment: "intake", promoterLabel: "Issuer setup", intermediaryLabel: "Issuer data" },
  { segment: "generate", promoterLabel: "Draft", intermediaryLabel: "Draft" },
  { segment: "gaps", promoterLabel: "Gaps", intermediaryLabel: "Gaps" },
  { segment: "review", promoterLabel: "Review", intermediaryLabel: "Review" },
  { segment: "export", promoterLabel: "Export", intermediaryLabel: "Export" },
] as const;

export function ProjectWorkflowNav({
  projectId,
  projectName,
  role,
}: {
  projectId: string;
  projectName: string;
  role: string;
}) {
  const pathname = usePathname();
  const projectRoot = `/workspace/${projectId}`;
  const isOverview = pathname === projectRoot;

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/workspace" className="min-w-0 text-sm text-muted-foreground hover:text-foreground">
            <span aria-hidden="true">← </span>All projects
          </Link>
          <span className="truncate text-sm font-medium">{projectName}</span>
        </div>
        <nav aria-label="Project workflow" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
          <Link
            href={projectRoot}
            aria-current={isOverview ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isOverview ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Overview
          </Link>
          {STEPS.map((step, index) => {
            const href = `${projectRoot}/${step.segment}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const label = role === "intermediary" ? step.intermediaryLabel : step.promoterLabel;
            return (
              <Link
                key={step.segment}
                href={href}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[0.68rem]",
                    active ? "bg-primary-foreground/15" : "bg-muted",
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
