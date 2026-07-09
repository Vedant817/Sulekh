import { config as loadEnv } from "dotenv";
import postgres, { type Sql } from "postgres";

// Load .env.local first (developer/CI secrets), then .env as fallback.
loadEnv({ path: ".env.local" });
loadEnv();

/**
 * Resolve the direct Postgres connection string used by migration and seed
 * scripts. Fails fast with a clear, named message when absent — never silently
 * connects to the wrong place.
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required for db scripts. Set it in .env.local to the " +
        "Supabase Postgres connection string (Project Settings → Database).",
    );
  }
  return url;
}

function needsSsl(url: string): boolean {
  if (/sslmode=disable/i.test(url)) return false;
  if (/@(localhost|127\.0\.0\.1)[:/]/i.test(url)) return false;
  return true;
}

/** Create a short-lived Postgres client suitable for one-shot scripts. */
export function createSqlClient(): Sql {
  const url = getDatabaseUrl();
  return postgres(url, {
    max: 1,
    ssl: needsSsl(url) ? "require" : false,
    onnotice: () => {}, // quiet NOTICEs from idempotent DDL
  });
}
