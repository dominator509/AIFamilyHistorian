-- Keep the media worker off the database owner connection. The login is
-- provisioned with a runtime-supplied password after migrations complete.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'family_historian_worker') then
    create role family_historian_worker
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls
      nologin;
  end if;
end $$;

grant usage on schema public to family_historian_worker;
grant select, update on job_outbox to family_historian_worker;
grant family_historian_runtime to family_historian_worker;

drop policy if exists worker_queue_control on job_outbox;
create policy worker_queue_control on job_outbox
  to family_historian_worker
  using (true)
  with check (true);
