import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Verifies intake persistence against the real DB: answers are versioned, the
 * latest version wins, and everything is restored after "leaving" (resumability)
 * — all under RLS as the project owner. Mirrors the queries in
 * src/server/intake/store.ts. Requires TEST_DATABASE_URL.
 */
const TEST_DB = process.env.TEST_DATABASE_URL;

const OWNER = "d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1";
const PROJECT = "e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2";

describe.skipIf(!TEST_DB)("Intake persistence & resumability", () => {
  let sql: Sql;

  async function asOwner<T>(fn: (tx: Sql) => Promise<T>): Promise<T> {
    return sql.begin(async (tx) => {
      await tx`select set_config('role','authenticated',true)`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: OWNER })}, true)`;
      return fn(tx as unknown as Sql);
    }) as Promise<T>;
  }

  // Versioned save (mirrors store.saveAnswer).
  async function save(key: string, value: unknown) {
    await asOwner(async (tx) => {
      const [row] = await tx<{ version: number }[]>`
        select version from public.intake_answers
        where project_id = ${PROJECT} and answer_key = ${key}
        order by version desc limit 1`;
      const next = (row?.version ?? 0) + 1;
      await tx`insert into public.intake_answers (project_id, question_id, answer_key, value, version)
               values (${PROJECT}, ${key}, ${key}, ${tx.json(value as never)}, ${next})`;
    });
  }

  // Latest-version load (mirrors store.loadAnswers).
  async function load(): Promise<Record<string, unknown>> {
    return asOwner(async (tx) => {
      const rows = await tx<{ answer_key: string; value: unknown; version: number }[]>`
        select answer_key, value, version from public.intake_answers
        where project_id = ${PROJECT} order by version desc`;
      const latest: Record<string, unknown> = {};
      const seen = new Set<string>();
      for (const r of rows) {
        if (!seen.has(r.answer_key)) {
          seen.add(r.answer_key);
          latest[r.answer_key] = r.value;
        }
      }
      return latest;
    });
  }

  beforeAll(async () => {
    sql = postgres(TEST_DB!, { max: 1, ssl: false, onnotice: () => {} });
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      await tx`delete from auth.users where id = ${OWNER}`;
    });
    await sql`insert into auth.users (id, email, raw_user_meta_data)
              values (${OWNER}, 'owner@example.com', ${sql.json({ role: "promoter" })})`;
    await sql`insert into public.ipo_projects (id, owner_id, name)
              values (${PROJECT}, ${OWNER}, 'Intake Test Project')`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      await tx`delete from auth.users where id = ${OWNER}`;
    });
    await sql.end({ timeout: 5 });
  });

  it("restores all answers after leaving (resumable) and keeps versions", async () => {
    await save("issuer_type", "manufacturing");
    await save("legal_name", "Acme Manufacturing Ltd");
    await save("offer_structure", "fresh_only");

    // Simulate "leaving and returning".
    const restored = await load();
    expect(restored.issuer_type).toBe("manufacturing");
    expect(restored.legal_name).toBe("Acme Manufacturing Ltd");
    expect(restored.offer_structure).toBe("fresh_only");
  });

  it("a corrected answer supersedes the previous version", async () => {
    await save("legal_name", "Acme Manufacturing Private Ltd");
    const restored = await load();
    expect(restored.legal_name).toBe("Acme Manufacturing Private Ltd");
    // history is retained (>=2 versions for the key)
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.intake_answers
      where project_id = ${PROJECT} and answer_key = 'legal_name'`;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
