import postgres, { type Sql } from "postgres";

function isLocalDatabase(databaseUrl: string): boolean {
  const hostname = new URL(databaseUrl).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Integration client that works with both local Postgres and Supabase's
 * transaction pooler. Transaction pooling can move a logical connection to a
 * different backend, so protocol-level prepared statements must be disabled.
 */
export function createIntegrationSql(databaseUrl: string): Sql {
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: isLocalDatabase(databaseUrl) ? false : "require",
    onnotice: () => {},
  });
}

export type { Sql };
