import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type ExtractedEntity =
  Database["public"]["Tables"]["extracted_entities"]["Row"];

/** All extracted entities for a project (RLS-scoped), newest first. */
export async function listExtractedEntities(
  projectId: string,
): Promise<ExtractedEntity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("extracted_entities")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load extracted entities: ${error.message}`);
  return data ?? [];
}

/**
 * Only promoter-confirmed entities may feed generation. The effective value is
 * the promoter's correction when present, otherwise the extracted value.
 */
export async function getConfirmedEntities(
  projectId: string,
): Promise<{ entityType: string; value: unknown; documentId: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("extracted_entities")
    .select("entity_type, data, corrected_data, document_id, confirmed_by_promoter")
    .eq("project_id", projectId)
    .eq("confirmed_by_promoter", true);
  if (error) throw new Error(`Failed to load confirmed entities: ${error.message}`);
  return (data ?? []).map((r) => ({
    entityType: r.entity_type,
    value: r.corrected_data ?? r.data,
    documentId: r.document_id,
  }));
}
