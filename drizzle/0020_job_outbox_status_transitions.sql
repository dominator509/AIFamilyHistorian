create or replace function reject_job_outbox_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if (old.status = 'queued' and new.status in ('running', 'cancelled'))
     or (old.status = 'retryable_failed' and new.status in ('running', 'cancelled'))
     or (old.status = 'running' and new.status in ('completed', 'retryable_failed', 'terminal_failed', 'cancelled')) then
    return new;
  end if;
  raise exception 'job outbox status transition is invalid: % -> %', old.status, new.status;
end;
$$;

create trigger job_outbox_status_transition
  before update on job_outbox
  for each row execute function reject_job_outbox_status_transition();
