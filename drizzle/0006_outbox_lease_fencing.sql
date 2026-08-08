-- Fence stale workers after a lease is reclaimed by another worker.
alter table job_outbox add column lock_token uuid;
