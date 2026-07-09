import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createSqlClient } from "./client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

function listMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function reset(sql: ReturnType<typeof createSqlClient>): Promise<void> {
  console.warn("⚠️  --reset: dropping and recreating the public schema");
  await sql
    .unsafe(
      `drop schema if exists public cascade;
       create schema public;
       grant usage on schema public to anon, authenticated, service_role;
       grant all on schema public to postgres, service_role;`,
    )
    .simple();
}

async function main(): Promise<void> {
  const shouldReset = process.argv.includes("--reset");
  const sql = createSqlClient();

  try {
    if (shouldReset) {
      await reset(sql);
    }

    // Migration ledger.
    await sql
      .unsafe(
        `create table if not exists public.schema_migrations (
           id          text primary key,
           applied_at  timestamptz not null default now()
         );`,
      )
      .simple();

    const applied = new Set(
      (
        await sql<{ id: string }[]>`select id from public.schema_migrations`
      ).map((r) => r.id),
    );

    const files = listMigrations();
    if (files.length === 0) {
      throw new Error(`No migration files found in ${MIGRATIONS_DIR}`);
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`• skip   ${file} (already applied)`);
        continue;
      }
      const contents = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`• apply  ${file} ... `);
      // Simple protocol wraps the multi-statement file in one implicit
      // transaction: any failure rolls the whole file back.
      await sql.unsafe(contents).simple();
      await sql`insert into public.schema_migrations (id) values (${file})`;
      console.log("done");
      ran += 1;
    }

    console.log(
      ran === 0
        ? "✔ Database already up to date."
        : `✔ Applied ${ran} migration(s).`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("✖ Migration failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
