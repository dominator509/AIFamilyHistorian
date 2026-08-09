-- Keep append-only audit and provenance metadata bounded and safe for logs,
-- exports, and downstream consumers even when callers bypass package helpers.
alter table audit_events
  add constraint audit_events_action_bounds_check
  check (length(action) between 1 and 256 and action !~ '[[:cntrl:]]');

alter table provenance_events
  add constraint provenance_events_entity_type_bounds_check
  check (length(entity_type) between 1 and 256 and entity_type !~ '[[:cntrl:]]');

alter table provenance_events
  add constraint provenance_events_event_type_bounds_check
  check (length(event_type) between 1 and 256 and event_type !~ '[[:cntrl:]]');
