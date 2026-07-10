import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type GenerationJob = Database["public"]["Tables"]["generation_jobs"]["Row"];
export type DrhpSection = Database["public"]["Tables"]["drhp_sections"]["Row"];

/** The most recent generation job for a project (RLS-scoped). */
export async function getLatestJob(projectId: string): Promise<GenerationJob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load generation job: ${error.message}`);
  return data ?? null;
}

/** Generated sections for a project, in filing order. */
export async function listSections(projectId: string): Promise<DrhpSection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drhp_sections")
    .select("*")
    .eq("project_id", projectId)
    .order("ordinal", { ascending: true });
  if (error) throw new Error(`Failed to load sections: ${error.message}`);
  return data ?? [];
}

export type GapCount = { total: number; blockers: number };

export async function getGapCount(projectId: string): Promise<GapCount> {
  const supabase = await createClient();
  const { count: total } = await supabase
    .from("gap_flags")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("status", "open");
  const { count: blockers } = await supabase
    .from("gap_flags")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("status", "open")
    .eq("severity", "blocker");
  return { total: total ?? 0, blockers: blockers ?? 0 };
}
