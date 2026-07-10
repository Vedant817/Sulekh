import { createClient } from "@/lib/supabase/server";
import type { Answers } from "@/server/intake/questionnaire";

/**
 * Persistence for intake answers. Answers are versioned (append a new version
 * per change); the current value is the highest version per key. All access is
 * via the RLS-enforced Supabase client, so a user can only read/write intake
 * for a project they own.
 */

export async function loadAnswers(projectId: string): Promise<Answers> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_answers")
    .select("answer_key, value, version")
    .eq("project_id", projectId)
    .order("version", { ascending: false });
  if (error) throw new Error(`Failed to load intake answers: ${error.message}`);

  const latest: Answers = {};
  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (!seen.has(row.answer_key)) {
      seen.add(row.answer_key);
      latest[row.answer_key] = row.value as unknown;
    }
  }
  return latest;
}

export async function saveAnswer(
  projectId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase
    .from("intake_answers")
    .select("version")
    .eq("project_id", projectId)
    .eq("answer_key", key)
    .order("version", { ascending: false })
    .limit(1);
  if (readErr) throw new Error(`Failed to read intake answer: ${readErr.message}`);

  const nextVersion = (existing?.[0]?.version ?? 0) + 1;
  const { error } = await supabase.from("intake_answers").insert({
    project_id: projectId,
    question_id: key,
    answer_key: key,
    value: value as never,
    version: nextVersion,
  });
  if (error) throw new Error(`Failed to save intake answer: ${error.message}`);
}
