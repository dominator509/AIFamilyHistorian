alter table provider_callback_events
  add column event_type text not null default 'unknown',
  add column payload jsonb not null default '{}'::jsonb;

alter table provider_callback_events
  alter column event_type drop default,
  alter column payload drop default;

alter table provider_callback_events
  add constraint provider_callback_events_event_type_check
  check (length(event_type) between 1 and 200);

alter table provider_callback_events
  add constraint provider_callback_events_payload_object_check
  check (jsonb_typeof(payload) = 'object');
