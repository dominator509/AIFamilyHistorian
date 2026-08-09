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

### ADR-030: Privacy requests enter a fail-closed review state

The `privacy.request` worker validates the queued payload against the tenant-scoped authoritative `privacy_requests` row, transitions it to `running`, appends a hashed-requester audit event, and creates a 30-day deletion hold for deletion requests. It deliberately does not mark fulfillment complete or delete/export data; downstream fulfillment and human approval remain explicit work items.

### ADR-031: Export and narration jobs stop at explicit review intake

`export.*` and `narration.generate` handlers validate their payloads against tenant-scoped authoritative rows, transition queued jobs to `running`, and append `review_required` audit events. They do not fabricate manifests, audio, provider effects, or completed status; provider execution and human approval remain separate workers.

### ADR-032: Enforce authorization and publication boundaries at the API contract

Member mutations require an archive or organization owner membership and reject platform or organization role grants. New media and rights claims are pending-only, public sharing is excluded from the generic share mutation, privacy requests require `privacy:write`, rights subjects resolve to tenant-scoped supported entities, and completed uploads preserve the declared MIME type.

These checks are enforced at both the Zod boundary and service transaction so callers cannot bypass review gates by supplying pre-approved status values. Production session revocation, per-user/per-archive quotas, and OS-level media sandboxing remain separate release work.

### ADR-033: Bound worker derivative materialization

The worker rejects any single derived artifact above 256 MiB or any media job whose derived artifacts exceed 512 MiB before buffering and persisting them. This complements the no-shell executor, scratch-path confinement, diagnostic cap, and timeout controls. OS-level CPU, memory, PID, syscall, and network isolation still belongs to the worker runtime deployment gate.

### ADR-034: Layer authenticated rate scopes over the edge limiter

The API now consumes the existing distributed limiter for source IP, authenticated principal, and URL archive scope when a bearer token verifies. Redis hashes all key material before persistence, and invalid tokens remain the route-level authentication error. This reduces rotated-IP abuse without pretending to replace byte, active-upload, queue, or billing quotas.

### ADR-035: Reject low-diversity production secrets

Production runtime validation now rejects placeholder values and secrets with fewer than ten distinct characters or a single repeated character. The minimum length remains 32 characters, while development and test environments retain deterministic fixtures. This prevents obvious low-entropy deployment values from satisfying configuration validation while leaving secret generation and production secret-manager ownership unchanged.

### ADR-036: Add short-lived bearer session revocation

Issued bearer tokens now carry a random session identifier. The production API wires a Redis-backed, hashed deny-list whose entries expire with the token; revoked identifiers fail at the request hook before archive routes execute. Legacy tokens without an identifier remain verifiable for compatibility, while native login, session issuance persistence, device inventory, rotation, and an administrative revocation command remain required before production approval.

### ADR-037: Reserve active upload capacity transactionally

Upload sessions now record the initiating user. Before a provider multipart reservation, the API checks active upload count and expected bytes for both that user and the archive under the tenant transaction. Limits are eight active sessions and 25 GiB per user, with a 50 GiB archive ceiling. Completed originals append immutable `storage_bytes` usage-ledger records; provider calls are never made after a quota rejection.

### ADR-038: Bound archive outbox depth

Every API-enqueued job checks the tenant-scoped outbox before insertion and rejects archives with 1,000 queued, running, or retryable jobs. This is an availability guard independent of plan billing; worker completion frees capacity, while plan-level usage, queue fairness, and hosted backpressure remain release work.

### ADR-039: Make derivative recipes immutable and partitionable

Derivative persistence now has a database-enforced unique key on `(original_object_id, recipe_version)`. Worker writes use conflict-safe insertion and compare SHA-256 fixity before treating an existing or concurrent row as idempotent; a digest mismatch is terminal rather than silently accepted. The dispatcher also supports validated UUID archive partitions for independently scaled pools and tenant-isolated worker tests; the default production worker remains unpartitioned until deployment topology is explicitly configured.

### ADR-040: Keep billing state provider-authoritative

Billing input accepts only the catalog plan codes, and the API may create only a `trialing` subscription. `active`, `past_due`, and `cancelled` transitions require a verified provider event; PostgreSQL enforces the plan/status vocabulary and permits only one current subscription per organization. Local entitlement and domain tests remain available, while signed webhook delivery and reconciliation are still external release work.

### ADR-041: Require an explicit production CORS allowlist

Runtime configuration now parses comma-separated origin-only URLs, rejects wildcards and non-HTTPS production origins, and fails production startup when the allowlist is empty. Fastify receives only that exact allowlist with credentials disabled; local development retains same-origin behavior until an origin is explicitly configured.

### ADR-042: Persist verified Stripe webhooks before reconciliation

The API captures the exact JSON request bytes, verifies the Stripe signature within the documented five-minute tolerance, requires organization and archive UUIDs in the signed event metadata, and inserts an append-only tenant-scoped callback row keyed by `(provider, provider_event_id)`. Duplicate delivery is acknowledged only when the payload hash matches; a same-ID/different-payload replay is rejected. Subscription state is not mutated by ingestion; a separate reconciler must consume the durable event and apply provider-authoritative billing transitions.

This keeps signature verification, replay protection, tenant isolation, and auditability at the network boundary while leaving signed sandbox delivery and downstream reconciliation as explicit external release gates.

### ADR-044: Validate uploaded bytes against declared media type before persistence

Multipart completion now reads at most a bounded 4 KiB prefix from object storage and compares recognized magic bytes with the declared MIME type before hashing and creating an immutable original row. Text payloads are admitted only for explicitly safe UTF-8 text types; unknown or mismatched signatures fail closed as `MEDIA_UNSAFE`. The prefix check is intentionally independent of the streamed SHA-256 fixity check and does not buffer large media objects.

### ADR-045: Make bearer logout an explicit revocation operation

The API now exposes `POST /v1/session/logout`. It verifies the current bearer token, requires a session identifier and the configured Redis-backed revocation store, and revokes only that session until its signed expiry. The route returns no body and fails closed when the revocation dependency is unavailable; administrative device/session inventory and server-side membership revalidation remain separate release gates.

### ADR-046: Declare media-worker OS resource and privilege ceilings

The opt-in local worker profile runs the dedicated worker image read-only, drops all Linux capabilities, enables `no-new-privileges`, confines writable space to a 1 GiB `noexec`/`nosuid` `/tmp`, and applies 2 GiB memory, 2 CPU, and 256 PID ceilings. The Fly worker configuration declares the matching 2 CPU/2 GiB VM and graceful SIGTERM timeout. The worker still needs internal database, Redis, and object-storage network access; production network-policy, syscall-profile, and hosted cgroup evidence remain release gates.

### ADR-047: Make the security baseline behavior-backed

The repository security gate now verifies the API’s redaction/body/helmet/CORS controls, worker sandbox declarations, non-root worker image, valid-versus-mismatched media signatures, and revocable session identifiers. This remains a deterministic local gate rather than a substitute for hosted syscall, network, identity, or secret-manager verification.

### ADR-048: Revalidate archive membership at request time

The production server now checks the authoritative `memberships` table for each token-scoped archive request, including archive listing, before applying rate scopes or running route handlers. A removed membership therefore fails closed immediately instead of remaining usable until a bearer token expires. The token’s signed archive and permission claims remain a bounded fast-path input, not the sole source of authorization truth.

### ADR-049: Align manual image deployment with the release workflow

The deployment runbook now derives the immutable GHCR image from `GITHUB_REPOSITORY` and `RELEASE_TAG`, matching `.github/workflows/release.yml`. This removes the stale `GHCR_OWNER/family-historian` variable mismatch while leaving the manual production deploy and authorization gates unchanged.

### ADR-043: Serialize cost-capacity decisions inside the database transaction

Upload active-count/byte reservations and archive outbox-capacity checks now acquire transaction-scoped PostgreSQL advisory locks keyed by the organization and archive before reading the current usage. The lock is held through the reservation or enqueue insert, so concurrent idempotency keys cannot both observe stale capacity and exceed the eight-upload, byte, or 1,000-job ceilings. The lock is an availability guard only; it does not replace plan-level billing enforcement or worker fairness.

### ADR-050: Add opt-in PostgreSQL session inventory and atomic rotation

The API now exposes explicit server-side session registration, inventory, rotation, self/admin revocation, and revoke-all operations backed by PostgreSQL. Session rows store only signed-claim metadata, hashed user-agent/IP metadata, timestamps, and revocation state; raw bearer tokens and identifying headers are never persisted. Rotation locks and revokes the predecessor before inserting a same-principal replacement in one transaction. Existing signed bearer sessions remain compatible until the identity provider adopts registration, while registered-row revocations are checked at the request hook and fail closed.

Native Better Auth/passkey/Argon2id issuance and the provider-owned migration of all legacy sessions remain separate release gates; this boundary deliberately avoids making unregistered legacy tokens unavailable during rollout.

### ADR-051: Derive restricted-field wrapping keys per archive

Restricted-field envelopes now use a versioned archive scope in the wrapping-key derivation (`HMAC-SHA256(master, family-historian:field-key:v1:<archive>)`) before generating a random per-value data key. Version 1/global envelopes remain readable for migration compatibility, while archive writes emit version 2 scoped envelopes and decryption rejects a mismatched archive scope. This provides local tenant key separation without claiming to replace production KMS wrapping, rotation, or escrow evidence.

### ADR-052: Bind confirmed facts to the authenticated confirmer

The archive API now requires the `confirmerId` supplied for a confirmed fact to equal the authenticated actor creating the mutation. A mismatched confirmer is rejected before evidence or fact persistence, while a matching confirmer continues through the evidence-linked transaction. This preserves the blueprint invariant that confirmation is an attributable user action rather than caller-supplied metadata; delegated or administrative confirmation requires a separate explicitly authorized workflow.

### ADR-053: Bound worker object downloads and serialize workspace builds

Media workers now pass the authoritative original byte size as a hard ceiling to streamed object downloads. The storage layer stops writing as soon as a response exceeds that ceiling and raises a non-retryable limit error, preventing an oversized or corrupted object from consuming unbounded worker scratch space. Local HTTP-compatible S3 endpoints, including Docker service names, use path-style addressing; production HTTPS endpoints retain provider-compatible virtual-host addressing. The root workspace build is serialized to avoid TypeScript project-reference races during clean image builds.

### ADR-054: Keep local probes inside the worker network without draining preflight

When Docker’s internal-only network prevents host port publication, the database, Redis, and S3-compatible local probes now execute through the existing Compose service network. Every `docker compose exec` invocation is explicitly detached from stdin so the preflight table cannot be truncated after the first probe. This preserves the worker’s internal-only network boundary and leaves external-provider probes unchanged.

### ADR-055: Make local infrastructure tests endpoint-injectable

The local infrastructure integration test now accepts `LOCAL_TELEMETRY_HEALTH_URL` while retaining the loopback default. A disposable test runner can therefore use the Compose telemetry service name when attached to the internal network, without changing production configuration.

### ADR-056: Route host-blocked live-fire proofs through the internal runner

The live-fire wrapper detects a healthy local worker image and Compose PostgreSQL service, then runs only the database- and object-storage-dependent proofs in a disposable test container on `family_historian_internal`. All other proofs continue through the normal host runner, and the fallback remains unchanged when the local image or services are unavailable. The production worker service is never reconfigured or attached to an external network by this helper.

### ADR-057: Discover the Compose internal network by label

The live-fire helper now discovers the active `family_historian_internal` network from Docker’s Compose label instead of assuming the project-name prefix. This preserves the same worker-image and service-DNS boundary across fresh clones and alternate `COMPOSE_PROJECT_NAME` values.

### ADR-058: Reclaim expired running outbox leases

The dispatcher now treats a `running` outbox row with an expired `locked_at` lease as claimable, while retaining the existing `queued`/`retryable_failed` eligibility and `available_at` gate. Reclaiming assigns a fresh UUID lock token and increments the attempt count; completion and failure updates remain fenced by that token. This recovers jobs from an unexpectedly terminated worker without allowing an active lease to be stolen, and the bounded max-attempt policy still determines terminal failure after a reclaimed attempt.

### ADR-059: Require evidence in every publication readiness category

Publication readiness now requires at least one rights, consent, and citation check before any PDF, EPUB, JSONL, or CSV artifact is rendered. Blocked checks remain fail-closed. This prevents a syntactically valid but evidence-empty report from being treated as approval; edition identity/hash binding and legal review remain separate gates.

### ADR-060: Bind upload-session operations to the initiating user

Upload routes revalidate live archive membership and the service now requires the authenticated user to match `upload_sessions.initiated_by_user_id` for status, part signing, completion, and abort operations. RLS still provides organization/archive isolation, while uploader ownership closes same-archive session takeover by another member. Legacy rows without an owner fail closed rather than becoming implicitly transferable.

### ADR-061: Fence media side effects to the active outbox lease

Media handlers now lock and verify the current `job_outbox` row/token before quarantine transitions and before/after derivative object publication and authoritative inserts. A stale handler raises `WORKER_LEASE_LOST` and skips the catch-path quarantine error update, preventing an expired attempt from corrupting a newer scan. Existing immutable-key and SHA-256 idempotency controls remain in place; a lease heartbeat/hosted queue topology is still a deployment concern.
