-- 0002 — core project + domain tables (IMPLEMENTATION_PLAN §4.1)
-- Idempotent: create table if not exists.

-- IPO projects — one per issuer engagement.
create table if not exists public.ipo_projects (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null references public.user_profiles (id) on delete cascade,
  assigned_intermediary_id uuid references public.user_profiles (id) on delete set null,
  name                     text not null,
  status                   public.project_status not null default 'draft',
  target_board             text not null default 'BSE_SME',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_ipo_projects_owner on public.ipo_projects (owner_id);
create index if not exists idx_ipo_projects_intermediary on public.ipo_projects (assigned_intermediary_id);

drop trigger if exists trg_ipo_projects_updated on public.ipo_projects;
create trigger trg_ipo_projects_updated
  before update on public.ipo_projects
  for each row execute function public.set_updated_at();

-- Project-access helper: owner, assigned intermediary, or admin.
create or replace function public.can_access_project(p_project uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.ipo_projects p
    where p.id = p_project
      and (
        p.owner_id = auth.uid()
        or p.assigned_intermediary_id = auth.uid()
        or public.is_admin()
      )
  );
$$;

-- Only the promoter-owner (or admin) may mutate issuer data / intake / uploads.
create or replace function public.is_project_owner(p_project uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.ipo_projects p
    where p.id = p_project
      and (p.owner_id = auth.uid() or public.is_admin())
  );
$$;

-- Issuer identity (one per project).
create table if not exists public.issuer_profile (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null unique references public.ipo_projects (id) on delete cascade,
  legal_name         text,
  cin                text,
  incorporation_date date,
  registered_office  jsonb not null default '{}'::jsonb,
  sector             text,
  group_structure    jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
drop trigger if exists trg_issuer_profile_updated on public.issuer_profile;
create trigger trg_issuer_profile_updated
  before update on public.issuer_profile
  for each row execute function public.set_updated_at();

-- Intake answers — versioned key/value, linked to the question that produced them.
create table if not exists public.intake_answers (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.ipo_projects (id) on delete cascade,
  question_id  text not null,
  answer_key   text not null,
  value        jsonb,
  version      integer not null default 1,
  created_at   timestamptz not null default now()
);
create index if not exists idx_intake_answers_project on public.intake_answers (project_id);
create unique index if not exists uq_intake_answers_current
  on public.intake_answers (project_id, answer_key, version);

-- Uploaded source documents.
create table if not exists public.uploaded_documents (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.ipo_projects (id) on delete cascade,
  uploader_id  uuid references public.user_profiles (id) on delete set null,
  doc_type     text not null,
  file_name    text not null,
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  parse_status public.parse_status not null default 'pending',
  parse_error  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_uploaded_documents_project on public.uploaded_documents (project_id);
drop trigger if exists trg_uploaded_documents_updated on public.uploaded_documents;
create trigger trg_uploaded_documents_updated
  before update on public.uploaded_documents
  for each row execute function public.set_updated_at();

-- Structured entities extracted from documents (human-in-the-loop confirmation).
create table if not exists public.extracted_entities (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.ipo_projects (id) on delete cascade,
  document_id          uuid references public.uploaded_documents (id) on delete set null,
  entity_type          text not null,
  data                 jsonb not null,
  source_snippet       text,
  confirmed_by_promoter boolean not null default false,
  confirmed_by         uuid references public.user_profiles (id) on delete set null,
  confirmed_at         timestamptz,
  corrected_data       jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_extracted_entities_project on public.extracted_entities (project_id);
create index if not exists idx_extracted_entities_type on public.extracted_entities (project_id, entity_type);
drop trigger if exists trg_extracted_entities_updated on public.extracted_entities;
create trigger trg_extracted_entities_updated
  before update on public.extracted_entities
  for each row execute function public.set_updated_at();

-- Normalised financial statements (restated P&L, BS, CF).
create table if not exists public.financial_statements (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.ipo_projects (id) on delete cascade,
  statement_type     text not null,          -- profit_and_loss | balance_sheet | cash_flow
  period_label       text not null,          -- e.g. FY24, H1FY25
  period_end         date,
  currency           text not null default 'INR',
  restated           boolean not null default true,
  line_items         jsonb not null default '[]'::jsonb,
  source_document_id uuid references public.uploaded_documents (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_financial_statements_project on public.financial_statements (project_id);
drop trigger if exists trg_financial_statements_updated on public.financial_statements;
create trigger trg_financial_statements_updated
  before update on public.financial_statements
  for each row execute function public.set_updated_at();

-- Capital structure (pre/post issue, shareholding, allotment history).
create table if not exists public.capital_structure (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.ipo_projects (id) on delete cascade,
  authorized_capital numeric,
  pre_issue_capital  numeric,
  post_issue_capital numeric,
  face_value         numeric,
  shareholding       jsonb not null default '[]'::jsonb,
  allotment_history  jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (project_id)
);
drop trigger if exists trg_capital_structure_updated on public.capital_structure;
create trigger trg_capital_structure_updated
  before update on public.capital_structure
  for each row execute function public.set_updated_at();

-- Offer details.
create table if not exists public.offer_details (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.ipo_projects (id) on delete cascade,
  issue_type          text,                  -- fresh | ofs | mixed
  fresh_issue_amount  numeric,
  ofs_amount          numeric,
  objects             jsonb not null default '[]'::jsonb,
  deployment_schedule jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (project_id)
);
drop trigger if exists trg_offer_details_updated on public.offer_details;
create trigger trg_offer_details_updated
  before update on public.offer_details
  for each row execute function public.set_updated_at();

-- DRHP sections (one row per section per project).
create table if not exists public.drhp_sections (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.ipo_projects (id) on delete cascade,
  section_key      text not null,
  title            text not null,
  ordinal          integer not null,
  status           public.section_status not null default 'empty',
  draft_markdown   text,
  template_version text,
  model_used       text,
  is_mandatory     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, section_key)
);
create index if not exists idx_drhp_sections_project on public.drhp_sections (project_id, ordinal);
drop trigger if exists trg_drhp_sections_updated on public.drhp_sections;
create trigger trg_drhp_sections_updated
  before update on public.drhp_sections
  for each row execute function public.set_updated_at();

-- Section provenance (intake fields + corpus citations that produced a section).
create table if not exists public.section_provenance (
  id                 uuid primary key default gen_random_uuid(),
  section_id         uuid not null references public.drhp_sections (id) on delete cascade,
  project_id         uuid not null references public.ipo_projects (id) on delete cascade,
  intake_field_keys  text[] not null default '{}',
  corpus_chunk_ids   uuid[] not null default '{}',
  entity_ids         uuid[] not null default '{}',
  notes              text,
  generated_at       timestamptz not null default now()
);
create index if not exists idx_section_provenance_section on public.section_provenance (section_id);

-- Requirement checklist — seeded catalogue (shared, not project-scoped).
create table if not exists public.requirement_checklist (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  section_key    text not null,
  title          text not null,
  description    text,
  mandatory      boolean not null default true,
  source_citation text not null,
  applies_to     jsonb not null default '{}'::jsonb,
  ordinal        integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists idx_requirement_checklist_section on public.requirement_checklist (section_key);

-- Requirement coverage per project × requirement.
create table if not exists public.requirement_coverage (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.ipo_projects (id) on delete cascade,
  requirement_id uuid not null references public.requirement_checklist (id) on delete cascade,
  status         public.coverage_status not null default 'missing',
  evidence       jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  unique (project_id, requirement_id)
);
create index if not exists idx_requirement_coverage_project on public.requirement_coverage (project_id);
drop trigger if exists trg_requirement_coverage_updated on public.requirement_coverage;
create trigger trg_requirement_coverage_updated
  before update on public.requirement_coverage
  for each row execute function public.set_updated_at();

-- Gap flags.
create table if not exists public.gap_flags (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.ipo_projects (id) on delete cascade,
  flag_type    public.gap_type not null,
  severity     public.gap_severity not null default 'warning',
  section_key  text,
  field_key    text,
  message      text not null,
  details      jsonb not null default '{}'::jsonb,
  status       text not null default 'open',   -- open | resolved
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists idx_gap_flags_project on public.gap_flags (project_id, status);

-- Review events — immutable audit log (append-only; see 0003 trigger + RLS).
create table if not exists public.review_events (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.ipo_projects (id) on delete cascade,
  actor_id     uuid references public.user_profiles (id) on delete set null,
  action       text not null,
  section_key  text,
  before_ref   jsonb,
  after_ref    jsonb,
  comment      text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_review_events_project on public.review_events (project_id, created_at);

-- Corpus documents + chunks (the regulatory knowledge base).
create table if not exists public.corpus_documents (
  id          uuid primary key default gen_random_uuid(),
  source_key  text not null unique,
  title       text not null,
  source_type text not null,       -- icdr | sme_framework | reference_drhp
  version     text,
  uri         text,
  checksum    text,
  created_at  timestamptz not null default now()
);

create table if not exists public.corpus_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.corpus_documents (id) on delete cascade,
  chunk_index  integer not null,
  content      text not null,
  section_tag  text,
  source_ref   text,
  token_count  integer,
  embedding    vector(768),
  created_at   timestamptz not null default now(),
  unique (document_id, chunk_index)
);
create index if not exists idx_corpus_chunks_document on public.corpus_chunks (document_id);
-- ANN index for cosine similarity search.
create index if not exists idx_corpus_chunks_embedding
  on public.corpus_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Generation jobs.
create table if not exists public.generation_jobs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.ipo_projects (id) on delete cascade,
  state             public.job_state not null default 'queued',
  progress          numeric not null default 0,
  total_sections    integer not null default 0,
  completed_sections integer not null default 0,
  current_section   text,
  model_used        text,
  prompt_tokens     bigint not null default 0,
  completion_tokens bigint not null default 0,
  error             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_generation_jobs_project on public.generation_jobs (project_id, created_at);
drop trigger if exists trg_generation_jobs_updated on public.generation_jobs;
create trigger trg_generation_jobs_updated
  before update on public.generation_jobs
  for each row execute function public.set_updated_at();
