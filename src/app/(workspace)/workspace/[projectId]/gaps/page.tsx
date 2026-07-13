import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { buildCoverageReport } from "@/server/gaps/report";
import { getProject } from "@/server/projects";

import { GapsPanel } from "./gaps-panel";

const STATUS_STYLE: Record<string, string> = {
  covered: "text-emerald-600",
  partial: "text-amber-600",
  missing: "text-destructive",
  not_applicable: "text-muted-foreground",
};

export default async function GapsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, user] = await Promise.all([getProject(projectId), getCurrentUser()]);
  if (!project) notFound();

  const report = await buildCoverageReport(getSql(), projectId);
  const t = report.totals;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href={`/workspace/${projectId}`} className="text-sm text-muted-foreground hover:underline">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Gaps & coverage</h1>
        <p className="text-muted-foreground">
          Coverage against the SME requirement checklist plus cross-section
          consistency checks. Fix a flag at its source, then re-run.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Coverage" value={`${report.coveragePercent}%`} />
        <Stat label="Covered" value={`${t.covered}/${t.total}`} />
        <Stat label="Mandatory missing" value={`${t.mandatoryMissing}`} />
        <Stat label="Open flags" value={`${report.gaps.length}`} />
      </div>

      <GapsPanel
        projectId={projectId}
        gaps={report.gaps}
        canReview={
          user?.profile?.role === "admin" ||
          (user?.profile?.role === "intermediary" && project.assigned_intermediary_id === user.id)
        }
      />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Requirement coverage ({report.requirements.length})
        </h2>
        <Link
          href={`/api/projects/${projectId}/coverage-report`}
          className="text-sm font-medium text-foreground underline"
          prefetch={false}
        >
          Download JSON
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-2">Code</th>
              <th className="p-2">Requirement</th>
              <th className="p-2">Section</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {report.requirements.map((r) => (
              <tr key={r.code} className="border-b last:border-0">
                <td className="p-2 font-mono text-xs">{r.code}</td>
                <td className="p-2">
                  {r.title}
                  {r.mandatory ? <span className="text-destructive"> *</span> : null}
                </td>
                <td className="p-2 text-xs text-muted-foreground">{r.sectionKey}</td>
                <td className={`p-2 font-medium capitalize ${STATUS_STYLE[r.status] ?? ""}`}>
                  {r.status.replace("_", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border p-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  );
}
