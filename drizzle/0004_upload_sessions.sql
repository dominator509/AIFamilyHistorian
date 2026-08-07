create table upload_sessions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid not null references family_archives(id),
  media_asset_id uuid not null references media_assets(id),
  object_key text not null unique,
  provider_upload_id text not null,
  content_type text not null,
  expected_byte_size bigint not null check (expected_byte_size >= 0),
  expected_sha256_hex text not null check (expected_sha256_hex ~ '^[a-f0-9]{64}$'),
  expected_sha256_base64 text not null,
  status text not null check (status in ('initiated', 'completed', 'aborted', 'failed')),
  original_object_id uuid references original_objects(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table upload_sessions enable row level security;
alter table upload_sessions force row level security;
create policy tenant_scope on upload_sessions
  using (organization_id = current_organization_id() and family_archive_id = current_archive_id())
  with check (organization_id = current_organization_id() and family_archive_id = current_archive_id());

