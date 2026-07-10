import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Review Service. All access goes through the RLS-enforced Supabase client, so
 * an intermediary can only read/act on projects assigned to them and a promoter
 * only on projects they own. Every review action writes an immutable
 * review_events audit record (append-only; enforced by trigger — see 0003).
 */

export type ReviewSection = Database["public"]["Tables"]["drhp_sections"]["Row"];
export type ReviewEvent = Database["public"]["Tables"]["review_events"]["Row"];
export type Profile = Database["public"]["Tables"]["user_profiles"]["Row"];

export async function findIntermediariesByEmail(email: string): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("role", "intermediary")
    .ilike("email", email.trim());
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function assignIntermediary(projectId: string, intermediaryId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ipo_projects")
    .update({ assigned_intermediary_id: intermediaryId })
    .eq("id", projectId);
  if (error) throw new Error(`Could not assign intermediary: ${error.message}`);
}

/** Projects the current user can review (RLS: assigned intermediary or admin). */
export async function listAssignedProjects(): Promise<
  Database["public"]["Tables"]["ipo_projects"]["Row"][]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ipo_projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getReviewSections(projectId: string): Promise<ReviewSection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drhp_sections")
    .select("*")
    .eq("project_id", projectId)
    .order("ordinal", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getComments(projectId: string): Promise<ReviewEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_events")
    .select("*")
    .eq("project_id", projectId)
    .eq("action", "comment")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAuditLog(projectId: string): Promise<ReviewEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_events")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function logEvent(
  projectId: string,
  actorId: string,
  action: string,
  fields: { sectionKey?: string | null; before?: unknown; after?: unknown; comment?: string | null },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("review_events").insert({
    project_id: projectId,
    actor_id: actorId,
    action,
    section_key: fields.sectionKey ?? null,
    before_ref: (fields.before ?? null) as never,
    after_ref: (fields.after ?? null) as never,
    comment: fields.comment ?? null,
  });
  if (error) throw new Error(`Could not record review event: ${error.message}`);
}

export async function addComment(
  projectId: string,
  actorId: string,
  sectionKey: string,
  text: string,
): Promise<void> {
  await logEvent(projectId, actorId, "comment", { sectionKey, comment: text });
}

export async function editSection(
  projectId: string,
  actorId: string,
  sectionId: string,
  sectionKey: string,
  newMarkdown: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("drhp_sections")
    .select("draft_markdown")
    .eq("id", sectionId)
    .maybeSingle();
  const { error } = await supabase
    .from("drhp_sections")
    .update({ draft_markdown: newMarkdown, status: "needs_changes" })
    .eq("id", sectionId);
  if (error) throw new Error(`Could not edit section: ${error.message}`);
  await logEvent(projectId, actorId, "edit", {
    sectionKey,
    before: { length: before?.draft_markdown?.length ?? 0 },
    after: { length: newMarkdown.length },
  });
}

export type SectionStatus = "draft" | "needs_changes" | "approved";

export async function setSectionStatus(
  projectId: string,
  actorId: string,
  sectionId: string,
  sectionKey: string,
  status: SectionStatus,
): Promise<void> {
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("drhp_sections")
    .select("status")
    .eq("id", sectionId)
    .maybeSingle();
  const { error } = await supabase
    .from("drhp_sections")
    .update({ status })
    .eq("id", sectionId);
  if (error) throw new Error(`Could not set status: ${error.message}`);
  await logEvent(projectId, actorId, "status_change", {
    sectionKey,
    before: { status: before?.status ?? null },
    after: { status },
  });
}

export type ApprovalState = {
  mandatoryTotal: number;
  mandatoryApproved: number;
  fullyApproved: boolean;
};

/**
 * Whether every mandatory section is approved — the gate for an un-watermarked
 * export. Requires each mandatory catalogue section to exist and be `approved`.
 */
export async function getApprovalState(projectId: string): Promise<ApprovalState> {
  const supabase = await createClient();
  const { data: catalog, error: cErr } = await supabase
    .from("drhp_section_catalog")
    .select("section_key, mandatory")
    .eq("mandatory", true);
  if (cErr) throw new Error(cErr.message);

  const { data: sections, error: sErr } = await supabase
    .from("drhp_sections")
    .select("section_key, status, is_mandatory")
    .eq("project_id", projectId);
  if (sErr) throw new Error(sErr.message);

  const approved = new Set(
    (sections ?? []).filter((s) => s.status === "approved").map((s) => s.section_key),
  );
  const mandatoryKeys = (catalog ?? []).map((c) => c.section_key);
  const mandatoryApproved = mandatoryKeys.filter((k) => approved.has(k)).length;

  return {
    mandatoryTotal: mandatoryKeys.length,
    mandatoryApproved,
    fullyApproved: mandatoryKeys.length > 0 && mandatoryApproved === mandatoryKeys.length,
  };
}
