create or replace function reject_job_outbox_scope_mutation()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> old.organization_id
     or new.family_archive_id is distinct from old.family_archive_id then
    raise exception 'job outbox tenant scope is immutable';
  end if;
  return new;
end;
$$;

create trigger job_outbox_scope_immutable
  before update on job_outbox
  for each row execute function reject_job_outbox_scope_mutation();
