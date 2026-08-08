create table auth_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  organization_id uuid not null references organizations(id),
  archive_ids uuid[] not null,
  permissions text[] not null,
  device_label text,
  user_agent_hash text,
  ip_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  check (cardinality(archive_ids) > 0),
  check (cardinality(permissions) > 0),
  check (expires_at > created_at),
  check (user_agent_hash is null or user_agent_hash ~ '^[0-9a-f]{64}$'),
  check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$')
);

create index auth_sessions_user_idx on auth_sessions(user_id, created_at desc);
create index auth_sessions_active_idx on auth_sessions(user_id, expires_at)
  where revoked_at is null;

grant select, insert, update, delete on auth_sessions to family_historian_runtime;

