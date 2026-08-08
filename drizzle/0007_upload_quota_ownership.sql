alter table upload_sessions
  add column if not exists initiated_by_user_id uuid;

create index if not exists upload_sessions_active_user_idx
  on upload_sessions(organization_id, family_archive_id, initiated_by_user_id)
  where status = 'initiated';
