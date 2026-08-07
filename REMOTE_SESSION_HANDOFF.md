# Remote Session Handoff

## Executive status

- Project: AI Family Historian
- Repository: `C:\dev\AIFamilyHistorian`
- Current commit before this handoff refresh: `8a4b891ca13c5e496bebd41be229ca36eb63fb5f` (run `git rev-parse HEAD` to confirm the final handoff commit).
- Branch: `master`
- Latest genuine green tag: none; the scheduler lease remains on `EP-000`, so no green tag was created dishonestly.
- Graph status: `RESUME EP-000`
- Engineering completion estimate: 79% weighted implementation completion. This is a progress estimate, not a release approval.
- Production release: blocked. The production gate is fail-closed on missing external credentials and documentary approvals; no production mutation was attempted.
- Why `RUN_COMPLETE` was not reached: `sh scripts/preflight.sh` and `sh scripts/production-readiness-check.sh` both exit 1 at `env var not set: DEEPGRAM_API_KEY`. Hosted provider, CI, staging, DNS, legal, vendor, insurance, data-region, and production-secret evidence is unavailable.

## Verified local evidence

The following commands passed after the continuation changes:

- `sh scripts/lint.sh` -> `lint: ok`
- `sh scripts/format-check.sh` -> `format check: ok`
- `sh scripts/typecheck.sh` -> `typecheck: ok`
- `sh scripts/test-unit.sh` -> `unit tests: ok` (12 files, 33 tests)
- `sh scripts/test-integration.sh` -> `integration tests: ok` (4 files, 7 tests)
- `sh scripts/test-e2e.sh` -> `e2e tests: ok` (3 files, 7 tests)
- `sh scripts/build.sh` -> `build: ok`
- `sh scripts/security-check.sh` -> `security check: ok`
- `sh scripts/dependency-audit.sh` -> `dependency audit: ok`
- `sh scripts/reality-gate.sh` -> `reality gate: ok`
- `sh scripts/smoke-test.sh` -> `smoke test: ok`
- `sh scripts/live-fire.sh` -> `live-fire: ok`; all sixteen proof names passed against real local services, including the authenticated DeepSeek cache/provenance proof.
- `docker build --target runtime --build-arg SERVICE=api --tag ai-family-historian:local-verify .` -> image build passed; image digest observed as `sha256:75a829fb79ae6e9a2cf97c667987a3319e358269e9246e5c42b6a4580c903159`.
- `docker compose config --quiet` -> passed.
- `sh scripts/local-services-check.sh` -> `local services: ok`.

## Subsystem status

| Subsystem | Status | Completed behavior | Tests passing | External verification remaining | Known risks |
|---|---|---|---|---|---|
| Repository/toolchain | Engineering complete locally | Pinned Node/pnpm workspace, migrations, scripts, CI definition, formatting and type gates | All local gates above | Hosted CI runner | Remote CI secrets and runner policy are unverified |
| Domain and persistence | Engineering complete locally | Tenant-scoped PostgreSQL, RLS, idempotency, immutable originals, evidence-linked facts, consent, rights, deletion, publication hashes | Database integration, unit invariants, archive-membership and deletion proofs | Neon/Upstash/R2 hosted probes; backup restore | Full production schema scale and restore drill remain unproven |
| API and web client | Engineering complete locally | Fastify health/auth/archive routes, idempotent mutations, private-by-default UI workflow | API E2E, web E2E, smoke | Staging URL and browser accessibility/performance audit | Product surface is intentionally bounded relative to the full blueprint |
| Authentication and authorization | Engineering complete locally | Signed sessions, archive permission checks, tenant boundaries, fail-closed visibility/rights checks | Unit, integration, E2E | OAuth/passkey/MFA provider live-fire and production secret injection | Native auth is not a substitute for a completed Better Auth/passkey rollout |
| AI gateway | Local and authenticated nonproduction proof complete | DeepSeek adapter, policy/DLP, prompt canonicalization, structured output, provenance, usage/cache telemetry, disablement behavior | Unit, contract, authenticated DeepSeek live-fire | Production key/vendor approval and hosted retention/location evidence | Current development key must be rotated before production |
| Transcription/narration/email/billing providers | Adapter engineering complete | Deepgram, ElevenLabs, Resend, Stripe, Turnstile HTTP adapters with bounded retries, validation, signature checks, and local protocol tests; local billing/quota domain | Provider local HTTP contract tests and all sixteen local live-fire proofs | Authenticated sandbox probes, signed webhook delivery, vendor approvals | No external delivery or payment effect was fabricated |
| Documents and exports | Local implementation complete | Portable JSONL/CSV manifest, deterministic text-first PDF, EPUB package, fixity hashes, explicit-marker candidate extraction with source offsets and human-confirmation status | Unit and `book-pdf-epub`/`portable-export`/`evidence-extraction` live-fire | Accessible-PDF/EPUB audit and restore from a 25 GB archive | Advanced layout, media embedding, automatic NLP extraction, and formal accessibility audit remain |
| Observability/operations | Local implementation complete | Redacted structured telemetry, metric samples, OTel local sink, incident/runbook guidance | Unit, local collector and reality gates | Hosted Sentry/OTLP, backup/restore and alert paging | Restore and quarterly preservation drills remain operator-owned |
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
| Application production secrets | `SESSION_SECRET`, `FIELD_ENCRYPTION_MASTER_KEY`, `DOWNLOAD_SIGNING_SECRET` | Presence check in `sh scripts/preflight.sh` | production secret-manager injection plus readiness check | Yes |
| Legal/vendor/insurance/DPIA/retention | `LEGAL_APPROVAL_FILE`, `VENDOR_RISK_APPROVAL_FILE`, `INSURANCE_EVIDENCE_FILE`, `DPIA_APPROVAL_FILE`, `RETENTION_APPROVAL_FILE` | File-presence gates in `sh scripts/preflight.sh` | `sh scripts/production-readiness-check.sh` | Yes |
| Data region and data-broker determinations | `compliance/evidence/data-region-verification.md`, `compliance/evidence/data-broker-determination.md` | `sh scripts/production-readiness-check.sh` | same command after signed artifacts exist | Yes |

## Commands to resume

Run from `C:\dev\AIFamilyHistorian` using the installed Git POSIX shell on Windows:

```text
set PATH=C:\Program Files\Git\usr\bin;C:\Program Files\Git\cmd;%PATH%
cd /d C:\dev\AIFamilyHistorian
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

- Hosted transcription, narration, email, billing, abuse-prevention, telemetry, R2, CI, and Fly behavior is not live-fire verified.
- Full backup/restore, 25 GB resumable export, media parser isolation, FFmpeg/OCR/ClamAV, k6 performance, and formal WCAG/PDF/EPUB audits remain unproven.
- Native session signing is implemented, but passkeys/TOTP/recovery/device-management requirements need a dedicated production rollout and live verification.
- The product surface is a bounded modular-monolith foundation, not a claim that every blueprint UI and worker feature is complete; extraction intentionally accepts explicit source markers only and does not auto-confirm facts.
- Legal, insurance, vendor, data-region, and policy approvals are not engineering artifacts and remain fail-closed.

## Final operator checklist

1. Supply and probe `DEEPGRAM_API_KEY`; rerun `sh scripts/preflight.sh`.
2. Supply real R2, Stripe, Resend, Turnstile, Sentry/OTLP, GitHub, and Fly credentials; run each named probe and the full verify gate.
3. Obtain and place the signed legal/vendor/insurance/DPIA/retention/data-region/data-broker artifacts outside Git; rerun production readiness.
4. Run the GitHub release workflow, deploy staging, run health/live-fire smoke, and complete a restore and rollback drill.
5. Rotate the local development DeepSeek key and inject production-scoped secrets only after vendor approval.
6. Run the documented manual production deploy command only after every production-readiness sentinel and approval is genuine.
