alter table api_idempotency_keys
  add constraint api_idempotency_keys_key_bounds_check
  check (length(idempotency_key) between 16 and 200 and idempotency_key !~ '[[:cntrl:]]');

alter table api_idempotency_keys
  add constraint api_idempotency_keys_method_bounds_check
  check (length(method) between 1 and 16 and method !~ '[[:cntrl:]]');

alter table api_idempotency_keys
  add constraint api_idempotency_keys_route_bounds_check
  check (length(route) between 1 and 512 and route !~ '[[:cntrl:]]');

alter table api_idempotency_keys
  add constraint api_idempotency_keys_expiry_after_creation_check
  check (expires_at > created_at);
