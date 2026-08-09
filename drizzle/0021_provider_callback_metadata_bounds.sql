alter table provider_callback_events
  add constraint provider_callback_events_provider_bounds_check
  check (length(provider) between 1 and 64 and provider !~ '[[:cntrl:]]');

alter table provider_callback_events
  add constraint provider_callback_events_provider_event_id_bounds_check
  check (length(provider_event_id) between 1 and 256 and provider_event_id !~ '[[:cntrl:]]');

alter table provider_callback_events
  add constraint provider_callback_events_event_type_control_check
  check (event_type !~ '[[:cntrl:]]');
