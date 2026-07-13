import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createIntegrationSql, type Sql } from "./db";

/**
 * Reviewer workflow, verified against the real DB under RLS as both roles:
 * assignment scoping (5.1), intermediary comment/edit/status visible to the
 * promoter (5.2), immutable audit trail (5.3), and the all-mandatory-approved
 * export gate (5.4). Requires a migrated + seeded DB (seed:checklist).
 */
const TEST_DB = process.env.TEST_DATABASE_URL;

const PROMOTER = "1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a";
const INTERMEDIARY = "2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b";
const ASSIGNED = "3c3c3c3c-3c3c-3c3c-3c3c-3c3c3c3c3c3c";
const UNASSIGNED = "4d4d4d4d-4d4d-4d4d-4d4d-4d4d4d4d4d4d";

describe.skipIf(!TEST_DB)("Reviewer workflow", () => {
  let sql: Sql;

  function as<T>(uid: string, fn: (tx: Sql) => Promise<T>): Promise<T> {
    return sql.begin(async (tx) => {
      await tx`select set_config('role','authenticated',true)`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid })}, true)`;
      return fn(tx as unknown as Sql);
    }) as Promise<T>;
  }

  async function approvalState(projectId: string) {
    const [row] = await sql<{ total: number; approved: number }[]>`
      with mand as (select section_key from public.drhp_section_catalog where mandatory)
      select (select count(*)::int from mand) as total,
             (select count(*)::int from mand m
                join public.drhp_sections s
                  on s.section_key = m.section_key and s.project_id = ${projectId}
                where s.status = 'approved') as approved`;
    return { ...row, fullyApproved: row.total > 0 && row.total === row.approved };
  }

  beforeAll(async () => {
    sql = createIntegrationSql(TEST_DB!);
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      await tx`delete from auth.users where id in (${PROMOTER}, ${INTERMEDIARY})`;
    });
    await sql`insert into auth.users (id, email, raw_user_meta_data) values
      (${PROMOTER}, 'promoter@example.com', ${sql.json({ role: "promoter" })}),
      (${INTERMEDIARY}, 'im@example.com', ${sql.json({ role: "intermediary" })})`;
    await sql`insert into public.ipo_projects (id, owner_id, name, assigned_intermediary_id) values
      (${ASSIGNED}, ${PROMOTER}, 'Assigned Project', ${INTERMEDIARY}),
      (${UNASSIGNED}, ${PROMOTER}, 'Unassigned Project', null)`;
    // Seed a draft for every mandatory catalogue section on the assigned project.
    const cat = await sql<{ section_key: string; title: string; ordinal: number }[]>`
      select section_key, title, ordinal from public.drhp_section_catalog where mandatory`;
    for (const c of cat) {
      await sql`insert into public.drhp_sections (project_id, section_key, title, ordinal, status, draft_markdown, is_mandatory)
        values (${ASSIGNED}, ${c.section_key}, ${c.title}, ${c.ordinal}, 'draft', ${"draft body"}, true)`;
    }
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      await tx`delete from auth.users where id in (${PROMOTER}, ${INTERMEDIARY})`;
    });
    await sql.end({ timeout: 5 });
  });

  it("intermediary sees only assigned projects (5.1)", async () => {
    const rows = await as(INTERMEDIARY, (tx) => tx`select id from public.ipo_projects`);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(ASSIGNED);
    expect(ids).not.toContain(UNASSIGNED);
  });

  it("intermediary comments + sets status; promoter sees both (5.2)", async () => {
    const [sec] = await sql<{ id: string; section_key: string }[]>`
      select id, section_key from public.drhp_sections
      where project_id = ${ASSIGNED} and section_key = 'risk-factors'`;

    await as(INTERMEDIARY, async (tx) => {
      await tx`insert into public.review_events (project_id, actor_id, action, section_key, comment)
        values (${ASSIGNED}, ${INTERMEDIARY}, 'comment', ${sec.section_key}, 'Please quantify the top risk.')`;
      await tx`update public.drhp_sections set status = 'needs_changes' where id = ${sec.id}`;
    });

    // Promoter sees the comment and the status change.
    const seen = await as(PROMOTER, async (tx) => {
      const comments = await tx<{ comment: string }[]>`
        select comment from public.review_events where project_id = ${ASSIGNED} and action = 'comment'`;
      const [section] = await tx<{ status: string }[]>`
        select status from public.drhp_sections where id = ${sec.id}`;
      return { comments, status: section.status };
    });
    expect(seen.comments.map((c) => c.comment)).toContain("Please quantify the top risk.");
    expect(seen.status).toBe("needs_changes");
  });

  it("audit trail is append-only — a past event cannot be altered or deleted (5.3)", async () => {
    const [ev] = await sql<{ id: string }[]>`
      select id from public.review_events where project_id = ${ASSIGNED} limit 1`;
    await expect(
      sql`update public.review_events set comment = 'tampered' where id = ${ev.id}`,
    ).rejects.toThrow(/append-only/);
    await expect(
      sql`delete from public.review_events where id = ${ev.id}`,
    ).rejects.toThrow(/append-only/);
  });

  it("export stays gated until all mandatory sections are approved (5.4)", async () => {
    const before = await approvalState(ASSIGNED);
    expect(before.fullyApproved).toBe(false);

    // Intermediary approves every mandatory section (RLS-permitted as assignee).
    await as(INTERMEDIARY, async (tx) => {
      await tx`update public.drhp_sections set status = 'approved'
               where project_id = ${ASSIGNED} and is_mandatory = true`;
    });

    const after = await approvalState(ASSIGNED);
    expect(after.approved).toBe(after.total);
    expect(after.fullyApproved).toBe(true);
  });
});
