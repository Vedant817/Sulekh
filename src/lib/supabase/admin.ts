import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role Supabase client — bypasses RLS. Use ONLY in trusted server-side
 * services (extraction, generation, gap engine, seeds) for privileged writes.
 * Never import into client components.
 */
export function createAdminClient() {
  const env = getServerEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
