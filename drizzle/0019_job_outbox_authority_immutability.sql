create or replace function reject_job_outbox_scope_mutation()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> old.organization_id
     or new.family_archive_id is distinct from old.family_archive_id then
    raise exception 'job outbox tenant scope is immutable';
  end if;
  if new.job_type <> old.job_type
     or new.payload <> old.payload
     or new.created_at <> old.created_at then
    raise exception 'job outbox authoritative fields are immutable';
  end if;
  return new;
end;
$$;
