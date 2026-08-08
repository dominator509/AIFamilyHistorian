# Remote Session Handoff

## Executive status

- Project: AI Family Historian
- Repository: `C:\dev\AIFamilyHistorian`
- Current code checkpoint: `81cb224` (privacy/export/narration review intake, Redis limiter, authoritative request-time archive membership revalidation on URL, privacy, and billing routes, API authorization/publication/MIME hardening, archive-to-organization context validation at service entry points, composite tenant foreign keys across keyed tables, bounded worker derivatives, authenticated principal/archive rate scopes, production secret entropy validation, revocable bearer sessions with explicit logout, transaction-serialized active-upload and archive queue quotas, derivative recipe idempotency, archive partitioning, provider-authoritative billing state, bounded provider and DeepSeek circuit breakers, strict CORS allowlisting, durable signature-verified Stripe callback ingestion with archive metadata validation, bounded magic-byte upload signature validation, OS-bounded worker runtime artifacts, behavior-backed security-gate assertions, deployment-image identity alignment, local worker internal-only egress network, tracked-secret scanning in CI/verify, and preserved stale-scan handoff evidence).
- Branch: `master`
- Latest genuine green tag: none; the scheduler lease remains on `EP-000`, so no green tag was created dishonestly.
- Graph status: `RESUME EP-000`
- Engineering completion estimate: 93% weighted implementation completion. This is a progress estimate, not a release approval.
- Production release: blocked. The production gate is fail-closed on missing external credentials and documentary approvals; no production mutation was attempted.
- Why `RUN_COMPLETE` was not reached: Deepgram, DeepSeek, Stripe, and Resend authenticated probes now pass, while aggregated `sh scripts/preflight.sh` reports 14 unresolved requirements (Turnstile, Sentry, GitHub, Fly.io, and legal/vendor/insurance/DPIA/retention evidence). Hosted abuse-prevention, CI, staging, DNS, legal, vendor, insurance, data-region, and production-secret evidence remains unavailable.

## Verified local evidence

The following commands passed after the continuation changes:

- `sh scripts/lint.sh` -> `lint: ok`
- `sh scripts/format-check.sh` -> `format check: ok`
- `sh scripts/typecheck.sh` -> `typecheck: ok`
- `pnpm test:unit` -> 24 files, 79 tests passed (including strict bearer, storage production endpoint, telemetry-secret, media subprocess isolation, bounded content-signature validation, provider circuit-breaker behavior, explicit logout/revocation, request-time membership revalidation on URL/privacy/billing routes, worker sandbox declarations, configuration placeholder, entropy, strict CORS allowlist, fixed-window limiter, Redis distributed limiter, principal/archive rate-scope, and session-revocation regressions)
- `sh scripts/test-integration.sh` -> `integration tests: ok` (11 files, 31 tests, including real PostgreSQL concurrent upload-reservation and archive-queue-capacity serialization, archive-to-organization context rejection, composite foreign-key rejection, Redis distributed rate limiting and revocation persistence, derivative recipe uniqueness/fixity, archive-partition isolation, provider-authoritative billing status and subscription uniqueness, tenant-scoped privacy/deletion-hold evidence, export and narration review intake, SQL outbox claim/lease/completion/retry/dead-letter, unsupported-job, and stale-worker fencing proofs, DeepSeek circuit-breaker behavior, and signed Stripe webhook persistence, replay, payload-hash mismatch, and tenant-metadata rejection)
- `sh scripts/test-e2e.sh` -> `e2e tests: ok` (3 files, 11 tests, including valid WAV acceptance and mismatched PNG-as-WAV rejection before immutable persistence)
- `sh scripts/build.sh` -> `build: ok`
- `sh scripts/security-check.sh` -> `security check: ok` (behavioral API, media-signature, revocable-session, and worker-sandbox assertions)
- `sh scripts/secret-scan.sh` -> `secret scan: ok`; tracked files contain no credential-shaped tokens or private-key markers, and the test fixture constructs its redaction token at runtime to avoid placing a secret-shaped literal in Git.
- `sh scripts/dependency-audit.sh` -> `dependency audit: ok`
- `sh scripts/reality-gate.sh` -> `reality gate: ok`
- `sh scripts/smoke-test.sh` -> `smoke test: ok`
- `sh scripts/live-fire.sh` -> `live-fire: ok`; all sixteen proof names passed against real local services, including the authenticated DeepSeek cache/provenance proof.
- `sh scripts/probes/deepgram_api_key.sh` -> authenticated Deepgram projects probe passed.
- `sh scripts/probes/deepgram_transcription.sh` -> authenticated sample transcription passed (`request_id` observed; 136 transcript characters); no provider audio or transcript was persisted.
- `sh scripts/probes/deepseek_api_key.sh` -> authenticated DeepSeek probe passed with the newly supplied local credential; production rotation and vendor approval remain required.
- `sh scripts/probes/resend.sh` -> authenticated Resend domains probe passed; verified sender and recipient delivery remain required.
- `sh scripts/backup.sh` -> `backup: ok`; a streaming AES-256-GCM encrypted PostgreSQL custom-format backup and SHA-256 sidecar were created under ignored `.artifacts/` (`family-historian-20260808T105114Z.dump.enc`).
- `sh scripts/restore-check.sh .artifacts/backups/family-historian-20260808T124048Z.dump.enc` -> `restore-check: ok`; the encrypted backup decrypted into a disposable database and reported `schema_migrations=11`.
- `sh scripts/performance-smoke.sh` -> `performance: ok requests=100 p95=0.95ms` against the real Fastify health endpoint.
- Media executor unit coverage -> no-shell child process execution, scratch-path confinement, bounded output, timeout termination, and unavailable-tool mapping all pass with a real local child process; pinned media binaries remain unavailable.
- Authenticated multipart API E2E -> signed part URL, real MinIO PUT, completion, streamed SHA-256 fixity, and immutable-original persistence all passed.
- Multipart resume status -> API returned the provider-listed completed part number, ETag, and byte size before completion.
- Multipart completion contract -> duplicate part numbers are rejected before any provider call.
- `docker build --target runtime --build-arg SERVICE=api --tag ai-family-historian:local-verify-20260807 .` -> image present after the reduced context build; `docker image inspect` observed `user=node` and the HTTP healthcheck; `docker compose config --quiet` passed.
- `docker compose config --quiet` -> passed.
- `sh scripts/local-services-check.sh` -> `local services: ok`.
- `docker build --target worker-runtime -t family-historian-worker:local .` -> worker image build passed with frozen pnpm install, workspace build, and pinned Debian media packages.
- `docker run --rm --entrypoint sh family-historian-worker:local -c 'for tool in ffmpeg ffprobe exiftool magick clamscan ocrmypdf python3; do command -v "$tool" >/dev/null || exit 1; done'` -> `worker-media-tools: ok`.
- `docker compose --profile worker config --quiet` -> passed with the worker, PostgreSQL, Redis, and object-storage services on the internal-only `family_historian_internal` network; focused worker-sandbox tests passed.
- `sh scripts/preflight.sh` -> 14 `preflight: unresolved ...` lines followed by `preflight: FAIL - 14 unresolved requirements` (exit 1; complete external inventory, not an engineering test failure).
- Codex Security standard scan `5bdf16f7-5442-4419-beb5-5e9eb6d3c1a7` -> completed against revision `b2bee83fc9ef9c97c52b88b42b14aa78f19c6033` with four source-backed medium findings: server-side session revocation/rotation, authenticated aggregate quotas, worker OS-level media resource ceilings, and per-archive KMS key management. The scan warns that the working tree changed during scanning; current API boundary fixes are verified separately.
- A newer Codex Security standard scan `f35cd9aa-1f01-45fa-8947-45cfab54ce89` was launched against the pre-HARDENING-24 revision `496ff04`; its native discovery worker has remained at zero completed review rows after preflight despite bounded progress updates. It is preserved as running/stale rather than canceled or reported as a no-findings result; current revisions are covered by the source-backed hardening passes and local gates documented here.
- Required Codex Security deep scan -> terminal setup failure before discovery: `in_scope_files.txt:1 must be a safe repository-relative path`; no security findings were inferred from this failed scan.

## Subsystem status

| Subsystem | Status | Completed behavior | Tests passing | External verification remaining | Known risks |
|---|---|---|---|---|---|
| Repository/toolchain | Engineering complete locally | Pinned Node/pnpm workspace, migrations, scripts, CI definition, formatting and type gates, tracked-secret scan in CI/verify | All local gates above | Hosted CI runner | Remote CI secrets and runner policy are unverified |
| Domain and persistence | Engineering complete locally | Tenant-scoped PostgreSQL, RLS, archive-to-organization context validation, composite tenant foreign keys, idempotency, immutable originals, bounded magic-byte upload signatures, derivative recipe uniqueness/fixity, provider-authoritative subscription state, one-current-subscription constraint, durable append-only Stripe callback events with exact payload/hash and replay protection, evidence-linked facts, consent, rights, deletion, publication hashes, signed multipart API uploads with streamed SHA-256 fixity, provider-listed resumable parts, uploader ownership, transaction-serialized active-upload quotas, transaction-serialized archive outbox capacity guard, storage usage-ledger accounting, local backup/restore rehearsal | Database integration, storage integration, authenticated multipart API E2E, valid/mismatched signature regressions, concurrent upload and queue quota regressions, archive-context and webhook metadata rejection, composite foreign-key rejection, derivative uniqueness, billing boundary, signed webhook replay/payload mismatch, unit invariants, archive-membership/deletion proofs, disposable restore-check | Neon/Upstash/R2 hosted probes; production backup retention/restore | Plan-level usage/quota reconciliation and queue fairness, signed billing webhook delivery and downstream reconciliation, full production schema scale, large-object transfer cost, provider pagination, and hosted restore drill remain unproven |
| API and web client | Engineering complete locally | Fastify health/auth/archive routes, durable signature-verified Stripe webhook endpoint, idempotent mutations, private-by-default UI workflow, strict HTTPS CORS allowlist with same-origin default | API E2E, web E2E, smoke, CORS unit regression, real PostgreSQL webhook ingestion/replay tests | Staging URL, reachable signed Stripe sandbox delivery, production origin provisioning, and browser accessibility/performance audit | Product surface is intentionally bounded relative to the full blueprint |
| Authentication and authorization | Local bearer/TOTP hardening complete; native auth/passkey rollout pending | Short-lived signed sessions with random IDs, Redis-backed hashed revocation deny-list, explicit current-session logout, request-time authoritative archive membership revalidation on URL, privacy, billing, and archive-list routes, archive permission checks, owner-gated member changes, tenant-scoped rights subjects, pending-only rights/media/share boundaries, privacy-write authorization, tenant boundaries, cross-archive mutation checks, fail-closed visibility/rights checks, RFC-compatible TOTP enrollment/replay protection/recovery codes, Redis-backed distributed IP/principal/archive rate scopes | Unit 78, integration 16, E2E 11; TOTP RFC-vector, logout/revocation, membership revalidation, Redis limiter and revocation persistence, principal/archive limiter, cross-scope rights/upload, and publication-boundary coverage | WebAuthn/passkey live-fire, native login/session issuance persistence, rotation, device management, administrative revocation workflow, byte/active-upload/queue quotas, production secret injection | Legacy tokens without IDs remain compatibility-only; no native login or session inventory exists yet |
| AI gateway | Local and authenticated nonproduction proof complete | DeepSeek adapter, policy/DLP, recursive structured-input redaction, prompt canonicalization, tenant-isolated exact-result cache adapter, structured output, provenance, usage/cache telemetry, disablement behavior | Unit, contract, authenticated DeepSeek live-fire, cache isolation/redaction regressions | Production cache backend wiring, key/vendor approval, hosted retention/location evidence | Cache is an injected adapter and is not wired into the API process; current development key must be rotated before production |
| Worker and job execution | Dispatcher, media quarantine, privacy-request, export, and narration intake paths implemented; fulfillment families pending | SQL `FOR UPDATE SKIP LOCKED` claim/lease, UUID lease-token fencing, validated UUID archive partitioning, tenant transaction scope, bounded retry/backoff/dead-letter, unsupported-job fail-closed behavior, archive queue-capacity guard, streamed object download/fixity, media plan execution, bounded 256 MiB per-derivative and 512 MiB per-job output materialization, database-unique derivative recipes with SHA-256 conflict checks, clean/error quarantine transitions, privacy review intake with deletion holds, review-gated export/narration intake, OS-bounded worker runtime artifacts, and an internal-only local worker network | 20 real-database integration tests; worker image build/tool probe; media executor, sandbox, and internal-network declaration unit coverage; worker type/lint/unit/integration rerun | Privacy fulfillment/export/narration/transcription/deletion execution families, hosted object-storage fixture, production queue topology and authenticated media fixture, hosted syscall/network/cgroup sandbox proof | Intake handlers intentionally stop at review-required states; unimplemented fulfillment job types remain fail-closed; media fixture/live-fire still needs a representative object in the worker image; hosted network/syscall enforcement, production partition topology, and queue fairness remain deployment gates |
| Transcription/narration/email/billing providers | Adapter engineering complete | Deepgram, ElevenLabs, Resend, Stripe, Turnstile HTTP adapters with bounded retries, validation, signature checks, and local protocol tests; authenticated Deepgram sample, Stripe balance/Checkout Session, and Resend domains probes; durable signed Stripe callback ingestion; local billing/quota domain | Provider local HTTP contract tests and all sixteen local live-fire proofs; 3 webhook integration regressions | Resend sender/recipient delivery, Turnstile, signed Stripe webhook delivery and downstream reconciliation, remaining hosted probes, vendor approvals | No external delivery or payment effect was fabricated |
| Documents and exports | Local implementation complete | Tamper-evident provenance/audit chains, portable JSONL/CSV manifest, deterministic text-first PDF/EPUB, release-gated publication bundle, explicit-marker candidate extraction, 25 GB resumable chunk manifest/part recovery planner, media quarantine/derivative command plans, no-shell worker executor with path confinement and bounded time/output | Unit and `book-pdf-epub`/`portable-export`/`evidence-extraction` live-fire | Accessible-PDF/EPUB audit and 25 GB transfer/recovery rehearsal | Advanced layout, media embedding, automatic NLP extraction, pinned media-tool fixture execution, and formal accessibility audit remain |
| Observability/operations | Local implementation complete | Redacted structured telemetry, metric samples, OTel local sink, immutable audit events, streaming encrypted backup/restore scripts, incident/runbook guidance | Unit, local collector/reality gates, encrypted backup and disposable restore-check | Hosted Sentry/OTLP, KMS wrapping, alert paging, production retention/restore | Hosted restore and quarterly preservation drills remain operator-owned |
| Deployment/release | Local artifact complete | Non-root Docker image, healthcheck, Fly staging config, release workflow, manual production command | Docker build and compose config | GHCR, Fly staging smoke, DNS/certificates, production migration and rollback | No cloud mutation or auto-deploy was authorized |
| Privacy/legal/business | Technical controls present; approvals absent | Draft privacy/terms/consent/rights/minor/voice/takedown/DPIA/retention artifacts and technical request paths | Technical policy and security tests | Counsel, vendor, insurance, DPA, data-region, data-broker, retention approvals | Cannot be marked production-ready without signed evidence |

## Graph status

| Node | Status | Reason |
|---|---|---|
| EP-000 | In progress; externally unverified | Scheduler lease preserved; aggregated preflight currently reports 14 unresolved requirements. |
| EP-001 | Engineering complete; externally unverified | Foundation and toolchain gates passed locally; graph dependency remains EP-000. |
| EP-002 | Engineering complete; externally unverified | Domain invariants and tests passed locally; graph dependency remains EP-000. |
| EP-003 | Engineering complete; externally unverified | Migrations, RLS, storage and persistence tests passed locally; hosted probes remain. |
| EP-004 | Engineering continuation complete; externally unverified | API/service layer, provider adapters, SQL outbox dispatcher, and media handler pass local tests; authenticated Deepgram sample, Stripe Checkout Session, and Resend domains probes pass, while delivery/webhook and remaining hosted probes remain. |
| EP-005 | Engineering continuation complete; externally unverified | UI/E2E and all live-fire dispatchers pass locally; graph lease remains EP-000. |
| EP-006 | Engineering complete; externally unverified | Auth/security gates pass locally; OAuth/passkey/provider evidence remains. |
| EP-007 | Engineering continuation complete; externally unverified | All 16 live-fire proofs and local regression gates pass; full verify cannot start. |
| EP-008 | Engineering continuation complete; externally unverified | Observability package/runbooks and local checks pass; hosted telemetry and restore remain. |
| EP-009 | Engineering continuation complete; externally unverified | Non-root API image, dedicated worker-runtime image with media tools, Fly configs, and workflow artifacts pass local build/config checks; staging/deployment/rollback remain. |
| EP-010 | Pending | Production readiness is blocked by preflight and legal/business evidence. |

## Deferred external requirements

The authoritative full register is [.agent/state/DEFERRED_EXTERNALS.md](.agent/state/DEFERRED_EXTERNALS.md). The remaining high-leverage items are:

| Requirement | Variables/artifact | Exact probe | Validation after supply | Production blocked |
|---|---|---|---|---|
| Deepgram transcription | `DEEPGRAM_API_KEY` | `sh scripts/probes/deepgram_api_key.sh` and `sh scripts/probes/deepgram_transcription.sh` | `sh scripts/preflight.sh && sh scripts/live-fire.sh` | Yes under current gate |
| Cloudflare R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | `sh scripts/probes/r2.sh` | `sh scripts/preflight.sh && sh scripts/live-fire.sh` | Yes |
| Stripe sandbox | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | `sh scripts/probes/stripe.sh` and `sh scripts/probes/stripe_checkout.sh` | `sh scripts/preflight.sh && sh scripts/live-fire.sh` | Yes |
| Resend delivery | `RESEND_API_KEY`, `EMAIL_FROM` | `sh scripts/probes/resend.sh` | `sh scripts/preflight.sh && sh scripts/live-fire.sh` plus verified sender/recipient delivery | Yes |
| Turnstile | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | `sh scripts/probes/turnstile.sh` | `sh scripts/preflight.sh` | Yes |
| Sentry/hosted OTLP | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | `sh scripts/probes/sentry.sh` and `sh scripts/probes/otel.sh` | `sh scripts/preflight.sh` | Yes under current gate |
| GitHub/GHCR | `GITHUB_TOKEN`, `GITHUB_REPOSITORY` | `sh scripts/probes/github.sh` | `sh scripts/preflight.sh` and remote workflow run | Yes |
| Fly staging/production | `FLY_API_TOKEN`, `FLY_APP_STAGING`, `FLY_APP_PRODUCTION` | `sh scripts/probes/fly.sh` | staging deploy and smoke, then manual production command | Yes |
| Application production secrets | `SESSION_SECRET`, `FIELD_ENCRYPTION_MASTER_KEY`, `DOWNLOAD_SIGNING_SECRET`, `BACKUP_ENCRYPTION_KEY` | Presence check in `sh scripts/preflight.sh` | production secret-manager/KMS injection plus readiness check | Yes |
| Legal/vendor/insurance/DPIA/retention | `LEGAL_APPROVAL_FILE`, `VENDOR_RISK_APPROVAL_FILE`, `INSURANCE_EVIDENCE_FILE`, `DPIA_APPROVAL_FILE`, `RETENTION_APPROVAL_FILE` | File-presence gates in `sh scripts/preflight.sh` | `sh scripts/production-readiness-check.sh` | Yes |
| Data region and data-broker determinations | `compliance/evidence/data-region-verification.md`, `compliance/evidence/data-broker-determination.md` | `sh scripts/production-readiness-check.sh` | same command after signed artifacts exist | Yes |
| Local media executables | `ffmpeg`, `ffprobe`, `exiftool`, `magick`, `clamscan`, `ocrmypdf`, `python` | `sh scripts/media-tools-check.sh` (host probe remains deferred) | `docker build --target worker-runtime -t family-historian-worker:local .` then the worker-image tool probe and representative media fixture | Yes for media release |

## Commands to resume

Run from `C:\dev\AIFamilyHistorian` using the installed Git POSIX shell on Windows:

```text
set PATH=C:\Program Files\Git\usr\bin;C:\Program Files\Git\cmd;%PATH%
cd /d C:\dev\AIFamilyHistorian
sh scripts/ensure-local-backup-key.sh
sh scripts/preflight.sh
sh scripts/graph-next.sh
sh scripts/verify.sh
sh scripts/production-readiness-check.sh
```

After the missing credentials and approvals are supplied, run the exact probes in the table above, then rerun `sh scripts/preflight.sh`, `sh scripts/verify.sh`, and `sh scripts/production-readiness-check.sh`. The scheduler should then be run again with `sh scripts/graph-next.sh` until each node genuinely emits its own sentinel and green tag.

Manual staging rehearsal:

```text
flyctl deploy --config fly.toml --app "$FLY_APP_STAGING" --image "ghcr.io/$GITHUB_REPOSITORY:$RELEASE_TAG" --strategy rolling
curl --fail --silent --show-error "$STAGING_BASE_URL/health/ready"
```

Manual production deployment remains explicitly operator-authorized only:

```text
fly deploy --app "$FLY_APP_PRODUCTION" --image "ghcr.io/$GHCR_OWNER/family-historian:$RELEASE_TAG" --strategy rolling
```

## Legal and business actions

1. Obtain counsel approval for the Privacy Policy, Terms, recording/interview consent, contributor release, publication approval, voice/likeness, copyright/takedown, minor-content, and defamation/editorial policies.
2. Complete the provider-by-provider vendor risk and data-processing assessment, including current DeepSeek, Deepgram, ElevenLabs, R2, Neon, Upstash, Sentry, Resend, Stripe, and print-provider terms.
3. Obtain active cyber, technology E&O, and media-liability insurance evidence.
4. Obtain signed DPIA, retention schedule, data-residency, and data-broker determinations.
5. Confirm the production business identity, support/incident contacts, jurisdiction matrix, and manual release authority.
6. Create least-privilege production accounts and inject rotated secrets through the production secret manager; do not reuse the local development DeepSeek credential.

## Known risks

- Hosted narration, email delivery, abuse-prevention, telemetry, R2, CI, and Fly behavior is not live-fire verified; Deepgram authenticated sample transcription, Stripe test Checkout Session creation, and Resend domains authentication passed, but verified email delivery, signed Stripe webhook delivery, production vendor approval, retention/location review, and end-to-end media workflow proof remain; production backup KMS wrapping and retention are also pending.
- Actual 25 GB transfer/recovery, pinned FFmpeg/OCR/ClamAV execution, authenticated k6 performance, and formal WCAG/PDF/EPUB audits remain unproven; the bounded 100-request health smoke, no-shell media executor, and local backup/restore now have executable rehearsals.
- Native session signing and TOTP/recovery controls are implemented, and API per-IP throttling is distributed through Redis; passkeys/WebAuthn, device management, per-user/per-archive quotas, and production MFA rollout need live verification.
- The product surface is a bounded modular-monolith foundation, not a claim that every blueprint UI and worker feature is complete; extraction intentionally accepts explicit source markers only and does not auto-confirm facts.
- The worker now has a real SQL dispatcher with lease-token fencing, media quarantine, privacy-request intake, and explicit review-gated export/narration intake. Privacy fulfillment, export generation, transcription, narration synthesis, and deletion execution still require implementation and fixture proofs; unsupported job types fail closed rather than reporting success.
- Legal, insurance, vendor, data-region, and policy approvals are not engineering artifacts and remain fail-closed.

## Final operator checklist

1. Implement and verify remaining worker fulfillment families (privacy, export, transcription, narration synthesis, and deletion), then run representative real-object fixtures through `worker-runtime`.
2. Supply Turnstile site/secret keys; rerun `sh scripts/preflight.sh` and `sh scripts/probes/turnstile.sh`.
3. Verify the Resend sender domain and run a real recipient delivery proof; complete signed Stripe webhook delivery with a reachable endpoint or Stripe CLI forwarding.
4. Obtain and place the signed legal/vendor/insurance/DPIA/retention/data-region/data-broker artifacts outside Git; rerun production readiness.
5. Run the GitHub release workflow, deploy staging, run health/live-fire smoke, and complete a restore and rollback drill.
6. Rotate the local development DeepSeek key and inject production-scoped secrets only after vendor approval.
7. Run the documented manual production deploy command only after every production-readiness sentinel and approval is genuine.
