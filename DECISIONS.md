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
| ADR-013 | Add local-only service configuration variables | Real local PostgreSQL, Redis and S3 services need independently generated credentials, and SMTP capture needs collision-free local ports; these ignored development values are never accepted as production credentials | Accepted |
| ADR-014 | Bind project services to dedicated loopback ports | Existing user-owned development containers already bind common PostgreSQL and SMTP ports; project-specific ports prevent cross-project probes and preserve unrelated services | Accepted |
| ADR-015 | Use pgvector 0.8.1 on PostgreSQL 17 locally | The authoritative architecture requires PostgreSQL 17 with pgvector and the exact image tag was verified before use | Accepted |
| ADR-016 | Invoke pnpm through the pinned Corepack package manager | The host resolves pnpm 9.15.0 while the blueprint requires pnpm 10.13.1; `corepack pnpm` honors the repository `packageManager` field without relying on a mutable global shim | Accepted |
| ADR-017 | Keep immutable blueprint Markdown outside mechanical formatting | L1 is immutable and the extracted pack's Markdown predates the selected formatter; formatting gates cover implementation and configuration without rewriting authority artifacts | Accepted |
| ADR-018 | Require application-generated UUIDv7 identifiers | PostgreSQL 17 does not provide the PostgreSQL 18 UUIDv7 generator; IDs are generated with OS randomness before insert and migrations deliberately define no UUID defaults | Accepted |

Add a decision before introducing a new canonical name, dependency, provider promise, data category, or exception. Use `.agent/templates/adr-template.md`.
## ADR-019: Isolate third-party declaration checking

- **Decision:** The shared TypeScript baseline enables `skipLibCheck` while retaining every strict check for project source.
- **Reason:** Drizzle ORM 0.45.2 publishes declarations for optional Gel, MySQL, SingleStore, and SQLite peers. TypeScript 5.9 evaluates those unrelated declarations and reports missing optional modules and upstream interface incompatibilities even though this project imports only the PostgreSQL entry points.
- **Consequence:** Our source remains strictly checked across every package; defects inside dependency declaration files are excluded from the build gate. Runtime PostgreSQL behavior is proven against the pinned real service.
## ADR-020: Resolve bounded probe timeout deterministically

- **Decision:** Preflight uses /usr/bin/timeout when available and otherwise accepts only a binary identifying itself as GNU coreutils.
- **Reason:** Windows timeout.exe can shadow the POSIX utility in a non-login Git Bash process and rejects the duration/probe arguments, making healthy credentials appear invalid.
- **Consequence:** Every credential probe remains bounded and platform tool-name collisions fail explicitly.
