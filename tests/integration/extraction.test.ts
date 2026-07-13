import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createIntegrationSql, type Sql } from "./db";

/**
 * Verifies the human-in-the-loop rule (task 2.6) against the real DB: only
 * promoter-confirmed entities are usable downstream, and a correction overrides
 * the extracted value. Mirrors the query in getConfirmedEntities(). RLS applies
 * as the project owner. Requires TEST_DATABASE_URL.
 */
const TEST_DB = process.env.TEST_DATABASE_URL;

const OWNER = "f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1";
const PROJECT = "f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2";

describe.skipIf(!TEST_DB)("Extraction confirmation (human-in-the-loop)", () => {
  let sql: Sql;
  let entityId: string;

  async function asOwner<T>(fn: (tx: Sql) => Promise<T>): Promise<T> {
    return sql.begin(async (tx) => {
      await tx`select set_config('role','authenticated',true)`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: OWNER })}, true)`;
      return fn(tx as unknown as Sql);
    }) as Promise<T>;
  }

  // Mirrors server/extraction/entities.ts getConfirmedEntities.
  async function confirmedValues(): Promise<unknown[]> {
    return asOwner(async (tx) => {
      const rows = await tx<{ data: unknown; corrected_data: unknown }[]>`
        select data, corrected_data from public.extracted_entities
        where project_id = ${PROJECT} and confirmed_by_promoter = true`;
      return rows.map((r) => r.corrected_data ?? r.data);
    });
  }

  beforeAll(async () => {
    sql = createIntegrationSql(TEST_DB!);
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      await tx`delete from auth.users where id = ${OWNER}`;
    });
    await sql`insert into auth.users (id, email, raw_user_meta_data)
              values (${OWNER}, 'ex@example.com', ${sql.json({ role: "promoter" })})`;
    await sql`insert into public.ipo_projects (id, owner_id, name)
              values (${PROJECT}, ${OWNER}, 'Extraction Test')`;
    const [row] = await sql<{ id: string }[]>`
      insert into public.extracted_entities (project_id, entity_type, data, source_snippet)
      values (${PROJECT}, 'cap_table_row',
              ${sql.json({ holder_name: "Promoter A", shares: 5000000, percentage: 62.5 })},
              'Promoter A holds 50,00,000 equity shares (62.5%)')
      returning id`;
    entityId = row.id;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.begin(async (tx) => {
      await tx`select set_config('app.purge_audit','on',true)`;
      await tx`delete from auth.users where id = ${OWNER}`;
    });
    await sql.end({ timeout: 5 });
  });

  it("unconfirmed entities are NOT usable downstream", async () => {
    expect(await confirmedValues()).toHaveLength(0);
  });

  it("a confirmed entity becomes usable", async () => {
    await asOwner(
      (tx) =>
        tx`update public.extracted_entities
           set confirmed_by_promoter = true, confirmed_by = ${OWNER}, confirmed_at = now()
           where id = ${entityId}`,
    );
    const values = await confirmedValues();
    expect(values).toHaveLength(1);
    expect((values[0] as { holder_name: string }).holder_name).toBe("Promoter A");
  });

  it("a promoter correction overrides the extracted value", async () => {
    await asOwner(
      (tx) =>
        tx`update public.extracted_entities
           set corrected_data = ${tx.json({ holder_name: "Promoter A", shares: 4800000, percentage: 60.0 })}
           where id = ${entityId}`,
    );
    const values = await confirmedValues();
    expect((values[0] as { shares: number }).shares).toBe(4_800_000);
    expect((values[0] as { percentage: number }).percentage).toBe(60.0);
  });
});
