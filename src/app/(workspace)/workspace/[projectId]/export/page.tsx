import Link from "next/link";
import { notFound } from "next/navigation";

import { getProject } from "@/server/projects";
import { getApprovalState, getReviewSections } from "@/server/review/service";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [sections, approval] = await Promise.all([
    getReviewSections(projectId),
    getApprovalState(projectId),
  ]);
  const hasDraft = sections.length > 0;
  const clean = approval.fullyApproved;

  const docs = [
    { label: "Draft DRHP — Word (.docx)", href: `/api/projects/${projectId}/export/docx` },
    { label: "Draft DRHP — PDF", href: `/api/projects/${projectId}/export/pdf` },
    { label: "Coverage report — JSON", href: `/api/projects/${projectId}/coverage-report` },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/workspace/${projectId}`} className="text-sm text-muted-foreground hover:underline">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          Download the draft DRHP and its coverage report. The document is
          watermarked until an authorised intermediary approves all mandatory sections.
        </p>
      </div>

      <div
        className={`rounded-xl border p-4 ${clean ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}
      >
        <p className="text-sm font-medium">
          {clean
            ? "All mandatory sections approved — exports are un-watermarked (final)."
            : `Watermarked "DRAFT — FOR AUTHORISED INTERMEDIARY REVIEW" (${approval.mandatoryApproved}/${approval.mandatoryTotal} mandatory sections approved).`}
        </p>
      </div>

      {hasDraft ? (
        <ul className="flex flex-col gap-2">
          {docs.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                prefetch={false}
                className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted"
              >
                <span className="font-medium">{d.label}</span>
                <span className="text-sm text-muted-foreground">Download →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          No draft to export yet. Generate the draft first.
        </div>
      )}
    </div>
  );
}
