# Operations

Health endpoints are `/health/live`, `/health/ready`, and `/health/dependencies`. Operators monitor queue depth, DB pool, R2 failures, AI error and cache ratios, consent failures, DLP blocks, report latency, privacy request age, deletion backlog, emergency requests, and auth anomalies. Backups run daily and restore is proven quarterly. Incidents follow `.agent/checklists/incident-response.md`.

For a suspected provider or privacy incident, first disable the affected provider or feature, preserve redacted event metadata, revoke active share links or sessions if exposure is possible, and open the incident record. Use only pseudonymous tenant and actor identifiers in telemetry. A backup is not considered verified until a fresh restore can run migrations, the fixity check, tenant-isolation checks, and an API smoke test against the restored copy.
