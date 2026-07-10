"use server";

import { getCurrentUser } from "@/lib/auth";
import { questionById, validateAnswer } from "@/server/intake/questionnaire";
import { saveAnswer } from "@/server/intake/store";

export type SaveAnswerResult = { ok: boolean; error?: string; value?: unknown };

/**
 * Validate and persist a single intake answer. Validation is server-side and
 * authoritative; RLS ensures only the project owner can write. A rejected value
 * returns a clear field-level error and is not persisted.
 */
export async function saveAnswerAction(
  projectId: string,
  key: string,
  rawValue: unknown,
): Promise<SaveAnswerResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const q = questionById(key);
  if (!q) return { ok: false, error: `Unknown question: ${key}` };

  const result = validateAnswer(q, rawValue);
  if (!result.ok) return { ok: false, error: result.error };

  try {
    await saveAnswer(projectId, key, result.value);
    return { ok: true, value: result.value };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}
