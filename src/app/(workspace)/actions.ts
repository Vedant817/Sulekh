"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createProjectSchema } from "@/schemas/project";

export type CreateProjectState = { error: string | null };

export async function createProjectAction(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    targetBoard: formData.get("targetBoard") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid project details" };
  }

  const supabase = await createClient();
  // owner_id must equal auth.uid() — enforced again by the RLS insert policy.
  const { error } = await supabase.from("ipo_projects").insert({
    name: parsed.data.name,
    target_board: parsed.data.targetBoard,
    owner_id: user.id,
    status: "draft",
  });
  if (error) {
    return { error: `Could not create project: ${error.message}` };
  }

  revalidatePath("/workspace");
  return { error: null };
}
