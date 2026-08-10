-- Bind worker tenant access to a database-owned job scope. The worker login
-- must not activate the broad application runtime role or mutate the queue
-- directly; queue transitions and scope establishment are owner-owned APIs.
revoke family_historian_runtime from family_historian_worker;
revoke all privileges on table job_outbox from family_historian_worker;
drop policy if exists worker_queue_control on job_outbox;

create table worker_scope_context (
  backend_pid integer primary key,
  job_id uuid not null references job_outbox(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  family_archive_id uuid references family_archives(id),
  lock_token uuid not null,
  established_at timestamptz not null default now()
);
revoke all on table worker_scope_context from public, family_historian_worker, family_historian_runtime;

create or replace function worker_scope_organization_id() returns uuid
language sql stable security definer set search_path = pg_catalog, public as $$
  select organization_id
    from public.worker_scope_context
   where backend_pid = pg_backend_pid()
$$;

create or replace function worker_scope_archive_id() returns uuid
language sql stable security definer set search_path = pg_catalog, public as $$
  select family_archive_id
    from public.worker_scope_context
   where backend_pid = pg_backend_pid()
$$;

grant execute on function worker_scope_organization_id() to public;
grant execute on function worker_scope_archive_id() to public;

create or replace function current_organization_id() returns uuid
language sql stable as $$
  select case
    when current_user = 'family_historian_worker' then worker_scope_organization_id()
    else nullif(current_setting('app.current_organization_id', true), '')::uuid
  end
$$;

create or replace function current_archive_id() returns uuid
language sql stable as $$
  select case
    when current_user = 'family_historian_worker' then worker_scope_archive_id()
    else nullif(current_setting('app.current_archive_id', true), '')::uuid
  end
$$;

create or replace function worker_set_scope(p_job_id uuid, p_lock_token uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  job_scope record;
  existing_scope record;
begin
  if session_user <> 'family_historian_worker' then
    raise exception 'worker scope requires the dedicated worker login';
  end if;
  select organization_id, family_archive_id
    into job_scope
    from public.job_outbox
   where id = p_job_id
     and status = 'running'
     and lock_token = p_lock_token;
  if not found then
    raise exception 'worker job lease is invalid';
  end if;
  select job_id, lock_token
    into existing_scope
    from public.worker_scope_context
   where backend_pid = pg_backend_pid();
  if found and (existing_scope.job_id <> p_job_id or existing_scope.lock_token <> p_lock_token) then
    if exists (
      select 1
        from public.job_outbox
       where id = existing_scope.job_id
         and status = 'running'
         and lock_token = existing_scope.lock_token
    ) then
      raise exception 'worker scope is already bound to another job';
    end if;
    delete from public.worker_scope_context where backend_pid = pg_backend_pid();
  end if;
  insert into public.worker_scope_context(
    backend_pid, job_id, organization_id, family_archive_id, lock_token
  ) values (
    pg_backend_pid(), p_job_id, job_scope.organization_id, job_scope.family_archive_id, p_lock_token
  ) on conflict (backend_pid) do update
    set established_at = now();
end
$$;

create or replace function worker_clear_scope() returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if session_user <> 'family_historian_worker' then
    raise exception 'worker scope requires the dedicated worker login';
  end if;
  delete from public.worker_scope_context where backend_pid = pg_backend_pid();
end
$$;

create or replace function worker_claim_job(
  p_lease_milliseconds integer,
  p_job_types text[] default null,
  p_archive_ids uuid[] default null,
  p_lock_token uuid default null
) returns setof public.job_outbox
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  candidate public.job_outbox;
begin
  if session_user <> 'family_historian_worker' then
    raise exception 'worker queue requires the dedicated worker login';
  end if;
  if p_lease_milliseconds < 1000 or p_lease_milliseconds > 3600000 then
    raise exception 'worker lease duration is invalid';
  end if;
  if p_lock_token is null then
    raise exception 'worker lock token is required';
  end if;
  select *
    into candidate
    from public.job_outbox
   where available_at <= now()
     and (
       (status in ('queued', 'retryable_failed')
        and (locked_at is null or locked_at < now() - (p_lease_milliseconds * interval '1 millisecond')))
       or
       (status = 'running' and locked_at < now() - (p_lease_milliseconds * interval '1 millisecond'))
     )
     and (coalesce(cardinality(p_job_types), 0) = 0 or job_type = any(p_job_types))
     and (coalesce(cardinality(p_archive_ids), 0) = 0 or family_archive_id = any(p_archive_ids))
   order by created_at, id
   for update skip locked
   limit 1;
  if not found then return; end if;
  update public.job_outbox
     set status = 'running', locked_at = now(), lock_token = p_lock_token,
         attempt_count = attempt_count + 1, last_error_code = null
   where id = candidate.id;
  return query select * from public.job_outbox where id = candidate.id;
end
$$;

create or replace function worker_renew_job(p_job_id uuid, p_lock_token uuid) returns boolean
language sql security definer set search_path = pg_catalog, public as $$
  update public.job_outbox
     set locked_at = now()
   where id = p_job_id and status = 'running' and lock_token = p_lock_token
  returning true
$$;

create or replace function worker_complete_job(p_job_id uuid, p_lock_token uuid) returns boolean
language sql security definer set search_path = pg_catalog, public as $$
  update public.job_outbox
     set status = 'completed', completed_at = now(), locked_at = null,
         lock_token = null, last_error_code = null
   where id = p_job_id and status = 'running' and lock_token = p_lock_token
  returning true
$$;

create or replace function worker_fail_job(
  p_job_id uuid,
  p_lock_token uuid,
  p_status job_status,
  p_delay_seconds integer,
  p_error_code text
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  updated_count integer;
begin
  if p_status not in ('retryable_failed', 'terminal_failed') then
    raise exception 'worker failure status is invalid';
  end if;
  if p_delay_seconds < 0 or p_delay_seconds > 300 then
    raise exception 'worker retry delay is invalid';
  end if;
  update public.job_outbox
     set status = p_status, available_at = now() + (p_delay_seconds * interval '1 second'),
         locked_at = null, lock_token = null, last_error_code = left(p_error_code, 120)
   where id = p_job_id and status = 'running' and lock_token = p_lock_token;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end
$$;

revoke all on function worker_set_scope(uuid, uuid) from public;
revoke all on function worker_clear_scope() from public;
revoke all on function worker_claim_job(integer, text[], uuid[], uuid) from public;
revoke all on function worker_renew_job(uuid, uuid) from public;
revoke all on function worker_complete_job(uuid, uuid) from public;
revoke all on function worker_fail_job(uuid, uuid, job_status, integer, text) from public;
grant execute on function worker_set_scope(uuid, uuid) to family_historian_worker;
grant execute on function worker_clear_scope() to family_historian_worker;
grant execute on function worker_claim_job(integer, text[], uuid[], uuid) to family_historian_worker;
grant execute on function worker_renew_job(uuid, uuid) to family_historian_worker;
grant execute on function worker_complete_job(uuid, uuid) to family_historian_worker;
grant execute on function worker_fail_job(uuid, uuid, job_status, integer, text) to family_historian_worker;

grant select, update on export_jobs to family_historian_worker;
grant select, update on narration_jobs to family_historian_worker;
grant select on job_outbox to family_historian_worker;
grant insert on audit_events to family_historian_worker;
grant select, update on privacy_requests to family_historian_worker;
grant insert on deletion_jobs to family_historian_worker;
grant select, update on original_objects to family_historian_worker;
grant select on media_assets to family_historian_worker;
grant select, insert on fixity_records to family_historian_worker;
grant select, insert on derivative_objects to family_historian_worker;
grant select on voice_authorizations to family_historian_worker;
