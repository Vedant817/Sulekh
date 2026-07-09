"use server";

import { redirect } from "next/navigation";

import { credentialsSchema, signupSchema } from "@/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

function safeRedirectTo(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  // Only allow same-site absolute paths; never an open redirect.
  return value.startsWith("/") && !value.startsWith("//") ? value : "/workspace";
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message };
  }

  redirect(safeRedirectTo(formData.get("redirectTo")));
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sign-up details" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Consumed by the handle_new_user trigger to set the profile role.
      data: { full_name: parsed.data.fullName, role: parsed.data.role },
    },
  });
  if (error) {
    return { error: error.message };
  }

  // If email confirmation is required, there is no active session yet.
  if (!data.session) {
    return {
      error:
        "Check your inbox to confirm your email, then sign in. (Disable email " +
        "confirmation in Supabase Auth settings for an immediate demo session.)",
    };
  }

  redirect("/workspace");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
