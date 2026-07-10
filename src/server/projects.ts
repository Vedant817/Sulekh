import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type Project = Database["public"]["Tables"]["ipo_projects"]["Row"];

/**
 * List IPO projects visible to the current user. RLS scopes the result to
 * projects they own (promoter) or are assigned to (intermediary); no manual
 * owner filter is needed or trusted.
 */
export async function listProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ipo_projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to load projects: ${error.message}`);
  }
  return data ?? [];
}

/** Load a single project the current user can access (RLS-scoped), or null. */
export async function getProject(projectId: string): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ipo_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load project: ${error.message}`);
  return data ?? null;
}
