import { NextResponse } from "next/server";

import { getSql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildCoverageReport } from "@/server/gaps/report";
import { getProject } from "@/server/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Machine-readable coverage report download (JSON). Access-checked via RLS. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const report = await buildCoverageReport(getSql(), projectId);
  return new NextResponse(JSON.stringify({ project: project.name, ...report }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="coverage-report-${projectId}.json"`,
    },
  });
}
