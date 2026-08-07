# Remote Session Handoff

## Executive status

- Project: AI Family Historian
- Repository: `C:\dev\AIFamilyHistorian`
- Current commit before this handoff refresh: `4d3d42fbc1d3ff5d7bea9d5ce6b3f9d6b00c848a` (run `git rev-parse HEAD` to confirm the current checkpoint).
- Branch: `master`
- Latest genuine green tag: none; the scheduler lease remains on `EP-000`, so no green tag was created dishonestly.
- Graph status: `RESUME EP-000`
- Engineering completion estimate: 88% weighted implementation completion. This is a progress estimate, not a release approval.
- Production release: blocked. The production gate is fail-closed on missing external credentials and documentary approvals; no production mutation was attempted.
- Why `RUN_COMPLETE` was not reached: `sh scripts/preflight.sh` and `sh scripts/production-readiness-check.sh` both exit 1 at `env var not set: DEEPGRAM_API_KEY`. Hosted provider, CI, staging, DNS, legal, vendor, insurance, data-region, and production-secret evidence is unavailable.

## Verified local evidence

The following commands passed after the continuation changes:

- `sh scripts/lint.sh` -> `lint: ok`
- `sh scripts/format-check.sh` -> `format check: ok`
- `sh scripts/typecheck.sh` -> `typecheck: ok`
- `sh scripts/test-unit.sh` -> `unit tests: ok` (17 files, 48 tests)
- `sh scripts/test-integration.sh` -> `integration tests: ok` (4 files, 7 tests)
- `sh scripts/test-e2e.sh` -> `e2e tests: ok` (3 files, 8 tests)
- `sh scripts/build.sh` -> `build: ok`
- `sh scripts/security-check.sh` -> `security check: ok`
- `sh scripts/dependency-audit.sh` -> `dependency audit: ok`
- `sh scripts/reality-gate.sh` -> `reality gate: ok`
- `sh scripts/smoke-test.sh` -> `smoke test: ok`
- `sh scripts/live-fire.sh` -> `live-fire: ok`; all sixteen proof names passed against real local services, including the authenticated DeepSeek cache/provenance proof.
- `sh scripts/backup.sh` -> `backup: ok`; a streaming AES-256-GCM encrypted PostgreSQL custom-format backup and SHA-256 sidecar were created under ignored `.artifacts/` (`family-historian-20260807T063342Z.dump.enc`).
- `sh scripts/restore-check.sh .artifacts/backups/family-historian-20260807T063342Z.dump.enc` -> `restore-check: ok`; the encrypted backup decrypted into a disposable database and reported `schema_migrations=4`.
- `sh scripts/performance-smoke.sh` -> `performance: ok requests=100 p95=0.52ms` against the real Fastify health endpoint.
- Media executor unit coverage -> no-shell child process execution, scratch-path confinement, bounded output, timeout termination, and unavailable-tool mapping all pass with a real local child process; pinned media binaries remain unavailable.
- Authenticated multipart API E2E -> signed part URL, real MinIO PUT, completion, streamed SHA-256 fixity, and immutable-original persistence all passed.
- Multipart resume status -> API returned the provider-listed completed part number, ETag, and byte size before completion.
- Multipart completion contract -> duplicate part numbers are rejected before any provider call.
- `docker build --target runtime --build-arg SERVICE=api --tag ai-family-historian:local-verify-20260807 .` -> image present after the reduced context build; `docker image inspect` observed `user=node` and the HTTP healthcheck; `docker compose config --quiet` passed.
- `docker compose config --quiet` -> passed.
- `sh scripts/local-services-check.sh` -> `local services: ok`.

## Subsystem status

| Subsystem | Status | Completed behavior | Tests passing | External verification remaining | Known risks |
|---|---|---|---|---|---|
| Repository/toolchain | Engineering complete locally | Pinned Node/pnpm workspace, migrations, scripts, CI definition, formatting and type gates | All local gates above | Hosted CI runner | Remote CI secrets and runner policy are unverified |
| Domain and persistence | Engineering complete locally | Tenant-scoped PostgreSQL, RLS, idempotency, immutable originals, evidence-linked facts, consent, rights, deletion, publication hashes, signed multipart API uploads with streamed SHA-256 fixity, provider-listed resumable parts, local backup/restore rehearsal | Database integration, storage integration, authenticated multipart API E2E, unit invariants, archive-membership/deletion proofs, disposable restore-check | Neon/Upstash/R2 hosted probes; production backup retention/restore | Full production schema scale, large-object transfer cost, provider pagination, and hosted restore drill remain unproven |
| API and web client | Engineering complete locally | Fastify health/auth/archive routes, idempotent mutations, private-by-default UI workflow | API E2E, web E2E, smoke | Staging URL and browser accessibility/performance audit | Product surface is intentionally bounded relative to the full blueprint |
| Authentication and authorization | Local MFA hardening complete; passkey rollout pending | Signed sessions, archive permission checks, tenant boundaries, fail-closed visibility/rights checks, RFC-compatible TOTP enrollment/replay protection/recovery codes | Unit, integration, E2E; TOTP RFC-vector coverage | WebAuthn/passkey provider live-fire, device management, production secret injection | Native auth/TOTP are not a substitute for a completed Better Auth/passkey rollout |
| AI gateway | Local and authenticated nonproduction proof complete | DeepSeek adapter, policy/DLP, prompt canonicalization, structured output, provenance, usage/cache telemetry, disablement behavior | Unit, contract, authenticated DeepSeek live-fire | Production key/vendor approval and hosted retention/location evidence | Current development key must be rotated before production |
| Transcription/narration/email/billing providers | Adapter engineering complete | Deepgram, ElevenLabs, Resend, Stripe, Turnstile HTTP adapters with bounded retries, validation, signature checks, and local protocol tests; local billing/quota domain | Provider local HTTP contract tests and all sixteen local live-fire proofs | Authenticated sandbox probes, signed webhook delivery, vendor approvals | No external delivery or payment effect was fabricated |
| Documents and exports | Local implementation complete | Tamper-evident provenance/audit chains, portable JSONL/CSV manifest, deterministic text-first PDF/EPUB, release-gated publication bundle, explicit-marker candidate extraction, 25 GB resumable chunk manifest/part recovery planner, media quarantine/derivative command plans, no-shell worker executor with path confinement and bounded time/output | Unit and `book-pdf-epub`/`portable-export`/`evidence-extraction` live-fire | Accessible-PDF/EPUB audit and 25 GB transfer/recovery rehearsal | Advanced layout, media embedding, automatic NLP extraction, pinned media-tool fixture execution, and formal accessibility audit remain |
| Observability/operations | Local implementation complete | Redacted structured telemetry, metric samples, OTel local sink, immutable audit events, streaming encrypted backup/restore scripts, incident/runbook guidance | Unit, local collector/reality gates, encrypted backup and disposable restore-check | Hosted Sentry/OTLP, KMS wrapping, alert paging, production retention/restore | Hosted restore and quarterly preservation drills remain operator-owned |
| Deployment/release | Local artifact complete | Non-root Docker image, healthcheck, Fly staging config, release workflow, manual production command | Docker build and compose config | GHCR, Fly staging smoke, DNS/certificates, production migration and rollback | No cloud mutation or auto-deploy was authorized |
| Privacy/legal/business | Technical controls present; approvals absent | Draft privacy/terms/consent/rights/minor/voice/takedown/DPIA/retention artifacts and technical request paths | Technical policy and security tests | Counsel, vendor, insurance, DPA, data-region, data-broker, retention approvals | Cannot be marked production-ready without signed evidence |

## Graph status

| Node | Status | Reason |
|---|---|---|
| EP-000 | In progress; externally unverified | Scheduler lease preserved; preflight stops at missing `DEEPGRAM_API_KEY`. |
| EP-001 | Engineering complete; externally unverified | Foundation and toolchain gates passed locally; graph dependency remains EP-000. |
| EP-002 | Engineering complete; externally unverified | Domain invariants and tests passed locally; graph dependency remains EP-000. |
| EP-003 | Engineering complete; externally unverified | Migrations, RLS, storage and persistence tests passed locally; hosted probes remain. |
| EP-004 | Engineering continuation complete; externally unverified | API/service layer and provider adapters pass local tests; hosted provider probes remain. |
| EP-005 | Engineering continuation complete; externally unverified | UI/E2E and all live-fire dispatchers pass locally; graph lease remains EP-000. |
| EP-006 | Engineering complete; externally unverified | Auth/security gates pass locally; OAuth/passkey/provider evidence remains. |
| EP-007 | Engineering continuation complete; externally unverified | All 16 live-fire proofs and local regression gates pass; full verify cannot start. |
| EP-008 | Engineering continuation complete; externally unverified | Observability package/runbooks and local checks pass; hosted telemetry and restore remain. |
| EP-009 | Engineering continuation complete; externally unverified | Container/Fly/workflow artifacts and local image build pass; staging/deployment/rollback remain. |
| EP-010 | Pending | Production readiness is blocked by preflight and legal/business evidence. |

## Deferred external requirements

The authoritative full register is [.agent/state/DEFERRED_EXTERNALS.md](.agent/state/DEFERRED_EXTERNALS.md). The remaining high-leverage items are:

| Requirement | Variables/artifact | Exact probe | Validation after supply | Production blocked |
|---|---|---|---|---|
| Deepgram transcription | `DEEPGRAM_API_KEY` | `sh scripts/probes/deepgram_api_key.sh` | `sh scripts/preflight.sh && sh scripts/live-fire.sh` | Yes under current gate |
| Cloudflare R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | `sh scripts/probes/r2.sh` | `sh scripts/preflight.sh && sh scripts/live-fire.sh` | Yes |
| Stripe sandbox | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | `sh scripts/probes/stripe.sh` | `sh scripts/preflight.sh && sh scripts/live-fire.sh` | Yes |
| Resend delivery | `RESEND_API_KEY`, `EMAIL_FROM` | `sh scripts/probes/resend.sh` | `sh scripts/preflight.sh && sh scripts/live-fire.sh` | Yes |
| Turnstile | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | `sh scripts/probes/turnstile.sh` | `sh scripts/preflight.sh` | Yes |
| Sentry/hosted OTLP | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | `sh scripts/probes/sentry.sh` and `sh scripts/probes/otel.sh` | `sh scripts/preflight.sh` | Yes under current gate |
| GitHub/GHCR | `GITHUB_TOKEN`, `GITHUB_REPOSITORY` | `sh scripts/probes/github.sh` | `sh scripts/preflight.sh` and remote workflow run | Yes |
| Fly staging/production | `FLY_API_TOKEN`, `FLY_APP_STAGING`, `FLY_APP_PRODUCTION` | `sh scripts/probes/fly.sh` | staging deploy and smoke, then manual production command | Yes |
| Application production secrets | `SESSION_SECRET`, `FIELD_ENCRYPTION_MASTER_KEY`, `DOWNLOAD_SIGNING_SECRET`, `BACKUP_ENCRYPTION_KEY` | Presence check in `sh scripts/preflight.sh` | production secret-manager/KMS injection plus readiness check | Yes |
| Legal/vendor/insurance/DPIA/retention | `LEGAL_APPROVAL_FILE`, `VENDOR_RISK_APPROVAL_FILE`, `INSURANCE_EVIDENCE_FILE`, `DPIA_APPROVAL_FILE`, `RETENTION_APPROVAL_FILE` | File-presence gates in `sh scripts/preflight.sh` | `sh scripts/production-readiness-check.sh` | Yes |
| Data region and data-broker determinations | `compliance/evidence/data-region-verification.md`, `compliance/evidence/data-broker-determination.md` | `sh scripts/production-readiness-check.sh` | same command after signed artifacts exist | Yes |
| Local media executables | `ffmpeg`, `ffprobe`, `exiftool`, `magick`, `clamscan`, `ocrmypdf`, `python` | `sh scripts/media-tools-check.sh` | install pinned tools, then rerun media fixture/live-fire checks | Yes for media release |

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

- Hosted transcription, narration, email, billing, abuse-prevention, telemetry, R2, CI, and Fly behavior is not live-fire verified; production backup KMS wrapping and retention are also pending.
- Actual 25 GB transfer/recovery, pinned FFmpeg/OCR/ClamAV execution, authenticated k6 performance, and formal WCAG/PDF/EPUB audits remain unproven; the bounded 100-request health smoke, no-shell media executor, and local backup/restore now have executable rehearsals.
- Native session signing and TOTP/recovery controls are implemented, but passkeys/WebAuthn, device management, and production MFA rollout need live verification.
- The product surface is a bounded modular-monolith foundation, not a claim that every blueprint UI and worker feature is complete; extraction intentionally accepts explicit source markers only and does not auto-confirm facts.
- Legal, insurance, vendor, data-region, and policy approvals are not engineering artifacts and remain fail-closed.

## Final operator checklist

1. Supply and probe `DEEPGRAM_API_KEY`; rerun `sh scripts/preflight.sh`.
2. Supply real R2, Stripe, Resend, Turnstile, Sentry/OTLP, GitHub, and Fly credentials; run each named probe and the full verify gate.
3. Obtain and place the signed legal/vendor/insurance/DPIA/retention/data-region/data-broker artifacts outside Git; rerun production readiness.
4. Run the GitHub release workflow, deploy staging, run health/live-fire smoke, and complete a restore and rollback drill.
5. Rotate the local development DeepSeek key and inject production-scoped secrets only after vendor approval.
6. Run the documented manual production deploy command only after every production-readiness sentinel and approval is genuine.
