"use server";

import { revalidatePath } from "next/cache";

import { getSql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { runGapEngine } from "@/server/gaps/engine";
import { getProject } from "@/server/projects";

export type RecheckResult = {
  ok: boolean;
  error: string | null;
  summary?: { missingMandatory: number; inconsistencies: number };
};

/** Re-run the gap & consistency engine and refresh the view. */
export async function recheckGapsAction(projectId: string): Promise<RecheckResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const project = await getProject(projectId);
  if (!project) return { ok: false, error: "Project not found or not accessible." };
  try {
    const r = await runGapEngine(getSql(), projectId);
    revalidatePath(`/workspace/${projectId}/gaps`);
    return {
      ok: true,
      error: null,
      summary: { missingMandatory: r.missingMandatory, inconsistencies: r.inconsistencies },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Re-check failed." };
  }
}
