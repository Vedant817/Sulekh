"use server";

import { getCurrentUser } from "@/lib/auth";
import { startGeneration } from "@/server/generation/run";
import { getGenerationReadiness } from "@/server/generation/readiness";
import { getGapCount, getLatestJob, listSections } from "@/server/generation/status";
import { getProject } from "@/server/projects";

export type StartResult = { ok: boolean; error: string | null; jobId?: string };

export async function startGenerationAction(projectId: string): Promise<StartResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const project = await getProject(projectId);
  if (!project) return { ok: false, error: "Project not found or not accessible." };
  try {
    const readiness = await getGenerationReadiness(projectId);
    if (!readiness.ready) {
      return {
        ok: false,
        error: `Issuer setup is incomplete. ${readiness.issues[0]?.message ?? "Finish issuer setup before drafting."}`,
      };
    }
    const jobId = await startGeneration(projectId);
    return { ok: true, error: null, jobId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not start generation." };
  }
}

export type GenerationStatus = {
  job: {
    state: string;
    progress: number;
    completedSections: number;
    totalSections: number;
    currentSection: string | null;
    modelUsed: string | null;
    error: string | null;
  } | null;
  sections: { sectionKey: string; title: string; status: string; modelUsed: string | null }[];
  gaps: { total: number; blockers: number };
};

export async function generationStatusAction(projectId: string): Promise<GenerationStatus> {
  const [job, sections, gaps] = await Promise.all([
    getLatestJob(projectId),
    listSections(projectId),
    getGapCount(projectId),
  ]);
  return {
    job: job
      ? {
          state: job.state,
          progress: Number(job.progress),
          completedSections: job.completed_sections,
          totalSections: job.total_sections,
          currentSection: job.current_section,
          modelUsed: job.model_used,
          error: job.error,
        }
      : null,
    sections: sections.map((s) => ({
      sectionKey: s.section_key,
      title: s.title,
      status: s.status,
      modelUsed: s.model_used,
    })),
    gaps,
  };
}
