-- Preserve original-object identity and fixity while allowing the explicitly
-- modeled media quarantine state machine to advance in a worker transaction.
create or replace function protect_original_object() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('app.deletion_authorized', true) = 'true' then
    return old;
  end if;

  if tg_op = 'UPDATE'
     and new.id = old.id
     and new.organization_id = old.organization_id
     and new.family_archive_id = old.family_archive_id
     and new.media_asset_id = old.media_asset_id
     and new.object_key = old.object_key
     and new.content_type = old.content_type
     and new.byte_size = old.byte_size
     and new.sha256 = old.sha256
     and new.created_at = old.created_at
     and (
       (old.quarantine_status = 'pending' and new.quarantine_status = 'scanning')
       or (old.quarantine_status = 'scanning' and new.quarantine_status in ('clean', 'infected', 'error'))
       or (old.quarantine_status = 'error' and new.quarantine_status = 'scanning')
     ) then
    return new;
  end if;

  raise exception 'original object metadata is immutable outside an authorized deletion workflow';
end $$;
