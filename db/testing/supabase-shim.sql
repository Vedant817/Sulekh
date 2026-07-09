-- LOCAL TEST ONLY — reproduces the slice of the Supabase platform surface that
-- our migrations depend on, so migrations + RLS can be verified against a plain
-- Postgres+pgvector container. On a real Supabase project ALL of this already
-- exists (auth schema, auth.uid(), the anon/authenticated/service_role roles),
-- so this file is NEVER part of db/migrations and never runs in production.
--
-- auth.uid() here is defined identically to Supabase's: it reads the `sub`
-- claim from the request.jwt.claims GUC, so RLS behaviour is bit-for-bit the
-- same as production.

create extension if not exists vector;

-- Platform roles.
do $$ begin create role anon nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin noinherit bypassrls; exception when duplicate_object then null; end $$;
-- Allow the bootstrap superuser to SET ROLE into these for testing.
grant anon, authenticated, service_role to postgres;

-- Minimal auth schema.
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Identical semantics to Supabase's auth.uid().
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )::uuid;
$$;
