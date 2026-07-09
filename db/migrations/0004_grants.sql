-- 0004 — table/sequence grants for the Supabase auth roles.
-- RLS remains the gate; these grants only give the roles the table-level access
-- that RLS then restricts (this mirrors Supabase's default role model). On a
-- real Supabase project these grants are largely pre-applied; re-running them is
-- idempotent and harmless.

grant usage on schema public to anon, authenticated, service_role;

-- authenticated users: full DML, but every statement is still filtered by RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- anonymous: read-only (RLS still applies and yields nothing for null auth.uid()).
grant select on all tables in schema public to anon;

-- service role bypasses RLS (BYPASSRLS) and needs full access for server-side services.
grant all on all tables in schema public to service_role;

-- sequences (for any serial/identity columns and function execution).
grant usage, select on all sequences in schema public to authenticated, service_role;
