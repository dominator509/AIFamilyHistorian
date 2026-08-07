create table api_idempotency_keys (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid references family_archives(id),
  idempotency_key text not null,
  method text not null,
  route text not null,
  response_status integer not null check (response_status between 200 and 299),
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique(organization_id, idempotency_key, method, route)
);

create table job_outbox (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid references family_archives(id),
  job_type text not null,
  payload jsonb not null,
  status job_status not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now()
);
create index job_outbox_dispatch_idx on job_outbox(status, available_at, created_at);

create table provider_callback_events (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid references family_archives(id),
  provider text not null,
  provider_event_id text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  signature_verified boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, provider_event_id)
);

alter table api_idempotency_keys enable row level security;
alter table api_idempotency_keys force row level security;
create policy tenant_scope on api_idempotency_keys
  using (organization_id = current_organization_id() and (family_archive_id is null or family_archive_id = current_archive_id()))
  with check (organization_id = current_organization_id() and (family_archive_id is null or family_archive_id = current_archive_id()));

alter table job_outbox enable row level security;
alter table job_outbox force row level security;
create policy tenant_scope on job_outbox
  using (organization_id = current_organization_id() and (family_archive_id is null or family_archive_id = current_archive_id()))
  with check (organization_id = current_organization_id() and (family_archive_id is null or family_archive_id = current_archive_id()));

alter table provider_callback_events enable row level security;
alter table provider_callback_events force row level security;
create policy tenant_scope on provider_callback_events
  using (organization_id = current_organization_id() and (family_archive_id is null or family_archive_id = current_archive_id()))
  with check (organization_id = current_organization_id() and (family_archive_id is null or family_archive_id = current_archive_id()));

create trigger provider_callback_events_append_only
  before update or delete on provider_callback_events
  for each row execute function reject_mutation();

