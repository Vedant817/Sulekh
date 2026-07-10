import "server-only";

import { getProject } from "@/server/projects";
import { getApprovalState, getReviewSections } from "@/server/review/service";
import type { ExportInput } from "@/server/export/render";

/**
 * Assemble export content for a project. The draft is watermarked unless every
 * mandatory section is approved (the authorised-intermediary gate). Returns null
 * if the project isn't accessible (RLS).
 */
export async function loadExportInput(projectId: string): Promise<ExportInput | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const [sections, approval] = await Promise.all([
    getReviewSections(projectId),
    getApprovalState(projectId),
  ]);

  return {
    projectName: project.name,
    board: project.target_board,
    sections: sections.map((s) => ({
      title: s.title,
      ordinal: s.ordinal,
      markdown: s.draft_markdown ?? "",
    })),
    watermarked: !approval.fullyApproved,
    generatedAt: new Date().toISOString().slice(0, 10),
  };
}
