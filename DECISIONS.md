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

## ADR-021: Prove backups with isolated local restores

- **Decision:** Add repository-owned backup and restore-check scripts that use PostgreSQL custom-format dumps, SHA-256 sidecars, and a disposable local database.
- **Reason:** Operations requires a fresh restore to run schema and smoke checks; documentation alone cannot prove recoverability, and production credentials or destructive production actions are unavailable.
- **Consequence:** Local restore integrity is verifiable without mutating the source database. Hosted backup retention, 25 GB export rehearsal, and production restore remain external gates.

## ADR-022: Execute media plans only through a worker-owned no-shell runner

- **Decision:** The media package executes only prevalidated argv plans, resolves opaque keys inside an absolute scratch directory, bounds output and runtime, and maps unavailable or failed tools to stable errors.
- **Reason:** This prevents shell injection, path escape, unbounded parser output, and silent success while keeping the production tool boundary replaceable.
- **Consequence:** Local executor behavior is unit-tested with a real child process; pinned FFmpeg/OCR/ClamAV/ImageMagick/ExifTool availability and fixture live-fire remain deferred.

## ADR-023: Verify completed multipart bytes by streaming the object

- **Decision:** Multipart initiation stores the expected SHA-256 as metadata but does not require an upload-part checksum header; completion streams the assembled object through SHA-256 and compares the actual digest and byte count before creating the immutable original record.
- **Reason:** Clients can obtain signed part URLs without a second checksum-signing protocol, while metadata alone cannot prove the bytes that the object store assembled.
- **Consequence:** Local MinIO storage and authenticated API E2E now prove the signed upload and fixity path; hosted R2 behavior and large-object transfer costs remain deferred.

## ADR-024: Expose provider multipart parts for resumable recovery

- **Decision:** Upload status lists the provider's completed part numbers, ETags, and byte sizes while a session is initiated, using bounded paginated `ListParts` calls.
- **Reason:** A browser or offline client must be able to resume after interruption without trusting stale local state or re-uploading every part.
- **Consequence:** The local API E2E proves status recovery after a real MinIO PUT; hosted pagination behavior and 25 GB transfer rehearsal remain deferred.

## ADR-025: Reject duplicate multipart parts at the API contract boundary

- **Decision:** Completion payload validation rejects duplicate `PartNumber` values before a storage provider call.
- **Reason:** Duplicate or ambiguous part manifests can produce provider-dependent assembly behavior and must fail closed at the trust boundary.
- **Consequence:** Clients receive a deterministic validation problem and must submit one ETag per part number.

## ADR-026: Encrypt local backups with a streaming AES-GCM envelope

- **Decision:** Local backup output is encrypted as a versioned AES-256-GCM stream with a random nonce and authentication tag; restore decrypts to the disposable database stream and verifies the encrypted sidecar first.
- **Reason:** A plaintext custom-format dump with only a checksum does not satisfy the backup confidentiality requirement and can expose restricted family data in local artifacts.
- **Consequence:** Local encrypted backup/restore is verified without buffering the full dump; production KMS wrapping, key rotation, retention, and hosted restore remain release gates.
### ADR-027: Authenticated Deepgram transcription proof

The Deepgram API-key projects probe verifies authentication only. Because the production gate requires a real speech-to-text proof, `scripts/probes/deepgram_transcription.ts` uses the provider's documented sample audio URL, requests Nova-3 with smart formatting, validates the response shape, and requires non-empty transcript text. The probe does not persist provider audio or transcript content and remains separate from local deterministic tests.
### ADR-028: Stripe test-mode checkout proof

The Stripe balance probe verifies API authentication only. The sandbox checkout probe creates one subscription-mode Checkout Session with the configured test price and a unique idempotency key, validates the returned `cs_` session contract, and never completes payment. Webhook delivery remains separate because it requires a reachable signed endpoint or Stripe CLI forwarding.
### ADR-029: Redis-backed distributed API rate limiting

The production API uses an atomic Redis fixed-window script with SHA-256-hashed client keys; the in-memory limiter remains available only for deterministic tests and direct app construction without production dependencies. Redis startup and request-time failures fail closed as provider-unavailable rather than silently disabling abuse protection.

This reuses the pinned `ioredis` 6.0.0 dependency already approved for workers and is proven against the real local Redis service. Per-user and per-archive quotas remain separate from the edge/IP limiter and continue to be enforced by domain authorization and billing controls.
