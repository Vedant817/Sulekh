-- 0001 — extensions, enums, helper functions, auth-linked profiles
-- Idempotent: safe to re-run.

-- pgvector for corpus embeddings (RAG over the regulatory corpus).
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Enumerated domains
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('promoter', 'intermediary', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum (
    'draft', 'intake', 'extraction', 'generation', 'review', 'approved', 'exported'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.parse_status as enum ('pending', 'parsing', 'parsed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.section_status as enum ('empty', 'generating', 'draft', 'needs_changes', 'approved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.coverage_status as enum ('covered', 'partial', 'missing', 'not_applicable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gap_type as enum ('missing', 'inconsistent', 'unaddressed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gap_severity as enum ('info', 'warning', 'blocker');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_state as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (mirror of auth.users with a role)
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.user_role not null default 'promoter',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_user_profiles_updated on public.user_profiles;
create trigger trg_user_profiles_updated
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when a new auth user is created.
-- Role is taken from signup metadata (`role`), defaulting to 'promoter'.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'role', ''),
      'promoter'
    )::public.user_role
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Access-control helper functions (security definer to avoid RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  );
$$;

create or replace function public.current_role_is(target public.user_role)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = target
  );
$$;
