"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import {
  addComment,
  assignIntermediary,
  editSection,
  findIntermediariesByEmail,
  setSectionStatus,
  type SectionStatus,
} from "@/server/review/service";

type Result = { ok: boolean; error: string | null };

export async function assignIntermediaryAction(
  projectId: string,
  email: string,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const matches = await findIntermediariesByEmail(email);
  if (matches.length === 0) {
    return { ok: false, error: "No intermediary found with that email (they must sign up as an intermediary first)." };
  }
  try {
    await assignIntermediary(projectId, matches[0].id);
    revalidatePath(`/workspace/${projectId}`);
    revalidatePath(`/workspace/${projectId}/review`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Assignment failed." };
  }
}

export async function addCommentAction(
  projectId: string,
  sectionKey: string,
  text: string,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (text.trim().length === 0) return { ok: false, error: "Comment cannot be empty." };
  try {
    await addComment(projectId, user.id, sectionKey, text.trim());
    revalidatePath(`/workspace/${projectId}/review`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not add comment." };
  }
}

export async function editSectionAction(
  projectId: string,
  sectionId: string,
  sectionKey: string,
  markdown: string,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  try {
    await editSection(projectId, user.id, sectionId, sectionKey, markdown);
    revalidatePath(`/workspace/${projectId}/review`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save edit." };
  }
}

export async function setSectionStatusAction(
  projectId: string,
  sectionId: string,
  sectionKey: string,
  status: SectionStatus,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  try {
    await setSectionStatus(projectId, user.id, sectionId, sectionKey, status);
    revalidatePath(`/workspace/${projectId}/review`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update status." };
  }
}
