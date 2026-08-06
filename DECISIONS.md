# Decisions

| ID | Decision | Rationale | Status |
|---|---|---|---|
| ADR-001 | Modular monolith before microservices | Lowest cost and operational burden | Accepted |
| ADR-002 | Structured verified facts are authoritative | Prevents model hallucination from becoming record truth | Accepted |
| ADR-003 | DeepSeek only through an isolated gateway | Centralizes privacy, policy, cache, and replacement | Accepted |
| ADR-004 | DeepSeek AI is optional per family archive | Consent and vendor-risk control | Accepted |
| ADR-005 | Do not collect vault secrets at launch | Reduces catastrophic exposure | Accepted |
| ADR-006 | Manual production deployment | User did not authorize automatic deploy | Accepted |
| ADR-007 | Concierge-assisted launch | Produces revenue and workflow evidence earlier | Accepted |
| ADR-008 | US-only launch until counsel expands scope | Limits legal surface | Accepted |
| ADR-009 | Continue independent engineering while EP-000 external verification remains open | The operator explicitly authorized implementation continuation without fabricating preflight or graph completion; the original node remains unverified and production stays blocked | Accepted |
| ADR-010 | Use real local protocol-compatible services for development proofs | PostgreSQL, Redis, S3-compatible storage, SMTP capture and OpenTelemetry can prove local behavior without claiming hosted-provider verification | Accepted |
| ADR-011 | Add explicit bootstrap diagnostics and local-secret generation commands | COMMANDS.md lacked the disk, version, Compose, and secret-generation commands required by the operator's unattended-build mandate | Accepted |
| ADR-012 | Repair provider probes against declared variables and official protocols | The generated probes contain undeclared variables or malformed requests; credential checks must be real and fail closed | Accepted |

Add a decision before introducing a new canonical name, dependency, provider promise, data category, or exception. Use `.agent/templates/adr-template.md`.
