-- Keep audit actor labels and outcomes bounded and free of control characters
-- even when direct workers or administrative SQL bypass package-level typing.
alter table audit_events
  add constraint audit_events_actor_pseudonym_bounds_check
  check (length(actor_pseudonym) between 1 and 256 and actor_pseudonym !~ '[[:cntrl:]]');

alter table audit_events
  add constraint audit_events_outcome_bounds_check
  check (length(outcome) between 1 and 128 and outcome !~ '[[:cntrl:]]');
