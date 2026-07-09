-- 0005 — canonical DRHP section catalogue.
-- The authoritative, ordered list of DRHP sections (ICDR Part A, SME set) lives
-- in the DB as seeded data — generation and the checklist derive the section
-- list from here rather than hardcoding it. requirement_checklist and per-project
-- drhp_sections reference these keys.

create table if not exists public.drhp_section_catalog (
  section_key text primary key,
  title       text not null,
  ordinal     integer not null unique,
  mandatory   boolean not null default true,
  description text,
  created_at  timestamptz not null default now()
);

alter table public.drhp_section_catalog enable row level security;

drop policy if exists drhp_section_catalog_select on public.drhp_section_catalog;
create policy drhp_section_catalog_select on public.drhp_section_catalog
  for select using (auth.uid() is not null);

grant select on public.drhp_section_catalog to anon, authenticated;
grant all on public.drhp_section_catalog to service_role;

-- Referential integrity: checklist items and per-project sections must map to a
-- known catalogue section.
alter table public.requirement_checklist
  drop constraint if exists fk_requirement_section;
alter table public.requirement_checklist
  add constraint fk_requirement_section
  foreign key (section_key) references public.drhp_section_catalog (section_key)
  on update cascade on delete restrict;

alter table public.drhp_sections
  drop constraint if exists fk_drhp_section_catalog;
alter table public.drhp_sections
  add constraint fk_drhp_section_catalog
  foreign key (section_key) references public.drhp_section_catalog (section_key)
  on update cascade on delete restrict;
