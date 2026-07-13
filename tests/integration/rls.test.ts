import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createIntegrationSql, type Sql } from "./db";

/**
 * RLS isolation + audit-immutability, verified against a real Postgres with the
 * Supabase auth surface (auth.uid() reads request.jwt.claims.sub — identical to
 * production). Skipped unless TEST_DATABASE_URL points at a migrated DB.
 *
 * Run:
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres \
 *     pnpm test:integration
 */
const TEST_DB = process.env.TEST_DATABASE_URL;

const A = "11111111-1111-1111-1111-111111111111"; // promoter A
const B = "22222222-2222-2222-2222-222222222222"; // promoter B
const I = "33333333-3333-3333-3333-333333333333"; // intermediary
const PROJ_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROJ_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe.skipIf(!TEST_DB)("RLS isolation & audit immutability", () => {
  let sql: Sql;

  /** Run a query as an authenticated user with a given uid (RLS applies). */
  async function asUser<T>(uid: string, fn: (tx: Sql) => Promise<T>): Promise<T> {
    return sql.begin(async (tx) => {
      await tx`select set_config('role', 'authenticated', true)`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid })}, true)`;
      return fn(tx as unknown as Sql);
    }) as Promise<T>;
  }

  /** Privileged purge: only way to remove audit rows (via cascade cleanup). */
  async function purgeSeedUsers(): Promise<void> {
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit', 'on', true)`;
      await tx`delete from auth.users where id in (${A}, ${B}, ${I})`;
    });
  }

  beforeAll(async () => {
    sql = createIntegrationSql(TEST_DB!);
    // Clean any prior run (cascade removes profiles/projects/events).
    await purgeSeedUsers();
    // Seed users; the on_auth_user_created trigger creates profiles with roles.
    await sql`insert into auth.users (id, email, raw_user_meta_data) values
      (${A}, 'a@example.com', ${sql.json({ role: "promoter" })}),
      (${B}, 'b@example.com', ${sql.json({ role: "promoter" })}),
      (${I}, 'i@example.com', ${sql.json({ role: "intermediary" })})`;
    // Seed projects as superuser (bypasses RLS).
    await sql`insert into public.ipo_projects (id, owner_id, name, assigned_intermediary_id) values
      (${PROJ_A}, ${A}, 'Project A', null),
      (${PROJ_B}, ${B}, 'Project B', ${I})`;
  });

  afterAll(async () => {
    if (!sql) return;
    await purgeSeedUsers();
    await sql.end({ timeout: 5 });
  });

  it("promoter A sees only their own project", async () => {
    const rows = await asUser(A, (tx) => tx`select id from public.ipo_projects`);
    expect(rows.map((r) => r.id)).toEqual([PROJ_A]);
  });

  it("promoter A cannot read promoter B's project", async () => {
    const rows = await asUser(
      A,
      (tx) => tx`select id from public.ipo_projects where id = ${PROJ_B}`,
    );
    expect(rows).toHaveLength(0);
  });

  it("promoter B sees only their own project", async () => {
    const rows = await asUser(B, (tx) => tx`select id from public.ipo_projects`);
    expect(rows.map((r) => r.id)).toEqual([PROJ_B]);
  });

  it("assigned intermediary sees the assigned project but not others", async () => {
    const rows = await asUser(I, (tx) => tx`select id from public.ipo_projects`);
    expect(rows.map((r) => r.id)).toEqual([PROJ_B]);
  });

  it("a promoter can create a project they own, and it persists scoped to them", async () => {
    const projId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await asUser(
      A,
      (tx) =>
        tx`insert into public.ipo_projects (id, owner_id, name)
           values (${projId}, ${A}, 'A self-serve project')`,
    );
    // Persisted & visible to A...
    const forA = await asUser(
      A,
      (tx) => tx`select id from public.ipo_projects where id = ${projId}`,
    );
    expect(forA).toHaveLength(1);
    // ...and invisible to another promoter.
    const forB = await asUser(
      B,
      (tx) => tx`select id from public.ipo_projects where id = ${projId}`,
    );
    expect(forB).toHaveLength(0);
    // cleanup (owned by A -> removed by afterAll cascade, but be explicit).
    await sql`delete from public.ipo_projects where id = ${projId}`;
  });

  it("a promoter cannot create a project owned by someone else (RLS insert check)", async () => {
    await expect(
      asUser(
        A,
        (tx) =>
          tx`insert into public.ipo_projects (owner_id, name)
             values (${B}, 'spoofed ownership')`,
      ),
    ).rejects.toThrow();
  });

  it("a promoter cannot write to another promoter's project (child table)", async () => {
    await expect(
      asUser(
        A,
        (tx) =>
          tx`insert into public.intake_answers (project_id, question_id, answer_key, value)
             values (${PROJ_B}, 'q1', 'k1', ${sql.json({ v: 1 })})`,
      ),
    ).rejects.toThrow();
  });

  it("review_events is append-only: UPDATE and DELETE are rejected", async () => {
    const [{ id }] = await sql<{ id: string }[]>`
      insert into public.review_events (project_id, actor_id, action, comment)
      values (${PROJ_B}, ${I}, 'comment', 'looks good')
      returning id`;
    await expect(
      sql`update public.review_events set comment = 'tampered' where id = ${id}`,
    ).rejects.toThrow(/append-only/);
    await expect(
      sql`delete from public.review_events where id = ${id}`,
    ).rejects.toThrow(/append-only/);
    // The row still exists (tamper attempts had no effect).
    const [{ comment }] = await sql<{ comment: string }[]>`
      select comment from public.review_events where id = ${id}`;
    expect(comment).toBe("looks good");
    // Only a deliberate privileged purge (app.purge_audit=on) can remove it.
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit', 'on', true)`;
      await tx`delete from public.review_events where id = ${id}`;
    });
    const remaining = await sql`select 1 from public.review_events where id = ${id}`;
    expect(remaining).toHaveLength(0);
  });
});
