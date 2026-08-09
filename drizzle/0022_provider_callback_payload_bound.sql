alter table provider_callback_events
  add constraint provider_callback_events_payload_size_check
  check (octet_length(payload::text) <= 1048576);
