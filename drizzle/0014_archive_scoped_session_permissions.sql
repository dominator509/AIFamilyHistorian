alter table auth_sessions
  add column if not exists archive_permissions jsonb;

alter table auth_sessions
  add constraint auth_sessions_archive_permissions_object_check
  check (archive_permissions is null or jsonb_typeof(archive_permissions) = 'object');
