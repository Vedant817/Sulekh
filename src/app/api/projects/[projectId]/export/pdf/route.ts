import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { loadExportInput } from "@/server/export/load";
import { buildPdf } from "@/server/export/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const input = await loadExportInput(projectId);
  if (!input) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (input.sections.length === 0) {
    return NextResponse.json({ error: "No draft to export yet — generate first." }, { status: 400 });
  }

  const bytes = await buildPdf(input);
  const suffix = input.watermarked ? "DRAFT" : "final";
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="DRHP-${suffix}-${projectId}.pdf"`,
    },
  });
}
