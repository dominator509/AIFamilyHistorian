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

### ADR-062: Reject revoked narration authorizations at worker intake

Narration intake now joins the authoritative voice-authorization row inside the tenant transaction and fails non-retryably when `revoked_at` is set. This closes the revocation race between API enqueue and worker review handoff without claiming that downstream synthesis or publication fulfillment is implemented.

### ADR-063: Bind publication readiness to the current edition hash

The publication bundle contract now requires the authoritative current edition hash separately from the readiness report and rejects invalid or mismatched hashes before rendering. This prevents a readiness report for an older or unrelated edition revision from authorizing artifacts, while preserving the separate domain approval and rights gates.

### ADR-064: Use the installed ClamAV client contract

The media pipeline now invokes `clamscan` with only its supported `--no-summary` option. The prior `--fdpass` argument was rejected by the installed `clamscan` binary and would make every media scan fail before inspecting content. Signature-database availability remains a separate fail-closed worker release dependency; the image must not claim a successful malware scan without usable definitions.

### ADR-065: Provision ClamAV signatures through an isolated updater service

The local worker profile now runs the official ClamAV service on the internal worker network plus an egress-capable default network solely for signature updates. The worker mounts the resulting signature volume read-only and remains internal-only; customer objects never traverse the updater's egress network. The service healthcheck must pass before the worker starts.

### ADR-066: Keep media metadata outputs private to scratch

Media pipeline steps now declare whether an output is publishable. `ffprobe` and image metadata-scrub outputs remain scratch-only, while waveform, playback, thumbnail, and OCR outputs are the only derivatives persisted to object storage and authoritative derivative tables. This prevents diagnostic metadata files from appearing as customer derivatives.

### ADR-067: Validate cached AI envelopes before reuse

AI result cache hits now require valid provenance fields, non-negative integer token counters, and a finite cache ratio between zero and one before schema validation and reuse. Malformed or legacy envelopes are deleted and recomputed through the provider, preserving trustworthy provenance and cost telemetry.

### ADR-068: Revalidate archive permissions against current membership state

Archive route authorization now performs an optional authoritative database permission check after validating the signed session claim. Owner roles retain their explicit archive-wide authority; other roles must have a matching current `permission_grants` row (or `archive:*`). The production server wires this checker alongside membership freshness validation, so role demotion or grant removal takes effect without waiting for token expiry while lightweight route tests may continue using dependency stubs.

### ADR-069: Fence stale media quarantine failures

The media scan error path now verifies and locks the active outbox lease before transitioning an object from `scanning` to `error`. If the lease was reclaimed, the stale handler cannot overwrite a newer attempt's quarantine state. This complements the existing lease checks around fixity and derivative publication; no lease-loss condition is treated as a successful scan.

### ADR-070: Scope session inventory to the active organization

Session listing, targeted revoke, and administrative revoke-all now include the authenticated organization in their PostgreSQL predicates. Targeted session revocation requires both the stored row and the low-level `SessionStore.revoke` primitive to match the caller’s organization. This prevents a user with sessions in multiple organizations from browsing or revoking another organization’s session inventory while preserving self-revocation and explicit administrative controls.

### ADR-071: Renew outbox leases during long-running handlers

The worker dispatcher now renews each active outbox lease at one-third of its configured duration, with a 250 ms minimum cadence and serialized renewal calls. Completion, failure, and handler side effects remain lock-token fenced, so a renewal failure cannot fabricate success; it only preserves the lease margin for media and other bounded long-running tools. The real PostgreSQL dispatcher regression proves a second worker cannot reclaim a job held by a sleeping first handler.

### ADR-072: Keep release handoff claims aligned with current evidence

The handoff and production-readiness documents now distinguish historical checkpoint evidence from current status. Current blocker counts, worker heartbeat/session isolation proofs, and the real internal media fixture are updated from observed command output; older checkpoint narratives remain preserved as historical records. This prevents stale “14 blockers” or “media unverified” text from being mistaken for the present release state.

### ADR-073: Fail closed with an explicit retryable authorization-provider error

Request-time membership and permission checks now convert database/checker failures into a redacted `PROVIDER_UNAVAILABLE` 503 with `retryable: true`. A checker returning `false` still produces the appropriate 401/403 denial, while no route proceeds on an unavailable authorization source. This keeps outages fail-closed without misclassifying them as generic internal errors or leaking database details.

### ADR-074: Bound signed session claim fan-out

Signed session principals now cap archive memberships and permissions, cap individual permission lengths, and reject oversized bearer payloads before HMAC verification or JSON parsing. The limits preserve normal multi-archive use while preventing a trusted-but-pathological identity assertion from causing unbounded archive fan-out, claim comparisons, or parser work at the request boundary.

### ADR-075: Make portable export fixity deterministic and self-consistent

Portable JSONL export now canonicalizes nested object keys before serialization, and its manifest validates every JSONL line plus the exact entry count before recording fixity. This prevents equivalent records from producing different hashes due to caller key order and prevents a mismatched manifest count from presenting an incomplete or malformed export as complete.

### ADR-076: Bound evidence-link fan-out at the API contract

Confirmed-fact requests now cap evidence-link identifiers at 1,000 before the tenant-scoped `ANY(uuid[])` lookup and per-link inserts. This keeps evidence integrity checks intact while bounding query and transaction work for a single request; the cap is enforced at the shared Zod trust boundary rather than relying on body size alone.

### ADR-077: Reject invalid resumable-export completion sets

Resumable export completion now rejects duplicate part numbers and any part not present in the generated manifest before computing missing parts. This prevents extra or replayed provider parts from being silently ignored and keeps completion proof bound to the exact planned chunk set.

### ADR-078: Validate resumable-export timestamps at planning time

Resumable export planning now requires an RFC 3339 timestamp before hashing or returning a manifest. Invalid generation metadata therefore fails at the first trust boundary instead of surviving into later publication or restore workflows.

### ADR-079: Fail closed on deletion timestamps and evidence

Deletion workflow transitions now reject non-finite request, grace-period, and transition timestamps, and deletion evidence must identify an allowed target, include a non-empty reference, and carry a parseable verification timestamp. This prevents malformed temporal or proof metadata from advancing a deletion workflow or being recorded as completion evidence.

### ADR-080: Compare-and-set media quarantine publication

Media scans now lock the authoritative original row and require `scanning` state before publishing `clean`. A concurrent infected or terminal state is never overwritten, and unexpected state changes produce an explicit retryable conflict. The lease fence remains checked before the row lock, so stale handlers cannot publish a successful quarantine transition.

### ADR-081: Reject invalid billing quota times

Quota checks now parse and validate both the current time and subscription grace-period end before evaluating past-due access. Invalid temporal metadata fails closed with `VALIDATION_FAILED` instead of treating `NaN` comparisons as an unexpired grace period.

### ADR-082: Bound Stripe webhook clock configuration

Stripe signature verification now rejects non-finite, negative, unsafe, or excessively broad clock and tolerance inputs before evaluating freshness. This prevents malformed test/configuration clocks from turning a signed-but-replayed callback into an accepted webhook.

### ADR-083: Fail closed on invalid AI input budgets

The AI Policy Gateway now validates `maxInputTokens` as a bounded positive safe integer before policy evaluation or provider dispatch. Invalid numeric values such as `NaN` can no longer bypass the budget comparison through JavaScript's false `NaN` comparisons.

### ADR-084: Bound provider response materialization

Provider adapters now enforce response-size ceilings before JSON parsing or audio materialization, using a streaming reader that aborts oversized bodies. JSON control responses are capped at 8 MiB and narration audio at 128 MiB; declared `content-length` values are checked before reading. This prevents a malformed or compromised upstream provider response from causing unbounded memory growth while preserving the existing schema and error mapping.

### ADR-085: Apply response ceilings to the DeepSeek boundary

The DeepSeek adapter has its own package boundary and now applies the same 8 MiB streaming JSON ceiling before schema parsing. Oversized declared or streamed responses fail closed, while bounded valid completions retain the existing structured-output and usage behavior.

### ADR-086: Preflight worker scratch capacity before media download

Media jobs now inspect the worker filesystem capacity after creating their scratch directory and require room for the authoritative original plus the bounded derivative reserve before downloading any bytes. A capacity shortfall fails non-retryably as `MEDIA_SCRATCH_INSUFFICIENT`; a runtime `ENOSPC` is mapped to the same non-retryable code. This avoids repeatedly transferring inputs that cannot fit the configured worker scratch budget while preserving the 25 GiB API contract for deployments that provision adequate scratch.

### ADR-087: Never authorize archive routes without an authoritative checker

Archive membership and permission checkers are now mandatory at archive route execution. If either dependency is absent, the route returns retryable `PROVIDER_UNAVAILABLE` instead of relying on a global bearer-token permission list. Production wiring already supplies database-backed checkers; this change makes test or future runtime misconfiguration fail closed and prevents cross-archive permission scope confusion.

### ADR-088: Bound in-memory object reads

`ObjectStorage.readBytes` now validates a 256 MiB maximum, consumes the provider body as a stream, and raises `ObjectStorageLimitError` before materializing an oversized object. Callers that need larger exports must use a streaming API instead of turning an unbounded object into a single heap allocation.

### ADR-089: Enforce prefix limits independently of provider range behavior

`ObjectStorage.readPrefix` now consumes the response body through the same bounded collector as full in-memory reads. A provider that ignores or widens the requested HTTP range therefore cannot cause an unbounded prefix materialization; the method fails with `ObjectStorageLimitError` once the declared prefix ceiling is exceeded.

### ADR-090: Enforce the multipart protocol cardinality at the provider boundary

`ObjectStorage.listMultipartParts` now rejects missing, out-of-range, malformed, duplicate, or more-than-10,000 provider parts. The S3 part-number ceiling is enforced independently of page count, preventing a nonconforming provider from inflating the status response or causing unbounded part accumulation.

### ADR-091: Run integration tests inside the isolated Compose network

The integration wrapper now detects healthy Compose services and a worker image, then runs all integration tests in a disposable container on `family_historian_internal` with current source trees mounted read-only. It rewrites only local service hostnames, mounts the ClamAV signature volume for the media fixture, and retains the host fallback when the local runner is unavailable. This preserves the network boundary while making the prescribed integration command test real dependencies instead of failing on intentionally unpublished host ports.

### ADR-092: Run E2E tests inside the isolated Compose network

The E2E wrapper uses the same disposable internal runner and read-only source mounts, with PostgreSQL and MinIO service DNS overrides. This keeps API/storage E2E coverage available when host service ports are intentionally unpublished and leaves the host fallback unchanged for environments without the local stack.

### ADR-093: Probe local OTLP through the isolated service network when needed

The OTLP preflight probe first checks the configured endpoint directly, then—only when the local worker image and healthy Compose telemetry container exist—probes the real collector at `telemetry:4318` from the internal network. This removes a host-port-forwarding false negative while preserving fail-closed behavior when the collector or runner is absent; it does not mark hosted telemetry credentials or delivery as verified.

### ADR-094: Validate multipart completion at the storage provider boundary

`ObjectStorage.completeMultipart` now independently rejects empty, malformed, duplicate, out-of-range, and over-cardinality part manifests and sorts a frozen normalized copy before invoking the S3 client. HTTP schemas already validate API requests, but workers and operational tooling can call storage directly; defense-in-depth here prevents a nonconforming caller from sending ambiguous completion data to a provider.

### ADR-095: Fence every worker intake transaction to its outbox lease

Privacy, export, and narration intake handlers now verify and lock their active outbox row before reading or mutating authoritative status, audit, or deletion-hold records. Media scan loading also locks the original row and uses a tenant-scoped compare-and-set transition into `scanning`. A reclaimed or stale worker therefore cannot publish review evidence or overwrite quarantine state after losing its lease; the dispatcher still records completion/failure only with the same lock token.

### ADR-096: Gate production on hosted worker sandbox evidence

The preflight table now requires `WORKER_SANDBOX_EVIDENCE_FILE` and verifies that the referenced attestation exists and is non-empty. Local Compose declarations prove development isolation only; production release must additionally retain current evidence for syscall, network-egress, cgroup/PID, read-only-root, and bounded-scratch enforcement. No placeholder artifact is created, so this gate remains unresolved until an operator supplies genuine staging or production-equivalent evidence.

### ADR-097: Keep production-readiness status synchronized with evidence

`PRODUCTION_READINESS.md` now distinguishes engineering continuation from production approval and records the current 16-blocker preflight result, the locally verified test counts, the newly enforced hosted sandbox attestation, and the remaining fulfillment/native-auth work. Historical checkpoint claims are not reused as current release evidence.

### ADR-098: Pass hosted sandbox evidence through release CI

The release workflow now receives a dedicated `WORKER_SANDBOX_EVIDENCE` secret, writes it only to the ephemeral runner workspace, and injects the resulting path into `.env` for the bounded preflight probe. An unset or empty secret fails the probe; no evidence is committed or logged, and local development remains independent of the CI secret.

### ADR-099: Separate external credential proof from disposable CI services

Release CI first runs preflight against the configured nonproduction provider endpoints, then rewrites only database, Redis, S3-compatible storage, and OTLP endpoints to the generated disposable Compose stack before the full local verification suite. This prevents remote database credentials from being used against local containers while preserving an explicit authenticated-provider probe and real local integration/E2E coverage.

### ADR-100: Tear down CI dependencies on every failure path

The release verification step installs its Compose teardown trap before starting any dependency or worker image build. A failed image build, readiness probe, verification gate, or production-readiness check therefore removes the disposable volumes and containers instead of leaving runner state behind.

### ADR-101: Terminate media parser process groups on timeout

Timed media tools now launch detached on POSIX workers and timeout handling signals the entire process group, escalating from `SIGTERM` to `SIGKILL` after 250 ms. Windows retains the direct-child fallback because negative process-group signaling is unavailable there. This closes the descendant-process escape from the executor's timeout boundary without changing tool arguments or permitting shell interpolation. The media unit suite covers the POSIX process-group identity and all existing timeout/error behavior remains fail-closed.

### ADR-102: Pin CI actions and container bases immutably

All GitHub Actions in the verify and release workflows now reference reviewed 40-character commit SHAs, including the Fly setup action previously tracking mutable `master`. Both Node build stages in the Dockerfile now reference the reviewed multi-architecture OCI index digest for `node:24.4.1-bookworm-slim`. The security harness rejects future mutable action references and undigested Node base lines; workflow YAML parsing, security, typecheck, format, API-image, and worker-image builds passed after the change.

### ADR-103: Make local service health checks network-aware

`local-services-check.sh` now probes Mailpit and the OTEL health extension through the real Compose internal network when host port forwarding is unavailable, using the already-built worker image as the probe runtime. Host curls remain the first path; an internal fallback is accepted only when the Compose network, target services, and worker image are present. This removes a false negative without weakening the internal-only network boundary or fabricating health responses.

### ADR-104: Give the worker a loopback-only health contract

The worker image healthcheck already targeted `/health/live`, but the worker process did not expose an HTTP server, making a healthy worker appear unhealthy. The worker now serves loopback-only `/health/live` and `/health/ready` endpoints, reports readiness only after Redis is reachable, and marks readiness false during shutdown. The listener is bound to `127.0.0.1` so the worker remains non-public; hosted sandbox and network-egress enforcement still require external evidence.

### ADR-105: Preinstall the runtime package manager for read-only images

The immutable runtime image now sets `COREPACK_HOME` to `/usr/local/share/corepack`, preinstalls the pinned `pnpm@10.13.1` during the image build, and makes that cache readable by the non-root runtime user. This prevents Corepack from attempting a network download or a write under `/home/node` when the worker starts with a read-only root filesystem.

### ADR-106: Give the worker an explicit inert CORS origin

The shared production environment schema requires an explicit HTTPS CORS allowlist, even for the worker process that exposes only loopback health endpoints and no browser API. The local worker profile and hosted worker manifest now set the reserved non-routable origin `https://worker.invalid`; API/web deployments retain their real HTTPS allowlists. This satisfies the fail-closed configuration contract without granting cross-origin access to a worker route.

### ADR-107: Keep the local worker rehearsal in development mode

The opt-in Compose worker connects to the real internal MinIO service over Docker DNS and HTTP. Marking that local-only profile as `NODE_ENV=production` made the storage HTTPS guard reject the deliberately internal endpoint before the worker could start. The profile now uses `development`; the hosted Fly manifest remains `production` and retains the HTTPS object-storage requirement.

### ADR-108: Revalidate membership inside generated resource routes

Generated archive resource GET and POST routes now call `assertCurrentArchiveMembership` after the current permission check. The global request hook normally performs the same check, but route-local enforcement prevents a partially configured application (permission checker present, membership checker absent) from serving or mutating archive resources. Missing or unavailable membership authority fails closed with a retryable `PROVIDER_UNAVAILABLE` response.

### ADR-109: Reject ambiguous multi-archive privacy and billing mutations

The API now resolves archive scope explicitly for privacy requests and billing mutations. A principal with exactly one archive retains the compatibility default; a principal with multiple archives must supply `archiveId`, which is then checked against current archive permission and membership authority. This prevents silent mutation of `archiveIds[0]` and aligns the route contract with the blueprint’s authenticated archive-scope invariant.

### ADR-110: Cancel failed provider response bodies

HTTP provider adapters and the DeepSeek adapter now cancel non-success response bodies before retrying or surfacing an upstream error. Failed response payloads are not needed for the public error contract, and leaving their streams open can retain connections or buffers during repeated provider failures. Cancellation is best effort and never masks the original retryable/non-retryable provider error; successful responses continue through the existing bounded JSON/audio readers.

### ADR-111: Emit tagged PDF structure semantics

The deterministic PDF renderer now emits a minimal tagged-document structure: the catalog references a `StructTreeRoot`, the page declares `StructParents`, each rendered line is marked with an MCID, and corresponding `/H1`/`/P` structure elements are indexed through a parent tree. The existing `/Marked true` claim is therefore backed by actual structure semantics rather than metadata alone. EPUB language, heading, navigation, and package metadata remain unchanged; external screen-reader and PDF/UA audits are still release evidence gates.

### ADR-112: Make accessibility semantics a verification gate

`scripts/accessibility-check.sh` now runs a deterministic semantic probe over the PDF and EPUB renderers. It requires tagged-PDF catalog/page/MCID/structure markers and EPUB language, heading, navigation, and package metadata, and is wired into `scripts/verify.sh` and the immutable-action CI verification workflow. This is a local structural gate, not a substitute for formal PDF/UA or screen-reader review.

### ADR-113: Bound streamed object fixity verification

`ObjectStorage.sha256Base64` now accepts and enforces a streamed byte ceiling (defaulting to the 25 GiB media contract). Upload completion passes the authoritative session byte size, so a provider/object race cannot cause the fixity pass to read more bytes than the accepted upload contract even after the initial HEAD check. The hash remains streamed and non-buffering; oversized streams fail with `ObjectStorageLimitError` before persistence.

### ADR-114: Bound Redis AI cache envelopes

The Redis AI result-cache adapter now enforces a 16 MiB UTF-8 serialized-envelope ceiling on both reads and writes. Oversized or malformed reads are evicted before parsing, and oversized/non-serializable writes fail deterministically before contacting Redis. This limits cache-memory and parser exposure while preserving exact-result cache isolation and the provider-independent execution path.

### ADR-115: Fail closed on unsafe AI canonicalization

The AI gateway canonical JSON serializer now rejects cycles, unsupported JSON values, non-finite numbers, nesting deeper than 32 levels, and UTF-8 output larger than 16 MiB. Canonical input is used for prompt-injection inspection, cache keys, stable prefixes, and dynamic provider payloads, so ambiguous or unbounded values must fail before provider dispatch rather than relying on `JSON.stringify` coercion or risking recursive exhaustion.

### ADR-116: Normalize telemetry redaction keys

Telemetry redaction now compares normalized key forms, so casing and separators cannot bypass content or secret-field protections (`Authorization`, `API_KEY`, and `source_text` are treated like their canonical forms). Object output uses property definitions rather than assignment so a telemetry key named `__proto__` remains data and cannot mutate the result prototype.

### ADR-117: Bound MFA primitive inputs

TOTP enrollment, verification, and recovery-code primitives now reject oversized labels, issuers, secrets, codes, and recovery-hash sets before URI construction, base32 decoding, or hashing. These bounds keep exported authentication helpers fail-fast even when called outside the API body limit and prevent unbounded attacker-controlled work in security-sensitive code.

### ADR-118: Bound restricted-data encryption envelopes

Restricted-text encryption now caps plaintext at 16 MiB and serialized envelopes at 32 MiB. Decryption validates URL-safe base64 component syntax, exact AES-GCM IV/tag sizes, and ciphertext/plaintext ceilings before decoding or opening the cipher. This keeps malformed database or API blobs from causing unbounded JSON/base64 allocation while preserving archive-scoped key separation.

### ADR-119: Fail closed on export canonicalization

Portable export JSONL canonicalization now rejects cyclic values, unsupported JSON values, non-finite numbers, and nesting deeper than 32 levels before serialization and fixity computation. Object keys remain deterministically sorted, while invalid payloads raise an explicit `ExportCanonicalizationError` instead of being silently dropped or coerced by `JSON.stringify`. This keeps manifest hashes and exported evidence bound to valid, reproducible JSON; the full export-fulfillment worker remains a separate blueprint task.

### ADR-120: Bound provenance lineage canonicalization

Provenance lineage validation now runs before schema cloning and rejects cycles, unsupported values, non-finite numbers, nesting beyond 32 levels, and canonical JSON larger than 16 MiB. Canonical object-key ordering remains deterministic, so event hashes cannot be computed over silently coerced or recursively unbounded lineage values. Forbidden raw-content keys continue to fail closed.

### ADR-121: Bound provenance evidence fan-out and offsets

Evidence spans now require safe integer offsets and claim evidence is capped at 1,000 spans, matching the existing evidence-link fan-out contract. This prevents unsafe numeric coercion and unbounded validation work while preserving exact source-span and quotation checks.

### ADR-122: Preserve domain errors for invalid evidence links

The evidence-link contract now rejects unsafe integer offsets, and `confirmFact` maps contract failures to the domain's `VALIDATION_FAILED` error instead of leaking a raw Zod exception. This keeps API/domain boundaries consistent while retaining fail-closed validation.

### ADR-123: Enforce safe quotation source spans

Quotation construction now requires non-negative, safe integer source offsets before accepting an approved span. Relational checks alone could accept fractional or unsafe numeric values that cannot identify a stable source range; invalid spans now fail with `VALIDATION_FAILED`.

### ADR-124: Bound generated and disputed evidence collections

Generated chapter revisions and disputed claims now validate every evidence link against the canonical contract and cap claims, dispute accounts, and per-item evidence at 1,000 entries. Factual generated claims still require at least one evidence link. This prevents malformed or excessively wide evidence graphs from reaching authoritative domain state.

### ADR-125: Enforce annotation provenance bounds and marker fidelity

Annotated candidate extraction now caps fan-out at 1,000 records. Evidence assertion validates candidate UUIDs, kind membership, safe source offsets, and exact marker kind/value fidelity against the authoritative source text before a candidate can be treated as evidenced. This prevents tampered spans, unknown candidate kinds, and excessively wide annotation payloads from crossing the domain boundary.

### ADR-126: Bound narration manifest materialization

Narration manifest construction now requires a non-empty edition scope, non-empty paragraph text, no more than 10,000 chapters, and no more than 16 MiB of UTF-8 narration text. The validated string collection is copied before freezing the manifest, preventing malformed runtime values and unbounded provider-bound narration materialization from crossing the publication boundary.

### ADR-127: Bound telemetry redaction traversal

Telemetry redaction now caps recursive depth at 8, rejects collections larger than 1,000 items, and replaces strings over 16,384 characters with a redacted-limit marker after secret/content replacement. This keeps observability fail-closed against oversized or cyclic detail payloads without allowing log amplification or raw-content bypass.

### ADR-128: Bound publication document rendering

PDF and EPUB rendering now validate title, author, paragraph types, paragraph count, and total UTF-8 text before materializing document lines or ZIP entries. The limits are 500 characters per title/author, 10,000 paragraphs, and 16 MiB total text. This prevents malformed or oversized publication inputs from causing unbounded renderer work while preserving approved empty-paragraph layout semantics.

### ADR-129: Bound provider request materialization

Provider adapters now validate request-side metadata, query cardinality, narration text, email recipients and bodies, Turnstile metadata, and Stripe checkout URLs before dispatch. The bounds prevent oversized headers/forms/payloads and unsafe redirect URLs from reaching external providers while retaining the existing adapter contracts and response ceilings.

### ADR-130: Canonicalize bearer tokens and fail closed on malformed TOTP input

Session verification now requires exactly three token segments, preventing ignored suffixes from being accepted as canonical bearer tokens. TOTP verification now rejects empty or malformed Base32 secrets and non-finite/unsafe timestamps by returning null, preserving its non-throwing verification contract for untrusted inputs.

### ADR-131: Canonicalize and bound Stripe webhook signatures

Stripe signature verification now bounds payload and header sizes, rejects malformed or duplicate timestamp fields, validates every supplied signature digest, and accepts any valid `v1` digest for key rotation. Unknown well-formed signature fields remain compatible with Stripe delivery while ambiguous or oversized inputs fail closed before HMAC comparison.

### ADR-132: Require bounded length for bodyless provider responses

Provider and DeepSeek response readers now reject bodyless responses that omit `Content-Length` rather than calling `arrayBuffer()` without a preallocation bound. Responses with a declared length are still checked against the adapter ceiling before parsing, and streamed responses retain their incremental byte ceilings.

### ADR-133: Bound portable export materialization

Portable export libraries now cap entries at 10,000, evidence IDs per entry at 1,000, textual fields at 500 characters, individual canonical entries at 1 MiB, and JSONL/CSV output at 16 MiB. Limits are enforced before joining or manifest parsing so direct callers cannot bypass the API body limit and trigger unbounded export work.

### ADR-134: Bound provenance chain aggregation

Provenance chain verification and manifest construction now cap event count at 10,000 and serialized manifest materialization at 16 MiB. Individual event canonicalization remains independently bounded, and the manifest builder now accumulates only within the aggregate ceiling before hashing.

### ADR-135: Bound edition manifest contracts

Edition manifests now cap keys at 256, key length at 200 characters, and serialized JSON at 512 KiB. The shared Zod contract performs cycle-safe serialization checks before JSONB persistence, so direct service callers cannot bypass the API body limit with malformed or oversized manifest objects.

### ADR-136: Bound Stripe callback persistence payloads

`ArchiveService.recordStripeWebhook` now serializes provider callback payloads through a cycle-safe 1 MiB guard before opening the tenant transaction or issuing a JSONB insert. This preserves replay hashing while preventing direct service callers from bypassing the HTTP body limit or reaching the database with malformed payload objects.

### ADR-137: Bound persisted session metadata

Session device labels, user-agent strings, and IP-address metadata are now validated at the shared auth boundary before hashing or persistence. The caps (256, 2,048, and 128 characters respectively) apply to both registration and rotation and reject malformed runtime callers with `SESSION_METADATA_INVALID`, preventing direct service consumers from bypassing HTTP body limits or amplifying session-inventory storage.

### ADR-138: Bound direct streamed object downloads

`ObjectStorage.downloadToFile` now defaults to the authoritative 25 GiB streamed-object ceiling and rejects non-safe, non-positive, or larger ceilings before issuing an object-provider request. Production callers already pass the authoritative upload/original size; the default prevents worker, tooling, and future direct callers from accidentally creating an unbounded disk-write path.

### ADR-139: Bound multipart presigned URL lifetimes

`ObjectStorage.signUploadPart` now accepts only integer lifetimes from 1 second through one hour, rejecting invalid values before presigning. The API remains at its existing 15-minute default, while direct worker and tooling callers cannot create unexpectedly long-lived upload capabilities.

### ADR-140: Bound rate-limiter configuration and clock inputs

Fixed-window and Redis-backed rate limiters now require safe integer limits and windows, cap request counts at 1,000,000, cap windows at seven days, cap in-memory buckets at 100,000, and reject negative or non-finite injected timestamps. This preserves deterministic test clocks while preventing malformed configuration from defeating memory bounds or generating invalid retry metadata.

### ADR-141: Bound telemetry event and metric materialization

Observability helpers now cap context fields at 512 characters, metric names at 256, units at 64, label cardinality at 100, label keys at 128, and label values at 512. They reject malformed timestamps and invalid labels before event or metric materialization; recursive detail redaction retains its existing depth, collection, content, and secret protections.

### ADR-142: Enforce complete annual preservation check sets

Annual preservation reviews now validate finding objects through an unknown-safe boundary, reject unknown or duplicate check names, require valid statuses and non-empty bounded details, and cap the finding set to the seven required checks. The review can no longer silently overwrite duplicate checks in a map or accept malformed direct callers that bypass the API schema.

### ADR-143: Enforce quotation offset fidelity

Quotation source spans now require `endOffset - startOffset` to equal the quotation text length after safe-integer and ordering checks. This prevents a structurally valid but semantically inconsistent span from being persisted or used as provenance evidence; the live-fire cited-memoir fixture now derives offsets from the source text.

### ADR-144: Bound publication readiness reports

Publication readiness items now cap labels at 256 characters, reasons at 2,048 characters, and each rights, consent, or citation category at 256 items. The release gate remains fail-closed while preventing direct callers from creating oversized readiness diagnostics or unbounded review collections.

### ADR-145: Bound multipart provider tokens

Multipart completion contracts and storage-provider validation now cap ETag and optional checksum tokens at 1,024 characters. The same bound applies to provider-returned part listings, preventing oversized provider metadata from reaching completion requests or API responses.

### ADR-146: Prevent public hosted worker ingress

The Fly worker manifest now documents and tests the private-worker invariant: no public service routing may be declared, and the worker health server must bind loopback only. This reduces accidental exposure while preserving the separate hosted sandbox attestation gate for syscall, egress, cgroup/PID, read-only-root, and scratch controls.

### ADR-147: Keep production readiness evidence current

`PRODUCTION_READINESS.md` now reflects the current verified test totals and HARDENING-135 private-worker ingress guard. Documentation is treated as a release control: stale counts or omitted gates must not make the engineering state appear more complete than the actual checkpoint.

### ADR-148: Bound parsed provider response fields

Deepgram transcript fields/channels/alternatives, provider request IDs, Resend IDs, Turnstile diagnostics, and Stripe checkout IDs/URLs now have explicit schema limits in addition to aggregate response-byte ceilings. Oversized parsed fields fail closed before adapter results reach callers.

### ADR-149: Normalize malformed provider responses

Provider adapters now convert schema-validation failures into stable non-retryable `ProviderAdapterError` instances. DeepSeek similarly uses a non-retryable `DeepSeekProviderError` for malformed, oversized, or invalid JSON responses, preventing raw Zod details from leaking and avoiding futile retries of deterministic upstream contract violations.

### ADR-150: Validate storage object keys at every access boundary

All `ObjectStorage` key-bearing methods now reject empty, overlong, or control-character keys before issuing provider commands. The 1,024-character ceiling and control-code rejection apply to direct callers as well as API/worker-generated keys, reducing malformed-key and provider-request amplification risk.

### ADR-151: Validate storage upload metadata at direct boundaries

Storage methods now validate provider upload IDs, MIME content types, and SHA-256 base64 checksums before creating, signing, completing, or aborting multipart uploads and before immutable puts. This prevents direct callers from bypassing the API’s upload metadata contracts.

### ADR-152: Bound shared AI gateway payloads and telemetry

The shared AI gateway now rejects source text over 4 MiB before policy redaction, generic provider content over 8 MiB before JSON parsing, oversized provider request IDs, and non-finite, negative, or overlarge usage counters. Provider-specific adapters retain their stricter schemas; the shared boundary prevents alternate providers or direct callers from bypassing those limits and polluting cache or cost telemetry.

### ADR-153: Bound materialized Deepgram input

`DeepgramTranscriber` now rejects audio payloads larger than 128 MiB before copying the `Uint8Array` into a fetch body. The adapter is intentionally materialized rather than streamed; larger source media must use a future bounded chunking workflow instead of silently creating an unbounded provider request.

### ADR-154: Enforce byte-accurate storage metadata limits

Object-storage keys, opaque multipart upload IDs, and content types now enforce UTF-8 byte ceilings in addition to character/shape validation. Provider limits are byte-oriented, so multibyte values that fit JavaScript character counts must fail before any S3-compatible request is issued.

### ADR-155: Reject control characters at provider header boundaries

Provider API keys and header-bearing metadata now reject C0 controls and DEL before request construction. This applies to generic adapters and the DeepSeek authorization header, preventing transport-dependent header injection or malformed outbound requests. The regression suite covers CR/LF credentials and idempotency/content-type metadata without dispatching a network request.

### ADR-156: Remove the owner database credential from the media worker

The worker now requires `WORKER_DATABASE_URL`, provisions a dedicated `family_historian_worker` login, and uses it for queue dispatch and tenant transactions. The role is non-superuser, non-privileged for role/database creation, cannot bypass RLS, and receives queue-control privileges plus explicit membership in the existing RLS-enforcing runtime role. Compose, local-env generation, release workflow configuration, preflight, migration, verification, and security checks all enforce the dedicated credential. Hosted deployment must still prove the worker role secret, RLS policy behavior, and OS/network sandbox before release.

### ADR-157: Reject scoped reads of legacy unscoped encrypted envelopes

`decryptRestrictedText` now fails closed when a caller supplies an archive scope for a version-1 envelope that has no embedded scope. Version-1 data remains readable only through an explicitly unscoped migration path; scoped callers cannot accidentally treat legacy global ciphertext as archive-bound. Version-2 envelopes continue to require an exact archive-scope match.
