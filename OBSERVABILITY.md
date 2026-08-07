# Observability

Pino JSON logs include timestamp, level, service, environment, request_id, trace_id, tenant_pseudonym, actor_pseudonym, action, outcome, duration_ms, policy_decision, and error_class. Payloads are forbidden. `@family-historian/observability` redacts source text, prompts, transcripts, response bodies, email identifiers, private keys, and provider tokens before a structured event can be emitted. Metrics include HTTP, queue, DB, object, auth, AI token/cache/cost, DLP, deletion, export, report, and emergency-access signals. Alerts page on tenant isolation, repeated export failure, deletion SLA breach, auth attack, audit-chain failure, and backup failure.

The local collector in `infra/otel-collector.yaml` is the protocol-compatible development sink. Hosted Sentry and OTLP delivery remain provider-gated and must be configured with least-scope credentials before release. Never log a provider request or response body to validate telemetry.
