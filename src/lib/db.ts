import "server-only";

import postgres, { type Sql } from "postgres";

/**
 * Direct Postgres connection for server-side operational probes (health checks)
 * and any raw SQL the app needs. Application data access still goes through the
 * Supabase client (RLS-enforced); this is a privileged, connection-level handle
 * used sparingly. Reads DATABASE_URL from the environment (Next loads .env.local
 * automatically); throws a clear error if absent.
 */
function needsSsl(url: string): boolean {
  if (/sslmode=disable/i.test(url)) return false;
  if (/@(localhost|127\.0\.0\.1)[:/]/i.test(url)) return false;
  return true;
}

let sql: Sql | undefined;

export function getSql(): Sql {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!sql) {
    sql = postgres(url, {
      ssl: needsSsl(url) ? "require" : false,
      max: 3,
      idle_timeout: 20,
      onnotice: () => {},
    });
  }
  return sql;
}
