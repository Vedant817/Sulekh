import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type Profile = Database["public"]["Tables"]["user_profiles"]["Row"];

export type CurrentUser = {
  id: string;
  email: string;
  profile: Profile | null;
};

/**
 * Resolve the signed-in user and their profile row (role, name). Memoized per
 * request via React cache. Returns null when unauthenticated.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { id: user.id, email: user.email ?? "", profile: profile ?? null };
});
