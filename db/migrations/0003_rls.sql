-- 0003 — Row Level Security
-- Isolation model:
--   * promoter: full access to projects they own + all child data
--   * intermediary: read + review-write access to projects assigned to them
--   * admin: full access
--   * shared reference data (corpus, checklist): readable by any authenticated user,
--     writable only by the service role (which bypasses RLS)
-- Idempotent: drop policy if exists, then create.

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------
alter table public.user_profiles         enable row level security;
alter table public.ipo_projects          enable row level security;
alter table public.issuer_profile        enable row level security;
alter table public.intake_answers        enable row level security;
alter table public.uploaded_documents    enable row level security;
alter table public.extracted_entities    enable row level security;
alter table public.financial_statements  enable row level security;
alter table public.capital_structure     enable row level security;
alter table public.offer_details         enable row level security;
alter table public.drhp_sections         enable row level security;
alter table public.section_provenance    enable row level security;
alter table public.requirement_checklist enable row level security;
alter table public.requirement_coverage  enable row level security;
alter table public.gap_flags             enable row level security;
alter table public.review_events         enable row level security;
alter table public.corpus_documents      enable row level security;
alter table public.corpus_chunks         enable row level security;
alter table public.generation_jobs       enable row level security;

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------
drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select using (
    id = auth.uid() or role = 'intermediary' or public.is_admin()
  );

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own on public.user_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- ipo_projects
-- ---------------------------------------------------------------------------
drop policy if exists ipo_projects_select on public.ipo_projects;
create policy ipo_projects_select on public.ipo_projects
  for select using (
    owner_id = auth.uid()
    or assigned_intermediary_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists ipo_projects_insert on public.ipo_projects;
create policy ipo_projects_insert on public.ipo_projects
  for insert with check (owner_id = auth.uid());

drop policy if exists ipo_projects_update on public.ipo_projects;
create policy ipo_projects_update on public.ipo_projects
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists ipo_projects_delete on public.ipo_projects;
create policy ipo_projects_delete on public.ipo_projects
  for delete using (owner_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Promoter-owned child data: read by any accessor, write by owner/admin only
-- (server-side services use the service role which bypasses RLS).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'issuer_profile','intake_answers','uploaded_documents',
    'financial_statements','capital_structure','offer_details','extracted_entities'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select using (public.can_access_project(project_id));',
      t || '_select', t);

    execute format('drop policy if exists %I on public.%I;', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));',
      t || '_write', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- drhp_sections — read by accessors; inline edits by any accessor
-- (promoter or assigned intermediary); create/delete by owner/admin.
-- ---------------------------------------------------------------------------
drop policy if exists drhp_sections_select on public.drhp_sections;
create policy drhp_sections_select on public.drhp_sections
  for select using (public.can_access_project(project_id));

drop policy if exists drhp_sections_update on public.drhp_sections;
create policy drhp_sections_update on public.drhp_sections
  for update using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

drop policy if exists drhp_sections_insert on public.drhp_sections;
create policy drhp_sections_insert on public.drhp_sections
  for insert with check (public.is_project_owner(project_id));

drop policy if exists drhp_sections_delete on public.drhp_sections;
create policy drhp_sections_delete on public.drhp_sections
  for delete using (public.is_project_owner(project_id));

-- ---------------------------------------------------------------------------
-- Read-only-to-users, service-role-written project data
-- (provenance, coverage, generation jobs).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['section_provenance','requirement_coverage','generation_jobs']
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select using (public.can_access_project(project_id));',
      t || '_select', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- gap_flags — read by accessors; resolve (update) by accessors; insert via service role.
-- ---------------------------------------------------------------------------
drop policy if exists gap_flags_select on public.gap_flags;
create policy gap_flags_select on public.gap_flags
  for select using (public.can_access_project(project_id));

drop policy if exists gap_flags_update on public.gap_flags;
create policy gap_flags_update on public.gap_flags
  for update using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

-- ---------------------------------------------------------------------------
-- review_events — append-only immutable audit log.
-- ---------------------------------------------------------------------------
drop policy if exists review_events_select on public.review_events;
create policy review_events_select on public.review_events
  for select using (public.can_access_project(project_id));

drop policy if exists review_events_insert on public.review_events;
create policy review_events_insert on public.review_events
  for insert with check (
    public.can_access_project(project_id) and actor_id = auth.uid()
  );

-- No update/delete policies => denied for all non-service roles. Additionally,
-- a trigger blocks mutation even for privileged/service roles (true immutability):
--   * UPDATE is never permitted (an audit row must never change).
--   * DELETE is rejected too, EXCEPT during a deliberate, privileged data-lifecycle
--     purge that sets `app.purge_audit = 'on'` for its transaction (e.g. the
--     server-side hard-delete of an entire project, which cascades to its events).
--     Casual or tampering deletes — which never set the flag — are always rejected.
create or replace function public.prevent_review_event_mutation()
returns trigger language plpgsql as $$
begin
  -- A deliberate, privileged data-lifecycle purge (app.purge_audit = 'on')
  -- permits mutation — this also covers FK side-effects of deleting an actor
  -- account (actor_id ON DELETE SET NULL fires an UPDATE). Without the flag,
  -- both UPDATE and DELETE are always rejected (tamper-proof append-only log).
  if current_setting('app.purge_audit', true) = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'review_events is append-only; % is not permitted', tg_op;
end $$;

drop trigger if exists trg_review_events_immutable on public.review_events;
create trigger trg_review_events_immutable
  before update or delete on public.review_events
  for each row execute function public.prevent_review_event_mutation();

-- ---------------------------------------------------------------------------
-- Shared reference data — readable by any authenticated user.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['requirement_checklist','corpus_documents','corpus_chunks']
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() is not null);',
      t || '_select', t);
  end loop;
end $$;
