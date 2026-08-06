create extension if not exists vector;

create type consent_status as enum ('pending', 'granted', 'withdrawn', 'expired', 'disputed');
create type rights_status as enum ('pending', 'verified', 'restricted', 'disputed', 'expired');
create type transcript_status as enum ('processing', 'draft', 'corrected', 'approved', 'restricted');
create type fact_status as enum ('candidate', 'confirmed', 'disputed', 'rejected', 'superseded');
create type edition_status as enum ('draft', 'rights_review', 'owner_review', 'approved', 'generating', 'ready', 'withdrawn');
create type job_status as enum ('queued', 'running', 'retryable_failed', 'terminal_failed', 'completed', 'cancelled');
create type visibility as enum ('owner_only', 'selected_contributors', 'family_members', 'link_recipients', 'public_approved');

create table organizations (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table family_archives (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  name text not null,
  ai_processing_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create index family_archives_org_idx on family_archives(organization_id);

create table people (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  display_name_encrypted text not null,
  is_living boolean not null,
  visibility visibility not null default 'owner_only',
  created_at timestamptz not null default now()
);
create index people_scope_idx on people(organization_id, family_archive_id);

create view living_subjects with (security_invoker = true) as
select * from people where is_living = true;

create view deceased_subjects with (security_invoker = true) as
select * from people where is_living = false;

create table memberships (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  user_id uuid not null,
  role text not null,
  created_at timestamptz not null default now(),
  unique(family_archive_id, user_id)
);

create table roles (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  code text not null,
  description text not null,
  created_at timestamptz not null default now(),
  unique(family_archive_id, code)
);

create table permission_grants (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  role_id uuid not null references roles(id),
  permission text not null,
  created_at timestamptz not null default now(),
  unique(role_id, permission)
);

create table recording_sessions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  subject_id uuid references people(id),
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null,
  created_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table consent_records (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  subject_id uuid not null references people(id),
  purpose text not null,
  policy_version text not null,
  status consent_status not null,
  decided_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index consent_subject_purpose_idx on consent_records(subject_id, purpose, created_at);

create table contributor_releases (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  contributor_id uuid not null,
  purpose text not null,
  policy_version text not null,
  status consent_status not null,
  evidence_object_key text,
  decided_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table rights_claims (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  subject_type text not null,
  subject_id uuid not null,
  basis text not null,
  status rights_status not null,
  evidence_object_key text,
  created_at timestamptz not null default now()
);

create table media_assets (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  media_type text not null,
  visibility visibility not null default 'owner_only',
  rights_status rights_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index media_scope_idx on media_assets(organization_id, family_archive_id);

create table original_objects (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  media_asset_id uuid not null references media_assets(id),
  object_key text not null unique,
  content_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  quarantine_status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique(family_archive_id, sha256)
);

create table derivative_objects (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  original_object_id uuid not null references original_objects(id),
  object_key text not null unique,
  recipe_version text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create table fixity_records (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  object_kind text not null check (object_kind in ('original', 'derivative')),
  object_id uuid not null,
  algorithm text not null check (algorithm in ('sha256')),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  byte_size bigint not null check (byte_size >= 0),
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table transcripts (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  media_asset_id uuid not null references media_assets(id),
  current_revision_id uuid,
  created_at timestamptz not null default now()
);

create table transcript_revisions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  media_asset_id uuid not null references media_assets(id),
  prior_revision_id uuid references transcript_revisions(id),
  status transcript_status not null,
  encrypted_text text not null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table transcripts add constraint transcripts_current_revision_fk
  foreign key(current_revision_id) references transcript_revisions(id);

create table speakers (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  person_id uuid references people(id),
  label_encrypted text not null,
  created_at timestamptz not null default now()
);

create table transcript_spans (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  transcript_revision_id uuid not null references transcript_revisions(id),
  speaker_id uuid references speakers(id),
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  start_milliseconds bigint check (start_milliseconds >= 0),
  end_milliseconds bigint check (end_milliseconds >= start_milliseconds),
  exact_text_encrypted text not null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table evidence_links (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  source_id uuid not null,
  revision_id uuid not null,
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  created_at timestamptz not null default now()
);

create table confirmed_facts (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  encrypted_text text not null,
  confirmer_id uuid not null,
  status fact_status not null default 'confirmed',
  created_at timestamptz not null default now()
);

create table candidate_facts (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  encrypted_text text not null,
  status fact_status not null default 'candidate',
  extraction_lineage jsonb not null,
  created_at timestamptz not null default now()
);

create table fact_evidence (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  fact_id uuid not null references confirmed_facts(id),
  evidence_link_id uuid not null references evidence_links(id),
  created_at timestamptz not null default now(),
  unique(fact_id, evidence_link_id)
);

create table disputed_claims (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  encrypted_accounts jsonb not null,
  resolution text not null default 'unresolved',
  created_at timestamptz not null default now()
);

create table quotations (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  transcript_revision_id uuid not null references transcript_revisions(id),
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  exact_text_encrypted text not null,
  created_at timestamptz not null default now()
);

create table person_relationships (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  from_person_id uuid not null references people(id),
  to_person_id uuid not null references people(id),
  relationship_type text not null,
  evidence_link_id uuid references evidence_links(id),
  created_at timestamptz not null default now(),
  check (from_person_id <> to_person_id)
);

create table places (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  name_encrypted text not null,
  location_encrypted jsonb,
  visibility visibility not null default 'owner_only',
  created_at timestamptz not null default now()
);

create table life_events (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  person_id uuid references people(id),
  place_id uuid references places(id),
  event_type text not null,
  date_precision text not null,
  occurred_on date,
  description_encrypted text,
  evidence_link_id uuid references evidence_links(id),
  visibility visibility not null default 'owner_only',
  created_at timestamptz not null default now()
);

create table timeline_entries (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  life_event_id uuid not null references life_events(id),
  sort_key text not null,
  created_at timestamptz not null default now(),
  unique(family_archive_id, life_event_id)
);

create table recipes (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  title_encrypted text not null,
  content_encrypted jsonb not null,
  evidence_link_id uuid references evidence_links(id),
  visibility visibility not null default 'owner_only',
  created_at timestamptz not null default now()
);

create table artifacts (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  media_asset_id uuid references media_assets(id),
  title_encrypted text not null,
  description_encrypted text,
  evidence_link_id uuid references evidence_links(id),
  visibility visibility not null default 'owner_only',
  created_at timestamptz not null default now()
);

create table themes (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  name_encrypted text not null,
  description_encrypted text,
  created_at timestamptz not null default now()
);

create table story_prompts (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  prompt_family text not null,
  prompt_version text not null,
  text_encrypted text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(family_archive_id, prompt_family, prompt_version)
);

create table interview_plans (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  subject_id uuid references people(id),
  plan_encrypted jsonb not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table chapters (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  current_revision_id uuid,
  title_encrypted text not null,
  created_at timestamptz not null default now()
);

create table chapter_revisions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  chapter_id uuid not null references chapters(id),
  prior_revision_id uuid references chapter_revisions(id),
  encrypted_content text not null,
  generation_lineage jsonb,
  approver_id uuid,
  created_at timestamptz not null default now()
);
alter table chapters add constraint chapters_current_revision_fk foreign key(current_revision_id) references chapter_revisions(id);

create table editions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  edition_hash text not null,
  status edition_status not null default 'draft',
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  unique(family_archive_id, edition_hash)
);

create table publication_approvals (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  edition_id uuid not null references editions(id),
  edition_hash text not null,
  approver_id uuid not null,
  approved_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table book_exports (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  edition_id uuid not null references editions(id),
  status job_status not null,
  object_key text,
  manifest jsonb not null,
  created_at timestamptz not null default now()
);

create table epub_exports (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  edition_id uuid not null references editions(id),
  status job_status not null,
  object_key text,
  manifest jsonb not null,
  created_at timestamptz not null default now()
);

create table audiobook_exports (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  edition_id uuid not null references editions(id),
  status job_status not null,
  object_key text,
  manifest jsonb not null,
  created_at timestamptz not null default now()
);

create table portal_shares (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  token_hash text not null unique,
  visibility visibility not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table embargoes (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  subject_type text not null,
  subject_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  reason_encrypted text not null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table voice_authorizations (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  subject_id uuid references people(id),
  kind text not null check (kind in ('stock', 'verified_self_voice')),
  verification_reference text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table narration_jobs (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  edition_id uuid not null references editions(id),
  voice_authorization_id uuid not null references voice_authorizations(id),
  status job_status not null,
  idempotency_key text not null,
  output_object_key text,
  created_at timestamptz not null default now(),
  unique(organization_id, idempotency_key)
);

create table privacy_requests (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid references family_archives(id),
  request_type text not null,
  status job_status not null,
  requester_reference text not null,
  due_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table deletion_jobs (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  status job_status not null,
  idempotency_key text not null,
  grace_ends_at timestamptz not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(organization_id, idempotency_key)
);

create table export_jobs (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  status job_status not null,
  idempotency_key text not null,
  manifest_object_key text,
  created_at timestamptz not null default now(),
  unique(organization_id, idempotency_key)
);

create table audit_events (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid references family_archives(id),
  actor_pseudonym text not null,
  action text not null,
  outcome text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null
);

create table provenance_events (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  lineage jsonb not null,
  occurred_at timestamptz not null
);

create table subscriptions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  plan_code text not null,
  status text not null,
  provider_customer_reference text,
  provider_subscription_reference text,
  created_at timestamptz not null default now()
);

create table usage_ledger (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid references family_archives(id),
  category text not null,
  quantity bigint not null check (quantity >= 0),
  unit text not null,
  idempotency_key text not null,
  recorded_at timestamptz not null,
  unique(organization_id, idempotency_key)
);

create table workflow_runs (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid references family_archives(id),
  workflow_type text not null,
  status job_status not null,
  idempotency_key text not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  unique(organization_id, idempotency_key)
);

create function reject_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'append-only table % cannot be mutated', tg_table_name;
end $$;

create trigger audit_events_append_only before update or delete on audit_events for each row execute function reject_mutation();
create trigger provenance_events_append_only before update or delete on provenance_events for each row execute function reject_mutation();

create function protect_original_object() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('app.deletion_authorized', true) = 'true' then
    return old;
  end if;
  raise exception 'original object metadata is immutable outside an authorized deletion workflow';
end $$;
create trigger original_objects_immutable before update or delete on original_objects for each row execute function protect_original_object();

create function current_organization_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.current_organization_id', true), '')::uuid
$$;
create function current_archive_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.current_archive_id', true), '')::uuid
$$;

do $$
declare table_name text;
begin
  alter table organizations enable row level security;
  alter table organizations force row level security;
  create policy tenant_scope on organizations using (id = current_organization_id()) with check (id = current_organization_id());

  alter table family_archives enable row level security;
  alter table family_archives force row level security;
  create policy tenant_scope on family_archives
    using (organization_id = current_organization_id() and id = current_archive_id())
    with check (organization_id = current_organization_id() and id = current_archive_id());

  alter table subscriptions enable row level security;
  alter table subscriptions force row level security;
  create policy tenant_scope on subscriptions
    using (organization_id = current_organization_id())
    with check (organization_id = current_organization_id());

  foreach table_name in array array[
    'people','memberships','roles','permission_grants','recording_sessions','consent_records',
    'contributor_releases','rights_claims','media_assets','original_objects','derivative_objects',
    'fixity_records','transcripts','transcript_revisions','speakers','transcript_spans',
    'evidence_links','candidate_facts','confirmed_facts','fact_evidence','disputed_claims',
    'quotations','person_relationships','places','life_events','timeline_entries','recipes',
    'artifacts','themes','story_prompts','interview_plans','chapters','chapter_revisions','editions',
    'publication_approvals','book_exports','epub_exports','audiobook_exports','portal_shares',
    'embargoes','voice_authorizations','narration_jobs','privacy_requests','deletion_jobs',
    'export_jobs','audit_events','provenance_events','usage_ledger','workflow_runs'
  ] loop
    execute format('alter table %I enable row level security', table_name);
    execute format('alter table %I force row level security', table_name);
    execute format(
      'create policy tenant_scope on %I using (organization_id = current_organization_id() and (family_archive_id is null or family_archive_id = current_archive_id())) with check (organization_id = current_organization_id() and (family_archive_id is null or family_archive_id = current_archive_id()))',
      table_name
    );
  end loop;
end $$;

create role family_historian_runtime nologin;
grant usage on schema public to family_historian_runtime;
grant select, insert, update, delete on all tables in schema public to family_historian_runtime;
alter default privileges in schema public grant select, insert, update, delete on tables to family_historian_runtime;
