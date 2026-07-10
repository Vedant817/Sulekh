import "server-only";

import { getSql } from "@/lib/db";
import { groqDrafter } from "@/server/generation/groq-drafter";
import { createGenerationJob, generateDraft } from "@/server/generation/orchestrator";

/**
 * Start a full-draft generation. Creates the job row synchronously (so the UI
 * can track it immediately) and runs the section pipeline in the background,
 * updating generation_jobs as it progresses. Returns the job id.
 *
 * (For serverless durability under load, a queue/worker is the production path —
 * documented for task 7.3; the job row is the source of truth either way.)
 */
export async function startGeneration(projectId: string): Promise<string> {
  const sql = getSql();
  const jobId = await createGenerationJob(sql, projectId);
  void generateDraft(sql, projectId, groqDrafter, { jobId }).catch(() => {
    // generateDraft already records the failure on the job row.
  });
  return jobId;
}
