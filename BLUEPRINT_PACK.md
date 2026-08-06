=== FILE: PREFLIGHT.md ===
# PREFLIGHT - AI Family Historian

This is the only interactive preparation step. Obtain every REQUIRED item, copy .env.example to .env, and run `sh scripts/preflight.sh` until `preflight: ok`. Production launch remains blocked by the documentary approvals listed below even when technical probes pass.

## Credentials and approvals

| Service or evidence | Purpose | Variables or artifact | Minimum scope | Cost | Probe or gate |
|---|---|---|---|---|---|
| Neon PostgreSQL | All persistence and real integration tests | DATABASE_URL | Dedicated nonproduction database owner for setup; runtime least-privilege user later | Paid or free tier | scripts/probes/database_url.sh |
| Upstash Redis | Queues, locks, limits, exact-result cache | REDIS_URL | One isolated database | Paid or free tier | scripts/probes/redis_url.sh |
| Cloudflare R2 | Originals, derivatives, exports | R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT | Object read/write/delete only for project bucket | Usage based | scripts/probes/r2.sh |
| DeepSeek | Interview planning and editorial generation | DEEPSEEK_API_KEY | API inference only | Usage based | scripts/probes/deepseek_api_key.sh |
| Deepgram | Primary transcription | DEEPGRAM_API_KEY | Speech-to-text only | Usage based | scripts/probes/deepgram_api_key.sh |
| ElevenLabs | Optional stock narration and verified self-voice | ELEVENLABS_API_KEY | Text-to-speech and permitted voice endpoints only | Usage based | scripts/probes/elevenlabs_api_key.sh |
| Stripe | Billing live-fire | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID | Test mode during build | Usage based | scripts/probes/stripe.sh |
| Resend | Invitations and job notices | RESEND_API_KEY, EMAIL_FROM | Sending domain only | Usage based | scripts/probes/resend.sh |
| Cloudflare Turnstile | Abuse prevention | TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY | One site | Free | scripts/probes/turnstile.sh |
| Sentry | Redacted errors | SENTRY_DSN, SENTRY_AUTH_TOKEN | Project event ingest and release upload | Paid or free tier | scripts/probes/sentry.sh |
| OpenTelemetry | Metrics and traces | OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS | Dedicated project ingest | Provider dependent | scripts/probes/otel.sh |
| GitHub | CI and container registry | GITHUB_TOKEN, GITHUB_REPOSITORY | Repository and packages scopes only | Plan dependent | scripts/probes/github.sh |
| Fly.io | Staging and production runtime | FLY_API_TOKEN, FLY_APP_STAGING, FLY_APP_PRODUCTION | Deploy only to named apps | Usage based | scripts/probes/fly.sh |
| Application secrets | Sessions, encryption, webhook state | SESSION_SECRET, FIELD_ENCRYPTION_MASTER_KEY, DOWNLOAD_SIGNING_SECRET | Random values generated locally | None | Presence only |
| Legal launch evidence | Privacy, Terms, recording consent, releases, voice, likeness, copyright, minors, defamation review | LEGAL_APPROVAL_FILE | Signed approval artifact | Professional fee | production-readiness gate |
| Vendor-risk evidence | DeepSeek, Deepgram, ElevenLabs, R2, Neon, Upstash, Sentry and print provider data-flow decisions | VENDOR_RISK_APPROVAL_FILE | Approved and current | Internal/professional | production-readiness gate |
| Insurance evidence | Cyber, technology E&O, and media liability | INSURANCE_EVIDENCE_FILE | Active policy evidence | Paid | production-readiness gate |
| DPIA and retention | Approved data map, DPIA, retention schedule, subprocessor list | DPIA_APPROVAL_FILE, RETENTION_APPROVAL_FILE | Approved artifacts | Internal/professional | production-readiness gate |

Local tools required: git, awk, grep, sed, curl, jq, node 24, pnpm 10 through Corepack, Docker, PostgreSQL client 17, ffmpeg, ffprobe, exiftool, convert or magick, clamscan, OCRmyPDF, and Python 3.12 for local media utilities.

PREFLIGHT-TABLE-BEGIN
DATABASE_URL|REQUIRED|scripts/probes/database_url.sh
REDIS_URL|REQUIRED|scripts/probes/redis_url.sh
R2_ACCOUNT_ID|REQUIRED|-
R2_ACCESS_KEY_ID|REQUIRED|-
R2_SECRET_ACCESS_KEY|REQUIRED|scripts/probes/r2.sh
R2_BUCKET|REQUIRED|-
R2_ENDPOINT|REQUIRED|-
DEEPSEEK_API_KEY|REQUIRED|scripts/probes/deepseek_api_key.sh
DEEPGRAM_API_KEY|REQUIRED|scripts/probes/deepgram_api_key.sh
ELEVENLABS_API_KEY|OPTIONAL|scripts/probes/elevenlabs_api_key.sh
STRIPE_SECRET_KEY|REQUIRED|scripts/probes/stripe.sh
STRIPE_WEBHOOK_SECRET|REQUIRED|-
STRIPE_PRICE_ID|REQUIRED|-
RESEND_API_KEY|REQUIRED|scripts/probes/resend.sh
EMAIL_FROM|REQUIRED|-
TURNSTILE_SITE_KEY|REQUIRED|-
TURNSTILE_SECRET_KEY|REQUIRED|scripts/probes/turnstile.sh
SENTRY_DSN|REQUIRED|scripts/probes/sentry.sh
SENTRY_AUTH_TOKEN|REQUIRED|-
OTEL_EXPORTER_OTLP_ENDPOINT|REQUIRED|scripts/probes/otel.sh
OTEL_EXPORTER_OTLP_HEADERS|OPTIONAL|-
GITHUB_TOKEN|REQUIRED|scripts/probes/github.sh
GITHUB_REPOSITORY|REQUIRED|-
FLY_API_TOKEN|REQUIRED|scripts/probes/fly.sh
FLY_APP_STAGING|REQUIRED|-
FLY_APP_PRODUCTION|REQUIRED|-
SESSION_SECRET|REQUIRED|-
FIELD_ENCRYPTION_MASTER_KEY|REQUIRED|-
DOWNLOAD_SIGNING_SECRET|REQUIRED|-
LEGAL_APPROVAL_FILE|REQUIRED|-
VENDOR_RISK_APPROVAL_FILE|REQUIRED|-
INSURANCE_EVIDENCE_FILE|REQUIRED|-
DPIA_APPROVAL_FILE|REQUIRED|-
RETENTION_APPROVAL_FILE|REQUIRED|-
PREFLIGHT-TABLE-END
=== END FILE ===

=== FILE: .env.example ===
# AI Family Historian environment. Copy to .env and replace every REQUIRED value.
DATABASE_URL=postgresql://family_historian:replace@localhost:5432/family_historian
REDIS_URL=redis://localhost:6379
R2_ACCOUNT_ID=replace
R2_ACCESS_KEY_ID=replace
R2_SECRET_ACCESS_KEY=replace
R2_BUCKET=family-historian-local
R2_ENDPOINT=https://replace.r2.cloudflarestorage.com
DEEPSEEK_API_KEY=replace
DEEPGRAM_API_KEY=replace
ELEVENLABS_API_KEY=
STRIPE_SECRET_KEY=sk_test_replace
STRIPE_WEBHOOK_SECRET=whsec_replace
STRIPE_PRICE_ID=price_replace
RESEND_API_KEY=re_replace
EMAIL_FROM=Family Historian <noreply@example.invalid>
TURNSTILE_SITE_KEY=replace
TURNSTILE_SECRET_KEY=replace
SENTRY_DSN=https://replace@example.invalid/1
SENTRY_AUTH_TOKEN=replace
OTEL_EXPORTER_OTLP_ENDPOINT=https://example.invalid/v1/traces
OTEL_EXPORTER_OTLP_HEADERS=
GITHUB_TOKEN=github_pat_replace
GITHUB_REPOSITORY=owner/family-historian
FLY_API_TOKEN=replace
FLY_APP_STAGING=family-historian-staging
FLY_APP_PRODUCTION=family-historian-production
SESSION_SECRET=replace-with-at-least-32-random-bytes
FIELD_ENCRYPTION_MASTER_KEY=replace-with-32-byte-base64-key
DOWNLOAD_SIGNING_SECRET=replace-with-at-least-32-random-bytes
LEGAL_APPROVAL_FILE=/absolute/path/to/legal-approval.pdf
VENDOR_RISK_APPROVAL_FILE=/absolute/path/to/vendor-risk-approval.pdf
INSURANCE_EVIDENCE_FILE=/absolute/path/to/insurance-evidence.pdf
DPIA_APPROVAL_FILE=/absolute/path/to/dpia-approval.pdf
RETENTION_APPROVAL_FILE=/absolute/path/to/retention-approval.pdf
=== END FILE ===

=== FILE: .agent/MANIFEST.md ===
# Blueprint Pack Manifest

- `.agent/EXECUTION_RULES.md` - L1 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/GRAPH.md` - L1 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/LOOPS.md` - L1 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/MANIFEST.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/PLANS.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/adapters/RECIPE.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/checklists/agent-readiness.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/checklists/final-review.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/checklists/implementation.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/checklists/incident-response.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/checklists/preflight.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/checklists/production-readiness.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/checklists/release.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/checklists/rollback.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/checklists/validation.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-000-discovery-and-toolchain.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-001-foundation.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-002-core-domain.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-003-data-and-persistence.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-004-api-or-service-layer.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-005-user-interface-or-client.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-006-auth-security-and-permissions.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-007-testing-hardening.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-008-observability-and-operations.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-009-deployment-and-release.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/execplans/EP-010-production-readiness-and-ship.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/prompts/continue-execplan.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/prompts/debug-validation-failure.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/prompts/execute-active-execplan.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/prompts/final-review.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/prompts/run-graph.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/reality-allow` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/reality-patterns` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/specs/SPEC-000-product-scope.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/specs/SPEC-001-core-domain.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/specs/SPEC-002-data-model.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/specs/SPEC-003-api-contracts.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/specs/SPEC-004-ui-ux-behavior.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/specs/SPEC-005-auth-and-permissions.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/specs/SPEC-006-error-handling.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/specs/SPEC-007-observability.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/specs/SPEC-008-production-readiness.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/state/LEDGER.md` - L6 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/templates/adr-template.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/templates/execplan-template.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/templates/runbook-template.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/templates/spec-template.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.agent/templates/test-case-template.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.env.example` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `.gitignore` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `AGENTS.md` - L1 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `AI_PROCESSING_NOTICE.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `ARCHITECTURE.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `ASSUMPTIONS.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `BLUEPRINT_INPUT.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `CLAUDE.md` - L1 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `COMMANDS.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `CONTRIBUTING.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `CONTRIBUTOR_RELEASE_TEMPLATE.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `COPYRIGHT_AND_TAKEDOWN_POLICY.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `DATA_PROCESSING_ADDENDUM_TEMPLATE.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `DATA_RETENTION_SCHEDULE.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `DECISIONS.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `DEPLOYMENT.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `DPIA.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `EDITORIAL_ETHICS_POLICY.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `ENVIRONMENT.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `HERMES.md` - L1 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `HOW_TO_USE.md` - L4 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `INCIDENT_RESPONSE_PLAN.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `MEDIA_PROVENANCE_POLICY.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `MINOR_CONTENT_POLICY.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `OBSERVABILITY.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `OPENCLAW.md` - L1 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `OPERATIONS.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `PREFLIGHT.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `PRIVACY_POLICY_DRAFT.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `PRODUCTION_READINESS.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `PROJECT_BRIEF.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `PUBLICATION_APPROVAL_TEMPLATE.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `RECORDING_AND_INTERVIEW_CONSENT.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `RELEASE.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `ROADMAP.md` - L3 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `ROLLBACK.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `SECURITY.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `SUBPROCESSOR_REGISTER.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `TERMS_OF_SERVICE_DRAFT.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `TESTING.md` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `VOICE_AND_LIKENESS_POLICY.md` - L2 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/build.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/dependency-audit.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/format-check.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/graph-next.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/install.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/ledger.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/lint.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/live-fire.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/preflight.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/database_url.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/deepgram_api_key.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/deepseek_api_key.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/elevenlabs_api_key.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/fly.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/github.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/otel.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/r2.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/redis_url.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/resend.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/sentry.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/stripe.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/turnstile.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/probes/twilio.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/production-readiness-check.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/reality-gate.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/security-check.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/smoke-test.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/test-e2e.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/test-integration.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/test-unit.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/typecheck.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.
- `scripts/verify.sh` - L5 - Project blueprint, control, specification, execution, verification, legal, or operational artifact.

TOTAL FILES: 122
=== END FILE ===

=== FILE: AGENTS.md ===
# Family Historian 6LAYER Control Plane

## 1. Mission
Build and prove a privacy-first family memory preservation SaaS that organizes verified life information, protects sensitive records, isolates optional AI processing, and produces trustworthy emergency and executor-preparation outputs without crossing into legal, medical, tax, financial-advisory, fiduciary, or secret-custody functions.

## 2. THE BOOT SEQUENCE
PRIME-BLOCK-BEGIN
This repository is governed by a 6LAYER blueprint pack. AGENTS.md is the authoritative control plane; if anything here conflicts with AGENTS.md, AGENTS.md wins.
On every session start, execute THE BOOT SEQUENCE:
1. Read AGENTS.md fully. 2. Read COMMANDS.md. 3. Read .agent/GRAPH.md and .agent/LOOPS.md. 4. Run: sh scripts/ledger.sh tail 30. 5. Run: sh scripts/preflight.sh -- it MUST print "preflight: ok"; if it fails, report the exact missing items from PREFLIGHT.md and stop (this is the only legitimate pre-run stop). 6. Run: sh scripts/graph-next.sh and dispatch on its one-line output exactly as .agent/GRAPH.md specifies. 7. Repeat step 6 after every completed node until ALL_DONE, then run the ship gate in AGENTS.md.
Hard rules: do not ask the user questions; choose the smallest reversible option, record it, continue. Use only commands from COMMANDS.md. Never invent an API, route, table, flag, or env var -- verify in-repo or transcribe from the pack. One node at a time; milestones in order; commit after every milestone; append ledger events as .agent/LOOPS.md requires. Bounded retries per .agent/LOOPS.md -- never repeat a failed fix. No mocks, stubs, demo modes, or placeholder code in production paths; scripts/reality-gate.sh and scripts/live-fire.sh must genuinely pass. Never weaken a gate, skip a test, or claim an unrun result. Stop only at NODE_BLOCKED (with the full evidence report) or ALL_DONE.
PRIME-BLOCK-END

## 3. Source-of-truth hierarchy
Current explicit user instruction wins, followed by L1 control, L2 specification, L3 graph, L4 execution, repository code and tests, L5 gate output as observed fact, and L6 state as history. A lower layer may not contradict a higher layer.

## 4. Graph protocol
One node equals one ExecPlan. Only one node may hold a lease. Run `sh scripts/graph-next.sh` for every dispatch. A node is done only after all milestones pass, node verify emits its sentinel, expected files match, NODE_DONE is appended, and the green tag exists. Commit every milestone. Never cross a completed green tag during rollback.

## 5. STOP conditions
Stop only when: preflight fails before the run; an action would destroy user or production data or cause an irreversible external side effect not explicitly specified; a legal, financial, or security judgment is unanswered by the specs; NODE_BLOCKED follows the full bounded ladder with evidence; or production deploy is reached because auto-deploy is not authorized. Do not ask the user for next steps, preferences, or confirmation. Proceed.

## 6. Anti-drift
At each milestone read the milestone, its non-goals, and ledger tail. Change only listed paths. Revert unapproved paths. Do not perform broad refactors, dependency swaps, reorganizations, or unrelated cleanup.

## 7. Anti-hallucination
Never invent APIs, commands, variables, tables, routes, fields, flags, or provider promises. Transcribe supplied content or verify repository evidence. DeepSeek retention, training, location, and deletion representations require archived current evidence and counsel approval.

## 8. Anti-fixation
Use the bounded verify-fix ladder in `.agent/LOOPS.md`. Never repeat a failed fix. Isolate on the second identical signature, take the declared fallback on the third, rollback after fallback exhaustion, then block.

## 9. Reality law
Software that appears to work is a failure state. Only software proven by live-fire counts. Production paths contain no mocks, stubs, demo modes, sample data presented as real, skipped gates, or success without effect.

## 10. Dependencies
Prefer existing pinned dependencies. Add only when required by a spec. Pin exact versions, update the lockfile and documentation, run audits, and record the decision.

## 11. Files and commits
Create files exactly as plans prescribe. Commit after each milestone using `[EP-XXX][Mk] imperative summary`. Keep the worktree clean between milestones.

## 12. Testing
Follow TESTING.md. A gate may never be weakened to make code pass. Test doubles exist only in enumerated test zones; live-fire uses real dependencies.

## 13. Documentation edits
L1 is immutable during a run. L2 and L3 require evidence-backed spec update and decision entry. Only ExecPlan progress regions in L4 are mutable. L5 gates may not weaken. L6 ledger is append-only.

## 14. Security
Follow SECURITY.md. Never place customer secrets, raw sensitive payloads, access tokens, or unredacted LLM content in logs, tickets, analytics, traces, or model prompts.

## 15. Definition of done
A node requires milestones, verify sentinel, expected-files audit, NODE_DONE, and green tag. The run requires fresh verify, production readiness, release tag, manual deploy instruction, and RUN_COMPLETE.

## 16. Final response
Report nodes completed, expected versus changed files, commands and observed sentinels, acceptance criteria, decisions, assumption changes, remaining risks, and ship-gate status.
=== END FILE ===

=== FILE: CLAUDE.md ===
# Claude Code Adapter

PRIME-BLOCK-BEGIN
This repository is governed by a 6LAYER blueprint pack. AGENTS.md is the authoritative control plane; if anything here conflicts with AGENTS.md, AGENTS.md wins.
On every session start, execute THE BOOT SEQUENCE:
1. Read AGENTS.md fully. 2. Read COMMANDS.md. 3. Read .agent/GRAPH.md and .agent/LOOPS.md. 4. Run: sh scripts/ledger.sh tail 30. 5. Run: sh scripts/preflight.sh -- it MUST print "preflight: ok"; if it fails, report the exact missing items from PREFLIGHT.md and stop (this is the only legitimate pre-run stop). 6. Run: sh scripts/graph-next.sh and dispatch on its one-line output exactly as .agent/GRAPH.md specifies. 7. Repeat step 6 after every completed node until ALL_DONE, then run the ship gate in AGENTS.md.
Hard rules: do not ask the user questions; choose the smallest reversible option, record it, continue. Use only commands from COMMANDS.md. Never invent an API, route, table, flag, or env var -- verify in-repo or transcribe from the pack. One node at a time; milestones in order; commit after every milestone; append ledger events as .agent/LOOPS.md requires. Bounded retries per .agent/LOOPS.md -- never repeat a failed fix. No mocks, stubs, demo modes, or placeholder code in production paths; scripts/reality-gate.sh and scripts/live-fire.sh must genuinely pass. Never weaken a gate, skip a test, or claim an unrun result. Stop only at NODE_BLOCKED (with the full evidence report) or ALL_DONE.
PRIME-BLOCK-END
=== END FILE ===

=== FILE: HERMES.md ===
# Hermes Adapter

PRIME-BLOCK-BEGIN
This repository is governed by a 6LAYER blueprint pack. AGENTS.md is the authoritative control plane; if anything here conflicts with AGENTS.md, AGENTS.md wins.
On every session start, execute THE BOOT SEQUENCE:
1. Read AGENTS.md fully. 2. Read COMMANDS.md. 3. Read .agent/GRAPH.md and .agent/LOOPS.md. 4. Run: sh scripts/ledger.sh tail 30. 5. Run: sh scripts/preflight.sh -- it MUST print "preflight: ok"; if it fails, report the exact missing items from PREFLIGHT.md and stop (this is the only legitimate pre-run stop). 6. Run: sh scripts/graph-next.sh and dispatch on its one-line output exactly as .agent/GRAPH.md specifies. 7. Repeat step 6 after every completed node until ALL_DONE, then run the ship gate in AGENTS.md.
Hard rules: do not ask the user questions; choose the smallest reversible option, record it, continue. Use only commands from COMMANDS.md. Never invent an API, route, table, flag, or env var -- verify in-repo or transcribe from the pack. One node at a time; milestones in order; commit after every milestone; append ledger events as .agent/LOOPS.md requires. Bounded retries per .agent/LOOPS.md -- never repeat a failed fix. No mocks, stubs, demo modes, or placeholder code in production paths; scripts/reality-gate.sh and scripts/live-fire.sh must genuinely pass. Never weaken a gate, skip a test, or claim an unrun result. Stop only at NODE_BLOCKED (with the full evidence report) or ALL_DONE.
PRIME-BLOCK-END
=== END FILE ===

=== FILE: OPENCLAW.md ===
# OpenClaw Adapter

PRIME-BLOCK-BEGIN
This repository is governed by a 6LAYER blueprint pack. AGENTS.md is the authoritative control plane; if anything here conflicts with AGENTS.md, AGENTS.md wins.
On every session start, execute THE BOOT SEQUENCE:
1. Read AGENTS.md fully. 2. Read COMMANDS.md. 3. Read .agent/GRAPH.md and .agent/LOOPS.md. 4. Run: sh scripts/ledger.sh tail 30. 5. Run: sh scripts/preflight.sh -- it MUST print "preflight: ok"; if it fails, report the exact missing items from PREFLIGHT.md and stop (this is the only legitimate pre-run stop). 6. Run: sh scripts/graph-next.sh and dispatch on its one-line output exactly as .agent/GRAPH.md specifies. 7. Repeat step 6 after every completed node until ALL_DONE, then run the ship gate in AGENTS.md.
Hard rules: do not ask the user questions; choose the smallest reversible option, record it, continue. Use only commands from COMMANDS.md. Never invent an API, route, table, flag, or env var -- verify in-repo or transcribe from the pack. One node at a time; milestones in order; commit after every milestone; append ledger events as .agent/LOOPS.md requires. Bounded retries per .agent/LOOPS.md -- never repeat a failed fix. No mocks, stubs, demo modes, or placeholder code in production paths; scripts/reality-gate.sh and scripts/live-fire.sh must genuinely pass. Never weaken a gate, skip a test, or claim an unrun result. Stop only at NODE_BLOCKED (with the full evidence report) or ALL_DONE.
PRIME-BLOCK-END
=== END FILE ===

=== FILE: .agent/adapters/RECIPE.md ===
# Adapter Recipe
1. Find the platform's standing-instruction file.
2. Place this block there byte-for-byte and add only one platform-name line outside it.

PRIME-BLOCK-BEGIN
This repository is governed by a 6LAYER blueprint pack. AGENTS.md is the authoritative control plane; if anything here conflicts with AGENTS.md, AGENTS.md wins.
On every session start, execute THE BOOT SEQUENCE:
1. Read AGENTS.md fully. 2. Read COMMANDS.md. 3. Read .agent/GRAPH.md and .agent/LOOPS.md. 4. Run: sh scripts/ledger.sh tail 30. 5. Run: sh scripts/preflight.sh -- it MUST print "preflight: ok"; if it fails, report the exact missing items from PREFLIGHT.md and stop (this is the only legitimate pre-run stop). 6. Run: sh scripts/graph-next.sh and dispatch on its one-line output exactly as .agent/GRAPH.md specifies. 7. Repeat step 6 after every completed node until ALL_DONE, then run the ship gate in AGENTS.md.
Hard rules: do not ask the user questions; choose the smallest reversible option, record it, continue. Use only commands from COMMANDS.md. Never invent an API, route, table, flag, or env var -- verify in-repo or transcribe from the pack. One node at a time; milestones in order; commit after every milestone; append ledger events as .agent/LOOPS.md requires. Bounded retries per .agent/LOOPS.md -- never repeat a failed fix. No mocks, stubs, demo modes, or placeholder code in production paths; scripts/reality-gate.sh and scripts/live-fire.sh must genuinely pass. Never weaken a gate, skip a test, or claim an unrun result. Stop only at NODE_BLOCKED (with the full evidence report) or ALL_DONE.
PRIME-BLOCK-END
=== END FILE ===

=== FILE: COMMANDS.md ===
# Commands

Export `CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive`. Legal commands are `sh scripts/install.sh`, `preflight.sh`, `lint.sh`, `format-check.sh`, `typecheck.sh`, `test-unit.sh`, `test-integration.sh`, `test-e2e.sh`, `build.sh`, `security-check.sh`, `dependency-audit.sh`, `smoke-test.sh`, `live-fire.sh`, `verify.sh`, and `production-readiness-check.sh`. Local start: `pnpm --filter @legacy/api start >.agent/state/api.log 2>&1 & echo $! >.agent/state/api.pid`; probe with curl and kill using the PID file. Adapter parity: `for f in AGENTS.md CLAUDE.md HERMES.md OPENCLAW.md; do awk '/PRIME-BLOCK-BEGIN/,/PRIME-BLOCK-END/' "$f" | cksum; done`. Coding agents must not invent commands. If a command is missing or stale, update this file first, citing repository evidence, with a Decision Log entry.
=== END FILE ===

=== FILE: .agent/GRAPH.md ===
# Execution Graph

One node is one bounded ExecPlan. The ledger determines state. At most one LEASE may be live. Commit every milestone and create `green/EP-XXX` only after the node verify sentinel and expected-files audit pass.

GRAPH-TABLE-BEGIN
NODE EP-000 DEPS -
NODE EP-001 DEPS EP-000
NODE EP-002 DEPS EP-001
NODE EP-003 DEPS EP-002
NODE EP-004 DEPS EP-003
NODE EP-005 DEPS EP-004
NODE EP-006 DEPS EP-004
NODE EP-007 DEPS EP-005,EP-006
NODE EP-008 DEPS EP-007
NODE EP-009 DEPS EP-008
NODE EP-010 DEPS EP-009
GRAPH-TABLE-END

Dispatch: NEXT leases and executes. RESUME continues an open lease or takes over only after 90 minutes of inactivity. BLOCKED halts. STALL becomes GRAPH_STALL and halts. ALL_DONE runs the ship gate.

The arc moves from evidence and toolchain through foundation, domain, persistence, service, client and security branches, hardening, operations, deployment, and final ship proof.
=== END FILE ===

=== FILE: .agent/LOOPS.md ===
# Bounded Execution Loops

## Run loop
Run `sh scripts/graph-next.sh`, dispatch exactly, and repeat until BLOCKED or ALL_DONE. Node count is finite.

## Node loop
Lease one node, execute milestones in order, verify, audit expected files, append NODE_DONE, create the green tag, and release.

## Milestone ladder
Maximum six total attempts unless the plan declares another cap. Normalize the first error line as a signature and append SIG. First same-signature failure: one hypothesis and smallest fix. Second: isolate with a narrower diagnostic before editing. Third: take the declared real fallback. If fallback exhausts three attempts or total cap is reached: rollback to the last checkpoint and attempt fallback once from clean state. Final failure: append NODE_BLOCKED with command output, exit codes, signatures, hypotheses, diffs, smallest human decision, and recommended default.

The same fix may never be applied twice. A new signature resets the rung but not the total cap.

## Readiness
Probe background services at most 30 times with two-second sleeps, record PID or container ID, and define teardown. Exhaustion becomes READINESS_TIMEOUT_<service>.

## Watchdogs
Identical command and output three times forces a rung climb. Ten actions without a ledger append require HEARTBEAT. After every milestone inspect git status and changed paths; revert paths outside CHANGE unless a prior decision permits them. Exceeding a milestone budget becomes BUDGET_EXCEEDED and enters rung three.

## Re-grounding
At every milestone read its block, node non-goals, and `sh scripts/ledger.sh tail 15`.

## Non-interactive mandate
Export `CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive`. Editors, pagers, foreground watch modes, credential prompts, and destructive interactive commands are forbidden.
=== END FILE ===

=== FILE: .agent/state/LEDGER.md ===
2026-08-05T17:13:10Z | forge | - | RUN_INIT | pack generated
=== END FILE ===

=== FILE: .agent/EXECUTION_RULES.md ===
# Execution Rules

One active node. Boot every session. Use only COMMANDS.md. Re-ground every milestone. Evidence before edits and done. No hidden context, drift, broad refactor, repeated fix, mock production path, or gate weakening. Append ledger events and commit milestones. Stop only under AGENTS.md.
=== END FILE ===

=== FILE: .agent/PLANS.md ===
# ExecPlan Standard

An ExecPlan is self-contained. It contains machine header, purpose, scope, non-goals, context, files, contracts, milestones with GOAL READ CHANGE CONTENT RUN EXPECT EVIDENCE FALLBACK COMMIT, validation, recovery, progress, discoveries, decision log, and retrospective.
=== END FILE ===

=== FILE: .agent/checklists/agent-readiness.md ===
# Agent Readiness Checklist
- [ ] Read AGENTS.md and the active ExecPlan.
- [ ] Run `sh scripts/preflight.sh` and observe `preflight: ok`.
- [ ] Run `sh scripts/ledger.sh tail 30`.
- [ ] Confirm changed paths match the active milestone.
- [ ] Run the active milestone commands and record exact sentinels.
- [ ] Review SECURITY.md and privacy controls affected by the change.
- [ ] Commit with the required node and milestone format.
=== END FILE ===

=== FILE: .agent/checklists/final-review.md ===
# Final Review Checklist
- [ ] Read AGENTS.md and the active ExecPlan.
- [ ] Run `sh scripts/preflight.sh` and observe `preflight: ok`.
- [ ] Run `sh scripts/ledger.sh tail 30`.
- [ ] Confirm changed paths match the active milestone.
- [ ] Run the active milestone commands and record exact sentinels.
- [ ] Review SECURITY.md and privacy controls affected by the change.
- [ ] Commit with the required node and milestone format.
=== END FILE ===

=== FILE: .agent/checklists/implementation.md ===
# Implementation Checklist
- [ ] Read AGENTS.md and the active ExecPlan.
- [ ] Run `sh scripts/preflight.sh` and observe `preflight: ok`.
- [ ] Run `sh scripts/ledger.sh tail 30`.
- [ ] Confirm changed paths match the active milestone.
- [ ] Run the active milestone commands and record exact sentinels.
- [ ] Review SECURITY.md and privacy controls affected by the change.
- [ ] Commit with the required node and milestone format.
=== END FILE ===

=== FILE: .agent/checklists/incident-response.md ===
# Incident Response Checklist
- [ ] Read AGENTS.md and the active ExecPlan.
- [ ] Run `sh scripts/preflight.sh` and observe `preflight: ok`.
- [ ] Run `sh scripts/ledger.sh tail 30`.
- [ ] Confirm changed paths match the active milestone.
- [ ] Run the active milestone commands and record exact sentinels.
- [ ] Review SECURITY.md and privacy controls affected by the change.
- [ ] Commit with the required node and milestone format.
=== END FILE ===

=== FILE: .agent/checklists/preflight.md ===
# Preflight Checklist
- [ ] Read AGENTS.md and the active ExecPlan.
- [ ] Run `sh scripts/preflight.sh` and observe `preflight: ok`.
- [ ] Run `sh scripts/ledger.sh tail 30`.
- [ ] Confirm changed paths match the active milestone.
- [ ] Run the active milestone commands and record exact sentinels.
- [ ] Review SECURITY.md and privacy controls affected by the change.
- [ ] Commit with the required node and milestone format.
=== END FILE ===

=== FILE: .agent/checklists/production-readiness.md ===
# Production Readiness Checklist
- [ ] Read AGENTS.md and the active ExecPlan.
- [ ] Run `sh scripts/preflight.sh` and observe `preflight: ok`.
- [ ] Run `sh scripts/ledger.sh tail 30`.
- [ ] Confirm changed paths match the active milestone.
- [ ] Run the active milestone commands and record exact sentinels.
- [ ] Review SECURITY.md and privacy controls affected by the change.
- [ ] Commit with the required node and milestone format.
=== END FILE ===

=== FILE: .agent/checklists/release.md ===
# Release Checklist
- [ ] Read AGENTS.md and the active ExecPlan.
- [ ] Run `sh scripts/preflight.sh` and observe `preflight: ok`.
- [ ] Run `sh scripts/ledger.sh tail 30`.
- [ ] Confirm changed paths match the active milestone.
- [ ] Run the active milestone commands and record exact sentinels.
- [ ] Review SECURITY.md and privacy controls affected by the change.
- [ ] Commit with the required node and milestone format.
=== END FILE ===

=== FILE: .agent/checklists/rollback.md ===
# Rollback Checklist
- [ ] Read AGENTS.md and the active ExecPlan.
- [ ] Run `sh scripts/preflight.sh` and observe `preflight: ok`.
- [ ] Run `sh scripts/ledger.sh tail 30`.
- [ ] Confirm changed paths match the active milestone.
- [ ] Run the active milestone commands and record exact sentinels.
- [ ] Review SECURITY.md and privacy controls affected by the change.
- [ ] Commit with the required node and milestone format.
=== END FILE ===

=== FILE: .agent/checklists/validation.md ===
# Validation Checklist
- [ ] Read AGENTS.md and the active ExecPlan.
- [ ] Run `sh scripts/preflight.sh` and observe `preflight: ok`.
- [ ] Run `sh scripts/ledger.sh tail 30`.
- [ ] Confirm changed paths match the active milestone.
- [ ] Run the active milestone commands and record exact sentinels.
- [ ] Review SECURITY.md and privacy controls affected by the change.
- [ ] Commit with the required node and milestone format.
=== END FILE ===

=== FILE: .agent/execplans/EP-000-discovery-and-toolchain.md ===
NODE-META-BEGIN
ID: EP-000
DEPS: -
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/preflight.sh
VERIFY_SENTINEL: preflight: ok
GREEN_TAG: green/EP-000
NODE-META-END

# 1. Purpose / Big Picture
Verify the greenfield repository, pinned toolchain, provider contracts, media binaries, and every preflight dependency.

# 2. Scope
docs, toolchain checks, provider snapshots, media capability probes, command sentinels.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- PREFLIGHT.md
- ASSUMPTIONS.md
- COMMANDS.md

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: PREFLIGHT.md, ASSUMPTIONS.md, COMMANDS.md.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-000 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-000][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: PREFLIGHT.md, ASSUMPTIONS.md, COMMANDS.md, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/preflight.sh`.
EXPECT: `preflight: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-000 MILESTONE_PASS "M2 preflight: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-000][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/execplans/EP-001-foundation.md ===
NODE-META-BEGIN
ID: EP-001
DEPS: EP-000
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/verify.sh
VERIFY_SENTINEL: verify: ok
GREEN_TAG: green/EP-001
NODE-META-END

# 1. Purpose / Big Picture
Create the monorepo, pinned dependencies, CI, formatting, type safety, test harness, environment validation, and baseline web/API/worker processes.

# 2. Scope
workspace files, apps skeletons, packages skeletons, CI, tests.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- package.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- apps
- packages
- .github/workflows/verify.yml

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: package.json, pnpm-lock.yaml, pnpm-workspace.yaml, apps, packages, .github/workflows/verify.yml.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-001 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-001][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: package.json, pnpm-lock.yaml, pnpm-workspace.yaml, apps, packages, .github/workflows/verify.yml, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/verify.sh`.
EXPECT: `verify: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-001 MILESTONE_PASS "M2 verify: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-001][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/execplans/EP-002-core-domain.md ===
NODE-META-BEGIN
ID: EP-002
DEPS: EP-001
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/verify.sh
VERIFY_SENTINEL: verify: ok
GREEN_TAG: green/EP-002
NODE-META-END

# 1. Purpose / Big Picture
Implement archive, media, transcript, fact, timeline, rights, consent, publication, voice, provenance, and deletion invariants as pure domain logic.

# 2. Scope
packages/domain, packages/contracts, unit tests.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- packages/domain
- packages/contracts
- tests/unit

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: packages/domain, packages/contracts, tests/unit.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-002 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-002][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: packages/domain, packages/contracts, tests/unit, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/verify.sh`.
EXPECT: `verify: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-002 MILESTONE_PASS "M2 verify: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-002][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/execplans/EP-003-data-and-persistence.md ===
NODE-META-BEGIN
ID: EP-003
DEPS: EP-002
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/verify.sh
VERIFY_SENTINEL: verify: ok
GREEN_TAG: green/EP-003
NODE-META-END

# 1. Purpose / Big Picture
Implement PostgreSQL schema, RLS, version history, immutable provenance, multipart object metadata, migrations, repositories, and real database tests.

# 2. Scope
packages/database, packages/storage, migrations, integration tests.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- packages/database
- drizzle
- tests/integration

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: packages/database, drizzle, tests/integration.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-003 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-003][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: packages/database, drizzle, tests/integration, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/verify.sh`.
EXPECT: `verify: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-003 MILESTONE_PASS "M2 verify: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-003][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/execplans/EP-004-api-or-service-layer.md ===
NODE-META-BEGIN
ID: EP-004
DEPS: EP-003
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/verify.sh
VERIFY_SENTINEL: verify: ok
GREEN_TAG: green/EP-004
NODE-META-END

# 1. Purpose / Big Picture
Implement archive, interview, upload, media, transcript, fact, chapter, edition, rights, share, export, privacy, and billing APIs with queues and provider gateways.

# 2. Scope
apps/api, apps/worker, contracts, integration and contract tests.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- apps/api
- apps/worker
- packages/ai-gateway
- packages/documents
- packages/reports

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: apps/api, apps/worker, packages/ai-gateway, packages/documents, packages/reports.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-004 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-004][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: apps/api, apps/worker, packages/ai-gateway, packages/documents, packages/reports, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/verify.sh`.
EXPECT: `verify: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-004 MILESTONE_PASS "M2 verify: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-004][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/execplans/EP-005-user-interface-or-client.md ===
NODE-META-BEGIN
ID: EP-005
DEPS: EP-004
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/verify.sh
VERIFY_SENTINEL: verify: ok
GREEN_TAG: green/EP-005
NODE-META-END

# 1. Purpose / Big Picture
Implement the older-adult-friendly archive, recorder, transcript editor, timeline, story editor, publishing studio, rights center, and private portal flows.

# 2. Scope
apps/web, UI packages, accessibility and E2E tests.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- apps/web
- tests/e2e

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: apps/web, tests/e2e.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-005 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-005][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: apps/web, tests/e2e, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/verify.sh`.
EXPECT: `verify: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-005 MILESTONE_PASS "M2 verify: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-005][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/execplans/EP-006-auth-security-and-permissions.md ===
NODE-META-BEGIN
ID: EP-006
DEPS: EP-004
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/verify.sh
VERIFY_SENTINEL: verify: ok
GREEN_TAG: green/EP-006
NODE-META-END

# 1. Purpose / Big Picture
Implement passkeys, MFA, archive roles, item visibility, support JIT, upload hardening, rights gates, voice safety, abuse controls, and immutable audit.

# 2. Scope
auth, permissions, security middleware, audit, security tests.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- packages/auth
- packages/crypto
- packages/audit
- compliance

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: packages/auth, packages/crypto, packages/audit, compliance.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-006 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-006][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: packages/auth, packages/crypto, packages/audit, compliance, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/verify.sh`.
EXPECT: `verify: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-006 MILESTONE_PASS "M2 verify: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-006][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/execplans/EP-007-testing-hardening.md ===
NODE-META-BEGIN
ID: EP-007
DEPS: EP-005,EP-006
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/verify.sh
VERIFY_SENTINEL: verify: ok
GREEN_TAG: green/EP-007
NODE-META-END

# 1. Purpose / Big Picture
Prove all core outcomes, media failure modes, provenance, unsupported-claim rejection, rights withdrawal, deletion, accessibility, and regressions.

# 2. Scope
tests, fixtures, live-fire harness, CI.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- tests
- scripts/live-fire.sh

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: tests, scripts/live-fire.sh.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-007 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-007][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: tests, scripts/live-fire.sh, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/verify.sh`.
EXPECT: `verify: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-007 MILESTONE_PASS "M2 verify: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-007][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/execplans/EP-008-observability-and-operations.md ===
NODE-META-BEGIN
ID: EP-008
DEPS: EP-007
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/verify.sh
VERIFY_SENTINEL: verify: ok
GREEN_TAG: green/EP-008
NODE-META-END

# 1. Purpose / Big Picture
Implement redacted telemetry, queue and media dashboards, cost controls, fixity jobs, backup/restore, preservation review, alerts, and runbooks.

# 2. Scope
observability, operations, scheduled jobs, performance tests.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- packages/observability
- OPERATIONS.md
- OBSERVABILITY.md

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: packages/observability, OPERATIONS.md, OBSERVABILITY.md.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-008 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-008][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: packages/observability, OPERATIONS.md, OBSERVABILITY.md, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/verify.sh`.
EXPECT: `verify: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-008 MILESTONE_PASS "M2 verify: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-008][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/execplans/EP-009-deployment-and-release.md ===
NODE-META-BEGIN
ID: EP-009
DEPS: EP-008
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/verify.sh
VERIFY_SENTINEL: verify: ok
GREEN_TAG: green/EP-009
NODE-META-END

# 1. Purpose / Big Picture
Create immutable build artifacts, staging deployment, migrations, isolated media workers, secret wiring, smoke tests, and a proven rollback drill.

# 2. Scope
infrastructure, workflows, deploy and rollback scripts.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- Dockerfile
- fly.toml
- .github/workflows/release.yml

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: Dockerfile, fly.toml, .github/workflows/release.yml.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-009 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-009][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: Dockerfile, fly.toml, .github/workflows/release.yml, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/verify.sh`.
EXPECT: `verify: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-009 MILESTONE_PASS "M2 verify: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-009][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/execplans/EP-010-production-readiness-and-ship.md ===
NODE-META-BEGIN
ID: EP-010
DEPS: EP-009
MAX_ATTEMPTS_PER_MILESTONE: 6
VERIFY: sh scripts/production-readiness-check.sh
VERIFY_SENTINEL: production readiness: ok
GREEN_TAG: green/EP-010
NODE-META-END

# 1. Purpose / Big Picture
Run every gate from scratch, prove all sixteen live-fire outcomes, complete legal/vendor/rights/privacy/security reviews, tag the release, and emit the manual deploy command.

# 2. Scope
all verification evidence, release tag, final documentation.

# 3. Non-goals
No unrelated refactor, new provider, unauthorized voice cloning, fabricated quotations, model promise, or production deployment.

# 4. Context and Orientation
Read AGENTS.md, ARCHITECTURE.md, SECURITY.md, BLUEPRINT_INPUT.md, and linked specs. Approved source material and evidence-linked records are authoritative. DeepSeek, transcription, narration, and print providers remain isolated, optional where specified, and replaceable.

# 5. Files to Read First
AGENTS.md; COMMANDS.md; .agent/GRAPH.md; .agent/LOOPS.md; ARCHITECTURE.md; SECURITY.md; BLUEPRINT_INPUT.md.

# 6. Expected Changed Files
- PRODUCTION_READINESS.md
- RELEASE.md
- .agent/state/LEDGER.md

# 7. Interfaces and Contracts
Use canonical vocabulary from SPEC-001, SPEC-002, and SPEC-003. No new names without a decision entry.

# 8. Milestones

### M1: Implement bounded scope
GOAL: Produce the node's real implementation and documentation with no production placeholders.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; linked specs.
CHANGE: PRODUCTION_READINESS.md, RELEASE.md, .agent/state/LEDGER.md.
CONTENT: Implement exact behavior required by the linked specs and invariants. For any repo-dependent file, inspect the pinned package API before composition and record evidence.
RUN: `sh scripts/install.sh`; `sh scripts/lint.sh`; `sh scripts/typecheck.sh`.
EXPECT: `install: ok`; `lint: ok`; `typecheck: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-010 MILESTONE_PASS "M1 install: ok lint: ok typecheck: ok"`.
FALLBACK: Reduce internal abstraction while preserving all named behavior and security boundaries.
COMMIT: `git add -A && git commit -m "[EP-010][M1] implement bounded scope"`.

### M2: Prove node behavior
GOAL: Prove the implementation through real tests and the node verify command.
READ: This milestone; Non-goals; `sh scripts/ledger.sh tail 15`; TESTING.md.
CHANGE: PRODUCTION_READINESS.md, RELEASE.md, .agent/state/LEDGER.md, tests.
CONTENT: Add real unit, integration, E2E, security, privacy, or live-fire proof required for this node; no mock of the behavior under test.
RUN: `sh scripts/production-readiness-check.sh`.
EXPECT: `production readiness: ok`.
EVIDENCE: `sh scripts/ledger.sh append <AGENT_ID> EP-010 MILESTONE_PASS "M2 production readiness: ok"`.
FALLBACK: Isolate the failing capability and use the simplest real provider-compatible implementation allowed by the specs.
COMMIT: `git add -A && git commit -m "[EP-010][M2] prove node behavior"`.

# 9. Validation and Acceptance
The verify sentinel is observed in this session, changed paths match this plan, all expected files exist, no reality-gate hit exists, and privacy and security invariants remain true.

# 10. Idempotence and Recovery
Re-enter from the first unchecked milestone after verifying the previous checkpoint. Use green tags and the rollback ladder. Never cross a completed node tag.

# 11. Progress
- [ ] M1 Implement bounded scope
- [ ] M2 Prove node behavior

# 12. Surprises & Discoveries
- None recorded.

# 13. Decision Log
- None recorded.

# 14. Outcomes & Retrospective
- Complete only after NODE_DONE.
=== END FILE ===

=== FILE: .agent/prompts/continue-execplan.md ===
PRIME-BLOCK-BEGIN
This repository is governed by a 6LAYER blueprint pack. AGENTS.md is the authoritative control plane; if anything here conflicts with AGENTS.md, AGENTS.md wins.
On every session start, execute THE BOOT SEQUENCE:
1. Read AGENTS.md fully. 2. Read COMMANDS.md. 3. Read .agent/GRAPH.md and .agent/LOOPS.md. 4. Run: sh scripts/ledger.sh tail 30. 5. Run: sh scripts/preflight.sh -- it MUST print "preflight: ok"; if it fails, report the exact missing items from PREFLIGHT.md and stop (this is the only legitimate pre-run stop). 6. Run: sh scripts/graph-next.sh and dispatch on its one-line output exactly as .agent/GRAPH.md specifies. 7. Repeat step 6 after every completed node until ALL_DONE, then run the ship gate in AGENTS.md.
Hard rules: do not ask the user questions; choose the smallest reversible option, record it, continue. Use only commands from COMMANDS.md. Never invent an API, route, table, flag, or env var -- verify in-repo or transcribe from the pack. One node at a time; milestones in order; commit after every milestone; append ledger events as .agent/LOOPS.md requires. Bounded retries per .agent/LOOPS.md -- never repeat a failed fix. No mocks, stubs, demo modes, or placeholder code in production paths; scripts/reality-gate.sh and scripts/live-fire.sh must genuinely pass. Never weaken a gate, skip a test, or claim an unrun result. Stop only at NODE_BLOCKED (with the full evidence report) or ALL_DONE.
PRIME-BLOCK-END

Read Progress, Surprises, Decision Log, and ledger tail. Resume at the first unchecked milestone after re-verifying the last checked milestone sentinel.
=== END FILE ===

=== FILE: .agent/prompts/debug-validation-failure.md ===
PRIME-BLOCK-BEGIN
This repository is governed by a 6LAYER blueprint pack. AGENTS.md is the authoritative control plane; if anything here conflicts with AGENTS.md, AGENTS.md wins.
On every session start, execute THE BOOT SEQUENCE:
1. Read AGENTS.md fully. 2. Read COMMANDS.md. 3. Read .agent/GRAPH.md and .agent/LOOPS.md. 4. Run: sh scripts/ledger.sh tail 30. 5. Run: sh scripts/preflight.sh -- it MUST print "preflight: ok"; if it fails, report the exact missing items from PREFLIGHT.md and stop (this is the only legitimate pre-run stop). 6. Run: sh scripts/graph-next.sh and dispatch on its one-line output exactly as .agent/GRAPH.md specifies. 7. Repeat step 6 after every completed node until ALL_DONE, then run the ship gate in AGENTS.md.
Hard rules: do not ask the user questions; choose the smallest reversible option, record it, continue. Use only commands from COMMANDS.md. Never invent an API, route, table, flag, or env var -- verify in-repo or transcribe from the pack. One node at a time; milestones in order; commit after every milestone; append ledger events as .agent/LOOPS.md requires. Bounded retries per .agent/LOOPS.md -- never repeat a failed fix. No mocks, stubs, demo modes, or placeholder code in production paths; scripts/reality-gate.sh and scripts/live-fire.sh must genuinely pass. Never weaken a gate, skip a test, or claim an unrun result. Stop only at NODE_BLOCKED (with the full evidence report) or ALL_DONE.
PRIME-BLOCK-END

Apply the bounded signature ladder to the failing command. Record evidence and never repeat a diff.
=== END FILE ===

=== FILE: .agent/prompts/execute-active-execplan.md ===
PRIME-BLOCK-BEGIN
This repository is governed by a 6LAYER blueprint pack. AGENTS.md is the authoritative control plane; if anything here conflicts with AGENTS.md, AGENTS.md wins.
On every session start, execute THE BOOT SEQUENCE:
1. Read AGENTS.md fully. 2. Read COMMANDS.md. 3. Read .agent/GRAPH.md and .agent/LOOPS.md. 4. Run: sh scripts/ledger.sh tail 30. 5. Run: sh scripts/preflight.sh -- it MUST print "preflight: ok"; if it fails, report the exact missing items from PREFLIGHT.md and stop (this is the only legitimate pre-run stop). 6. Run: sh scripts/graph-next.sh and dispatch on its one-line output exactly as .agent/GRAPH.md specifies. 7. Repeat step 6 after every completed node until ALL_DONE, then run the ship gate in AGENTS.md.
Hard rules: do not ask the user questions; choose the smallest reversible option, record it, continue. Use only commands from COMMANDS.md. Never invent an API, route, table, flag, or env var -- verify in-repo or transcribe from the pack. One node at a time; milestones in order; commit after every milestone; append ledger events as .agent/LOOPS.md requires. Bounded retries per .agent/LOOPS.md -- never repeat a failed fix. No mocks, stubs, demo modes, or placeholder code in production paths; scripts/reality-gate.sh and scripts/live-fire.sh must genuinely pass. Never weaken a gate, skip a test, or claim an unrun result. Stop only at NODE_BLOCKED (with the full evidence report) or ALL_DONE.
PRIME-BLOCK-END

Execute the named ExecPlan under all repository laws. Lease it, run milestones in order, verify, audit expected files, tag green, and report evidence.
=== END FILE ===

=== FILE: .agent/prompts/final-review.md ===
PRIME-BLOCK-BEGIN
This repository is governed by a 6LAYER blueprint pack. AGENTS.md is the authoritative control plane; if anything here conflicts with AGENTS.md, AGENTS.md wins.
On every session start, execute THE BOOT SEQUENCE:
1. Read AGENTS.md fully. 2. Read COMMANDS.md. 3. Read .agent/GRAPH.md and .agent/LOOPS.md. 4. Run: sh scripts/ledger.sh tail 30. 5. Run: sh scripts/preflight.sh -- it MUST print "preflight: ok"; if it fails, report the exact missing items from PREFLIGHT.md and stop (this is the only legitimate pre-run stop). 6. Run: sh scripts/graph-next.sh and dispatch on its one-line output exactly as .agent/GRAPH.md specifies. 7. Repeat step 6 after every completed node until ALL_DONE, then run the ship gate in AGENTS.md.
Hard rules: do not ask the user questions; choose the smallest reversible option, record it, continue. Use only commands from COMMANDS.md. Never invent an API, route, table, flag, or env var -- verify in-repo or transcribe from the pack. One node at a time; milestones in order; commit after every milestone; append ledger events as .agent/LOOPS.md requires. Bounded retries per .agent/LOOPS.md -- never repeat a failed fix. No mocks, stubs, demo modes, or placeholder code in production paths; scripts/reality-gate.sh and scripts/live-fire.sh must genuinely pass. Never weaken a gate, skip a test, or claim an unrun result. Stop only at NODE_BLOCKED (with the full evidence report) or ALL_DONE.
PRIME-BLOCK-END

Run verify from scratch, reality gate, live-fire, expected-files audits, acceptance walk, privacy-to-code trace, and production readiness. Report every observed sentinel.
=== END FILE ===

=== FILE: .agent/prompts/run-graph.md ===
PRIME-BLOCK-BEGIN
This repository is governed by a 6LAYER blueprint pack. AGENTS.md is the authoritative control plane; if anything here conflicts with AGENTS.md, AGENTS.md wins.
On every session start, execute THE BOOT SEQUENCE:
1. Read AGENTS.md fully. 2. Read COMMANDS.md. 3. Read .agent/GRAPH.md and .agent/LOOPS.md. 4. Run: sh scripts/ledger.sh tail 30. 5. Run: sh scripts/preflight.sh -- it MUST print "preflight: ok"; if it fails, report the exact missing items from PREFLIGHT.md and stop (this is the only legitimate pre-run stop). 6. Run: sh scripts/graph-next.sh and dispatch on its one-line output exactly as .agent/GRAPH.md specifies. 7. Repeat step 6 after every completed node until ALL_DONE, then run the ship gate in AGENTS.md.
Hard rules: do not ask the user questions; choose the smallest reversible option, record it, continue. Use only commands from COMMANDS.md. Never invent an API, route, table, flag, or env var -- verify in-repo or transcribe from the pack. One node at a time; milestones in order; commit after every milestone; append ledger events as .agent/LOOPS.md requires. Bounded retries per .agent/LOOPS.md -- never repeat a failed fix. No mocks, stubs, demo modes, or placeholder code in production paths; scripts/reality-gate.sh and scripts/live-fire.sh must genuinely pass. Never weaken a gate, skip a test, or claim an unrun result. Stop only at NODE_BLOCKED (with the full evidence report) or ALL_DONE.
PRIME-BLOCK-END

Run the boot sequence now and continue dispatching until ALL_DONE or NODE_BLOCKED. Your session ends only at RUN_COMPLETE or a blocked report.
=== END FILE ===

=== FILE: .agent/reality-allow ===
^__6L_ALLOW_NONE__$
=== END FILE ===

=== FILE: .agent/reality-patterns ===
TODO|FIXME|XXX|HACK
todo!\(|unimplemented!\(|unreachable!\("not
NotImplementedError|raise NotImplemented
not implemented|Not implemented|NOT IMPLEMENTED
PLACEHOLDER|__REPLACE__|CHANGEME|changeme
\{\{[A-Z_]+\}\}
lorem ipsum|Lorem Ipsum
example\.com/api|sk-test-|xxxx-xxxx
=== END FILE ===

=== FILE: .agent/specs/SPEC-000-product-scope.md ===
# Spec 000 Product Scope

The sixteen Core User Outcomes in BLUEPRINT_INPUT.md are the complete launch ship criteria. Features must map to one outcome or an approved operational requirement. The product is private by default, evidence-linked, provenance-preserving, and human-approved. Non-goals are enforceable boundaries.
=== END FILE ===

=== FILE: .agent/specs/SPEC-001-core-domain.md ===
# Spec 001 Core Domain

## Canonical entities
Organization, FamilyArchive, Person, LivingSubject, DeceasedSubject, Membership, Role, PermissionGrant, RecordingSession, ConsentRecord, ContributorRelease, RightsClaim, PublicationApproval, MediaAsset, OriginalObject, DerivativeObject, FixityRecord, Transcript, TranscriptRevision, TranscriptSpan, Speaker, CandidateFact, ConfirmedFact, DisputedClaim, EvidenceLink, Quotation, PersonRelationship, Place, LifeEvent, TimelineEntry, Recipe, Artifact, Theme, StoryPrompt, InterviewPlan, Chapter, ChapterRevision, Edition, BookExport, EpubExport, AudiobookExport, PortalShare, Embargo, VoiceAuthorization, NarrationJob, PrivacyRequest, DeletionJob, ExportJob, AuditEvent, ProvenanceEvent, Subscription, UsageLedger, WorkflowRun.

## Invariants
1. OriginalObject bytes never mutate.
2. Quotation text equals an approved TranscriptSpan or approved document span.
3. ConfirmedFact has at least one EvidenceLink and a confirmer.
4. DisputedClaim can coexist with competing claims.
5. PublicationApproval pins one immutable Edition hash.
6. VoiceAuthorization is valid only for stock licenses or the living subject's verified self-voice.
7. Rights and consent are purpose-specific and revocable for future processing.
8. A generated ChapterRevision records model, prompt, inputs, citations, and approver.
9. Every share and export applies item visibility and living-person restrictions.
10. Deletion is idempotent and produces processor and storage evidence.
=== END FILE ===

=== FILE: .agent/specs/SPEC-002-data-model.md ===
# Spec 002 Data Model and Vocabulary Lock

Canonical tables use snake_case plural names derived from SPEC-001 entities. Primary keys are UUIDv7. Every tenant-scoped table includes organization_id and family_archive_id where applicable. Versioned content uses immutable revision rows and current_revision_id pointers. Restricted text is envelope encrypted. Original media stores only opaque object keys, never public URLs.

Required status enums:
- consent_status: pending, granted, withdrawn, expired, disputed.
- rights_status: pending, verified, restricted, disputed, expired.
- transcript_status: processing, draft, corrected, approved, restricted.
- fact_status: candidate, confirmed, disputed, rejected, superseded.
- edition_status: draft, rights_review, owner_review, approved, generating, ready, withdrawn.
- job_status: queued, running, retryable_failed, terminal_failed, completed, cancelled.
- visibility: owner_only, selected_contributors, family_members, link_recipients, public_approved.

Provenance tables are append-only. RLS policies require matching organization membership and archive permission. Unscoped queries are forbidden. Schema migrations use expand-migrate-contract and include forward, backfill, verification, and rollback instructions.
=== END FILE ===

=== FILE: .agent/specs/SPEC-003-api-contracts.md ===
# Spec 003 API Contracts

Canonical route families:
- /v1/archives
- /v1/archives/:archiveId/members
- /v1/archives/:archiveId/recording-sessions
- /v1/archives/:archiveId/uploads
- /v1/archives/:archiveId/media
- /v1/archives/:archiveId/transcripts
- /v1/archives/:archiveId/people
- /v1/archives/:archiveId/events
- /v1/archives/:archiveId/facts
- /v1/archives/:archiveId/chapters
- /v1/archives/:archiveId/editions
- /v1/archives/:archiveId/narration
- /v1/archives/:archiveId/shares
- /v1/archives/:archiveId/exports
- /v1/archives/:archiveId/rights
- /v1/privacy-requests
- /v1/billing
- /health/live and /health/ready

Mutations require Idempotency-Key, optimistic version where relevant, authenticated archive scope, Zod validation, audit event, and stable problem+json errors. Upload API creates, signs, resumes, completes, verifies, and aborts multipart sessions. Provider callbacks use dedicated signature-verified routes and never trust client-supplied archive identifiers. Generated content responses include provenance_summary and unsupported_claim_count.
=== END FILE ===

=== FILE: .agent/specs/SPEC-004-ui-ux-behavior.md ===
# Spec 004 UI and UX Behavior

The main navigation is Archive, Interviews, Media, People, Timeline, Stories, Book, Audio, Family Portal, Rights, and Settings. Every recording surface shows recording state, consent state, pause, stop, elapsed time, upload progress, and recovery instructions. Transcript correction supports keyboard navigation, speaker changes, word-level media playback, approval boundaries, and visible distinction among exact quote, paraphrase, and AI prose.

Privacy is visible: every asset displays audience and rights status. Public or link sharing requires a review summary and explicit action. Book and audio generation show estimated pass-through cost before starting. Long jobs are asynchronous and resumable. Older-adult usability requirements from BLUEPRINT_INPUT.md are mandatory. Empty, loading, offline, processing, partial-failure, permission-denied, disputed-rights, and withdrawn-content states are specified and tested.
=== END FILE ===

=== FILE: .agent/specs/SPEC-005-auth-and-permissions.md ===
# Spec 005 Authentication and Permissions

Roles: organization_owner, archive_owner, story_subject, interviewer, editor, fact_checker, contributor, viewer, legacy_steward, support_jit, platform_admin. Permissions are actions over archive, recording, media, transcript, fact, chapter, edition, share, rights, export, billing, and deletion resources. Role alone is insufficient: item visibility, subject consent, rights status, embargo, and publication approval also apply.

Only archive owners can delete archives, approve editions, create public shares, or designate legacy stewards. Story subjects control use of their recordings and verified self-voice. Editors cannot expand audience. Support access requires customer approval, reason, expiry, and audit. Platform administrators have no standing content access.
=== END FILE ===

=== FILE: .agent/specs/SPEC-006-error-handling.md ===
# Spec 006 Error Handling

Use RFC 9457-style problem details with stable codes. Required families: AUTH_REQUIRED, PERMISSION_DENIED, CONSENT_REQUIRED, CONSENT_WITHDRAWN, RIGHTS_UNVERIFIED, RIGHTS_DISPUTED, QUOTE_NOT_APPROVED, EVIDENCE_MISSING, UNSUPPORTED_CLAIM, UPLOAD_INCOMPLETE, CHECKSUM_MISMATCH, MEDIA_UNSAFE, MEDIA_PROCESSING_FAILED, PROVIDER_UNAVAILABLE, PROVIDER_POLICY_REJECTED, BUDGET_EXCEEDED, EDITION_STALE, DELETION_PENDING, RATE_LIMITED, CONFLICT, VALIDATION_FAILED, INTERNAL_ERROR. Responses never include source content or provider secrets. Retryability and user action are explicit.
=== END FILE ===

=== FILE: .agent/specs/SPEC-007-observability.md ===
# Spec 007 Observability

Required signals: request latency and status; auth and authorization denials; upload bytes and completion; scan and derivative duration; transcription minutes and confidence; transcript correction and approval rates; fact confirmation and dispute rates; generation cache-hit and miss tokens; unsupported claim rejection; narration characters and cost; export size and duration; share access; rights and consent failures; deletion age; fixity failures; queue depth; provider latency and errors. Structured logs prohibit content. Alerts cover cross-tenant denial anomalies, public share spikes, fixity failure, deletion SLA breach, provider cost spikes, media queue saturation, malware, and unauthorized voice workflow attempts.
=== END FILE ===

=== FILE: .agent/specs/SPEC-008-production-readiness.md ===
# Spec 008 Production Readiness

Production requires all sixteen live-fire outcomes, full verify, accessibility checks, performance budgets, real media processing, archive export and restore, fixity verification, deletion propagation, consent withdrawal, rights dispute freeze, unsupported-claim rejection, quotation lineage, voice policy enforcement, backup restoration, rollback drill, vendor reviews, counsel approval of privacy/terms/recording/releases/takedown, media liability insurance evidence, and manual deploy authorization.
=== END FILE ===

=== FILE: .agent/templates/adr-template.md ===
# ADR Template

ID, date, status, context, decision, alternatives, consequences, security and privacy impact, rollback, evidence.
=== END FILE ===

=== FILE: .agent/templates/execplan-template.md ===
# ExecPlan Template

Use the fourteen required sections and complete milestone grammar from `.agent/PLANS.md`.
=== END FILE ===

=== FILE: .agent/templates/runbook-template.md ===
# Runbook Template

Signal, impact, safety, diagnostics, mitigation, verification, rollback, escalation, follow-up.
=== END FILE ===

=== FILE: .agent/templates/spec-template.md ===
# Spec Template

Purpose, vocabulary, behaviors, inputs, outputs, errors, security, privacy, tests, non-goals, and acceptance.
=== END FILE ===

=== FILE: .agent/templates/test-case-template.md ===
# Test Case Template

Outcome, setup, real dependencies, action, observable effect, cleanup, failure evidence.
=== END FILE ===

=== FILE: .gitignore ===
.env
.env.*
!.env.example
node_modules/
.next/
dist/
coverage/
playwright-report/
test-results/
.agent/state/*.log
.agent/state/*.pid
*.local
.DS_Store
=== END FILE ===

=== FILE: AI_PROCESSING_NOTICE.md ===
# AI and Media Processing Notice

Before enabling a task, show the provider category, data categories, purpose, whether local processing is available, known processing location, retention and training position supported by current documents, deletion path, expected cost, and the exact archive items selected. Consent is granular for transcription, DeepSeek editorial processing, translation, narration, verified self-voice, and publication. Consent can be withdrawn for future processing.

The system must state that AI output can be inaccurate and that no generated statement is a source. It must distinguish exact source quotation, human paraphrase, and AI connective prose. DeepSeek receives only task-minimized redacted text. Transcription providers receive only selected recordings. Narration providers receive approved text and permitted voice data.
=== END FILE ===

=== FILE: ARCHITECTURE.md ===
# AI Family Historian Architecture

## Purpose
Define the production architecture for a private family-memory capture, preservation, editing, and publication SaaS. The system must preserve source truth, rights, provenance, and portability while using external AI only as a bounded processor.

## System overview
The launch system is a TypeScript modular monolith with independently scalable worker processes. The web client records interviews and manages archives. The API owns identity, permissions, records, rights, and workflow commands. PostgreSQL owns structured truth. R2 owns immutable original media and reproducible derivatives. Redis/BullMQ coordinates bounded jobs. Media workers run ClamAV, ExifTool, FFmpeg, ImageMagick, OCR, and packaging. The AI Policy Gateway is the only route to DeepSeek, transcription, and narration providers.

## Repository map
- apps/web: customer UI, interview recorder, transcript editor, timeline, archive, publishing studio.
- apps/api: Fastify HTTP boundary, auth, OpenAPI, commands, queries, provider webhooks.
- apps/worker: queues for media, OCR, transcription, extraction, editorial generation, exports, deletion.
- apps/admin: audited support, rights review, abuse review, and operations UI.
- packages/domain: entities, invariants, workflows, rights, provenance, publication state.
- packages/contracts: canonical request, response, event, and job schemas.
- packages/database: Drizzle schema, migrations, RLS, repositories, transaction boundaries.
- packages/storage: object naming, multipart upload, fixity, retention, signed access.
- packages/media: derivative plans and command builders for FFmpeg/ImageMagick/ExifTool/OCR.
- packages/ai-gateway: redaction, consent checks, prompt registry, cache families, provider adapters, output validation.
- packages/provenance: evidence spans, quote lineage, generation lineage, manifests, checksums.
- packages/publishing: chapter assembly, PDF, EPUB, audiobook, index and caption exports.
- packages/permissions: RBAC plus item visibility and subject-right checks.
- packages/audit: append-only security and content-provenance events.
- tests: unit, integration, E2E, live-fire, accessibility, performance, media, privacy, security.

## Code import law
1. packages/domain imports only packages/contracts primitives and pure utilities.
2. packages/contracts imports no application, database, provider, or UI module.
3. packages/database implements domain repository interfaces and may import domain and contracts; domain never imports database.
4. packages/storage and packages/media implement infrastructure interfaces and never mutate domain records directly.
5. apps/api and apps/worker orchestrate domain services and adapters; provider SDKs may appear only in adapter packages.
6. apps/web imports generated contracts and UI packages, never database or provider SDKs.
7. The AI Policy Gateway is the exclusive external language, transcription, and narration boundary.

## Runtime flows
### Interview
Browser obtains a short-lived recording session, presents versioned consent, records chunks, uploads through signed multipart URLs, and finalizes with checksums. A worker scans and normalizes media, produces playback derivatives, submits consent-approved audio for transcription, stores word-level transcript evidence, and creates candidate entities. The subject or editor corrects and approves transcript sections before quotation eligibility.

### Source ingestion
Original bytes are immutable. Each object receives SHA-256 fixity, MIME verification, metadata extraction, malware scan result, rights record, visibility policy, and derivative plan. Derivatives can be regenerated from originals and are never authoritative.

### Narrative generation
The service constructs a stable cache prefix containing platform policy, editorial rules, output schema, and task-family instructions; appends a versioned archive capsule containing only approved facts; appends source excerpts with evidence identifiers; then appends the current request. The response must contain claim-to-evidence mappings. Validation rejects unsupported quotations, invented dates, uncited factual claims, or references to inaccessible sources.

### Publishing
A publication edition pins source versions, transcript approvals, chapter versions, image selections, caption approvals, rights status, and generation lineage. Deterministic templates build HTML, PDF, EPUB, and audiobook manifests. Publication requires a rights gate and owner approval; public sharing is never automatic.

## State and truth rules
- Original media bytes and fixity manifests are immutable.
- Corrected transcript revisions are append-only; approved quotations pin exact revision and offsets.
- Candidate facts are not historical truth.
- Confirmed facts include confirmer, time, evidence, confidence, visibility, and dispute state.
- Multiple conflicting recollections may coexist.
- Generated prose is versioned and attributed to model, prompt, input evidence, and approver.
- A quotation may never be generated, normalized beyond approved editorial rules, or silently paraphrased.
- Archive deletion removes content and processor copies while retaining only narrowly documented legal/security evidence.

## External boundaries
DeepSeek: editorial and reasoning tasks only after consent and redaction. Deepgram: transcription only for opted-in recordings. Local Whisper is the fallback for projects that prohibit external audio processing. ElevenLabs: stock narration or living subject self-verified voice only. R2: encrypted object storage. Stripe: payment. Resend: transactional communication. Print providers receive only approved edition artifacts and shipping details for a specific order.

## Cache architecture
Canonical prefix order is global editorial law, task-family rules, output schema, stable style guide, versioned archive capsule, source excerpts, then volatile instruction. JSON key order, whitespace, tool order, and schemas are byte-stable. Application exact-result cache runs before DeepSeek. Cache success is measured as reusable-prefix hit ratio, total input-token hit ratio, avoided-call ratio, and effective dollar cost. Padding, oversharing, or retaining data solely to improve cache metrics is forbidden.

## Security boundaries
All requests carry organization and archive scope. RLS and application authorization both enforce isolation. Original media uses opaque object keys and short-lived signed URLs. Temporary worker files use encrypted ephemeral storage and are wiped after job completion. Support access is just-in-time, purpose-bound, approved, and audited. Provider callbacks are signature-verified and idempotent.

## Validation and errors
Zod validates every trust boundary. Domain errors are stable typed codes. Provider errors are mapped and redacted. Media jobs retain bounded diagnostic metadata but no source content in logs. Failed jobs are retryable only under LOOPS.md budgets and dead-letter safely.

## Observability
Structured logs include trace_id, archive_id pseudonym, job_id, task_family, provider, cache counts, media duration, bytes, status, and redaction counts. Logs exclude names, transcript text, prompts, source excerpts, filenames, addresses, and raw provider payloads.

## Architectural invariants
INV-001 Structured approved source records, not model output, are authoritative.
INV-002 Every published factual claim maps to evidence or is visibly labeled interpretation.
INV-003 Every published quotation maps byte-for-byte to an approved source span.
INV-004 No external provider receives content without current purpose-specific consent.
INV-005 Voice generation uses licensed stock voices or the living subject's verified self-voice only.
INV-006 Original media is immutable and fixity-verifiable.
INV-007 Public sharing and print fulfillment require explicit edition approval.
INV-008 Rights and visibility checks run at read, export, share, generation, and publication boundaries.
INV-009 AI, transcription, TTS, and print providers are replaceable adapters.
INV-010 Cache optimization never overrides minimization, consent, rights, deletion, or purpose limitation.
INV-011 Every destructive workflow is delayed, auditable, idempotent, and verifiable.
INV-012 Open export formats prevent platform lock-in.

## Forbidden moves
No direct provider calls outside gateways; no mutable originals; no generated quotations; no facial recognition; no posthumous voice cloning; no production demo mode; no public-by-default resources; no provider content logging; no rights checks delegated only to the UI; no permanent media in worker scratch storage.

## Change procedures
A feature starts with spec and vocabulary changes, then contracts, domain rules, migration, adapters, tests, and documentation. A dependency requires evidence, exact pinning, security review, and DECISIONS.md entry. A schema change uses expand-migrate-contract. A provider integration requires preflight credentials, a read-only probe, contract snapshot, data-flow update, deletion behavior, fallback, and live-fire proof.

## Architecture review checklist
Verify all invariants, import boundaries, consent checks, rights gates, evidence lineage, export portability, provider isolation, job idempotence, deletion propagation, cache metrics, and real-dependency tests before approval.
=== END FILE ===

=== FILE: ASSUMPTIONS.md ===
# Assumptions

| Assumption | Reason | Risk if wrong | Exact verification | Blocks implementation |
|---|---|---|---|---|
| Greenfield repository | User requested a new blueprint | Existing code could conflict | `find . -maxdepth 2 -type f | sort` in EP-000 | Yes |
| US-first launch | Initial deployment target | Consent, publicity, privacy, and defamation rules differ by jurisdiction | Counsel-approved launch matrix in LEGAL_APPROVAL_FILE | Production only |
| DeepSeek V4 Flash remains available under configured model name | Requested model | API or terms may change | Probe model list and archive official docs during EP-000 | Yes |
| Deepgram contract permits intended transcription | Chosen primary STT | Retention or training terms may be unacceptable | Vendor-risk evidence and read-only probe | Production only |
| ElevenLabs is optional | Voice work creates elevated rights risk | Missing provider must not block book workflows | Leave ELEVENLABS_API_KEY empty and prove stock/local narration fallback | No |
| Professional voice cloning is self-voice only | Current provider rule and safety choice | Product could otherwise enable impersonation | Verify provider documentation and live-fire rejection | Yes |
| Local Whisper can process consent-restricted audio | Required fallback | Compute cost may exceed lean target | Benchmark representative one-hour audio in EP-008 | No |
| R2 supports required multipart sizes | Large media requirement | Upload architecture may need alternative | Run multipart integration proof | Yes |
| Print provider is deferred until contract approval | API and rights terms vary | Automated physical fulfillment not available at first ship | Keep print artifact generation real; mark provider fulfillment optional | No |
| Users own or license contributed media | Required business model | Infringement and takedown exposure | Counsel-approved contributor release and rights workflow | Production only |
| No public social network | Product boundary | Growth features could create moderation burden | SPEC-000 and route audit | No |
=== END FILE ===

=== FILE: BLUEPRINT_INPUT.md ===
# 6LAYER Filled Input: AI Family Historian

## Project Name
AI Family Historian

## Project Description
A privacy-first, multi-tenant SaaS that interviews living story subjects, ingests family photographs, documents, audio, video, letters, recipes, timelines, and genealogical context, then converts verified source material into an evidence-linked family archive. The product produces edited memoirs, printed-book-ready manuscripts, narrated audiobooks, searchable transcripts, interactive timelines, family trees, topic collections, private family portals, and preservation exports. DeepSeek V4 Flash performs bounded interviewing, organization, editorial assistance, contradiction detection, translation assistance, and narrative drafting through an isolated AI Policy Gateway. Source media, approved transcripts, provenance records, and human-confirmed facts remain authoritative. AI prose is always distinguishable from quoted source material.

## Product Goal
Create the most trusted and automated family-history production platform for older adults and their families. It must support at least 1,000 family archives on the launch architecture, handle large media uploads safely, preserve provenance and consent, generate polished multi-format deliverables, maintain at least 97 percent cache hits on cache-eligible repeated DeepSeek prefixes, and prevent fabricated memories, unauthorized voice or likeness use, privacy violations, and accidental publication of sensitive family claims.

## Target Users
Older adults and retirees preserving their life stories; adult children buying preservation packages for parents or grandparents; family historians and genealogists; diaspora and immigrant families preserving multilingual oral history; military families; adoptees and blended families; professional memoir interviewers; senior-living communities; hospice and palliative-care partners subject to appropriate consent and healthcare boundaries; libraries, historical societies, and cultural organizations operating private projects.

## Core User Outcomes
1. Create a private family archive, invite contributors, and assign owner, subject, interviewer, editor, fact-checker, viewer, and legacy-steward roles.
2. Capture a guided audio or video interview with consent, pause and resume safely, transcribe it, identify speakers, and allow line-level correction.
3. Upload large photographs, scans, documents, audio, and video through resumable multipart upload with malware scanning, deduplication, checksums, metadata, and preservation derivatives.
4. Extract candidate people, places, dates, events, relationships, quotations, recipes, artifacts, and themes with source-level citations and human confirmation.
5. Build a versioned family timeline and relationship graph while representing uncertainty, conflicting recollections, aliases, approximate dates, and disputed claims without forcing false certainty.
6. Draft a memoir chapter using confirmed facts and approved quotations only, with every factual claim traceable to source evidence and all connective AI prose labeled in provenance metadata.
7. Generate a print-ready book manuscript, cover inputs, image captions, index inputs, source notes, and accessible PDF and EPUB exports.
8. Generate a narrated audiobook using a licensed stock voice or the living subject's independently verified self-voice; prohibit unauthorized impersonation and prohibit creating another person's professional voice clone.
9. Create a private searchable family portal with granular per-item visibility, living-person privacy controls, embargo dates, download controls, and revocable share links.
10. Export the complete archive in documented portable formats, including originals, derivatives, checksums, transcripts, structured metadata, provenance, permissions, and generated works.
11. Delete an archive or selected media through a verifiable deletion workflow that propagates to processors where contractually supported and preserves only legally required records.
12. Record consent, copyright ownership or license, publicity and likeness rights, voice rights, contributor releases, withdrawal, deceased-person handling, and publication approval for every relevant subject and asset.
13. Detect likely contradictions, unsupported claims, defamatory or highly sensitive allegations, and living-person privacy risks before sharing or publication.
14. Measure DeepSeek cache-hit, cache-miss, latency, token, redaction, provenance, hallucination, and cost telemetry without logging source content.
15. Purchase a concierge, self-service, family, or institutional subscription and manage usage, storage, transcription, narration, print-production, and renewal limits.
16. Complete an annual archive review covering broken permissions, departed contributors, stale links, missing rights, preservation fixity, new interviews, and export readiness.

## Existing Repository Status
Greenfield.

## Preferred Tech Stack
Frontend: Next.js 16, React, TypeScript, Tailwind CSS, Radix UI, React Hook Form, Zod, TipTap collaborative editor, waveform and transcript components, Playwright.
Backend: TypeScript modular monolith using Fastify with OpenAPI, BullMQ workers, FFmpeg media workers, and a provider-isolated AI and media processing gateway.
Database: PostgreSQL 17 with pgvector, Drizzle ORM, row-level security, temporal/version tables, application-level envelope encryption, and append-only provenance events.
Authentication: Better Auth with passkeys, TOTP MFA, Argon2id password fallback, secure server-side sessions, device management, contributor invitations, and recovery controls.
Hosting / Deployment: Cloudflare DNS, CDN, WAF, Turnstile, Stream optional for private playback, and R2 object storage; containerized web/API and workers on Fly.io; managed PostgreSQL on Neon; Upstash Redis; GitHub Actions.
Testing: Vitest, Testcontainers, Playwright, axe-core, k6, OpenAPI contract tests, FFmpeg media fixture verification, POSIX shell gates.
Package Manager: pnpm 10 pinned through Corepack.
CI/CD: GitHub Actions with immutable lockfile installation, migration checks, media pipeline tests, full verify, image build, staging deployment, and manual production approval.
Observability: OpenTelemetry, Sentry, structured JSON logs with Pino, Prometheus-compatible metrics, media-job telemetry, and external uptime checks.

## External Services, APIs, and Credentials Already Known
DeepSeek Open Platform API for language tasks; Deepgram for primary speech-to-text with a local Whisper fallback for consent-sensitive projects; ElevenLabs only for licensed narration and verified self-voice workflows; Neon PostgreSQL; Upstash Redis; Cloudflare R2, Turnstile, DNS, WAF, and optional Stream; Stripe Billing; Resend transactional email; Sentry; GitHub Actions and GitHub Container Registry; Fly.io; local ClamAV; local FFmpeg, ExifTool, ImageMagick, OCRmyPDF, and PaddleOCR; optional Lulu Direct or another approved print-on-demand provider after contractual and API verification.

## Agent Platforms Expected To Run This Pack
Claude Code, Codex CLI, Hermes, OpenClaw, and any terminal agent able to read, edit, and execute repository commands.

## Auto-Deploy Authorization
No. The run ends at a proven, tagged, ship-ready artifact and emits one exact manual production deployment command.

## Business Constraints
Launch concierge-assisted before pure self-service; startup infrastructure must remain lean; target core platform infrastructure below 1,200 USD monthly at 1,000 archives excluding pass-through transcription, narration, print, and excess storage; subscriptions and usage credits must prevent unbounded media costs; no advertising, data sale, data brokerage, public training corpus, or hidden model training; customers retain ownership of source material; generated-work rights and licenses must be stated clearly; customer media may never be used for product marketing without separate opt-in permission.

## Technical Constraints
Modular monolith first; separate scalable media-worker pool; direct resumable multipart uploads; immutable originals with fixity hashes; derivative regeneration; no production GPU requirement; DeepSeek only through the AI Policy Gateway; provider abstraction mandatory; stable canonical prompt prefixes; versioned archive capsules; deterministic extraction and search before LLM use; source-citation enforcement; no model output accepted as historical fact without evidence and confirmation; all jobs idempotent; safe schema migrations; support 1,000 archives without redesign and scale horizontally.

## Security / Compliance Constraints
NIST-aligned risk management; OWASP ASVS Level 2 baseline; OWASP API Security Top 10; strong encryption; tenant isolation; least privilege; passkeys and MFA; immutable audit and provenance logging; customer-approved support access; secure SDLC; vendor risk review; incident response; copyright and takedown process; privacy-rights workflow; consent and release records; voice and likeness safeguards; child-safety and minor-content rules; abuse prevention against impersonation, fraud, harassment, doxxing, and non-consensual intimate content; legal review and cyber plus technology E&O and media liability insurance before production.

## Performance Requirements
P95 ordinary authenticated API latency below 400 ms excluding asynchronous AI and media jobs; P95 dashboard interactive below 3 seconds on normal broadband; resumable upload acknowledgement below 2 seconds; support 1,000 archives, 250 monthly active archives, 50 simultaneous interviews, 20 concurrent uploads, and configurable media-worker concurrency; progressive playback derivatives; queue backpressure; at least 97 percent cache hits on cache-eligible repeated DeepSeek prefix tokens and at least 90 percent overall input-token cache-hit target after warming; Max Thinking under 3 percent of calls; task token and dollar ceilings; export of a 25 GB archive completes asynchronously with resumability and integrity manifest.

## Accessibility Requirements
WCAG 2.2 AA target; keyboard complete; semantic HTML; visible focus; at least 18 px default body text; 44 by 44 pixel targets; no color-only status; transcript keyboard navigation; captions; transcript correction; audio descriptions metadata; plain-language errors; printable workflows; reduced motion; accessible PDF and EPUB generation targets.

## Data / Privacy Requirements
Data minimization and private-by-default sharing; explicit consent before recording; visible recording state; per-subject and per-asset rights records; no silent recording; separate consent for AI processing, transcription, voice generation, publication, marketing, and public sharing; strong living-person privacy controls; minors require verified guardian authority and heightened defaults; sensitive stories and allegations require restricted visibility and review; DeepSeek processing off until enabled; redaction and DLP gateway; no provider-training or retention promises unless contractually verified; configurable retention; verified deletion and export; subprocessor register; data-processing records; DPIA; state-law matrix maintained by counsel; no sale, targeted advertising, or data-broker activity; preserve consent and rights evidence after content deletion only where legally required and documented.

## Integrations
DeepSeek API, Deepgram API, optional local Whisper, ElevenLabs restricted narration, Stripe Billing, Resend, Cloudflare R2 and Turnstile, optional Cloudflare Stream, Neon, Upstash, Sentry, OpenTelemetry, Fly.io, GitHub, local ClamAV, FFmpeg, ExifTool, ImageMagick, OCRmyPDF, browser MediaRecorder and WebAuthn, optional print-on-demand provider after preflight approval.

## Non-Goals
No public social network; no scraping genealogy sites without licensed APIs and user authorization; no definitive genealogy claims from model inference; no facial recognition; no biometric identity matching; no unauthorized voice cloning; no cloning a deceased person's voice from family recordings; no deepfake video; no synthetic statement presented as a real quotation; no hidden reconstruction of missing memories; no legal determination of copyright, defamation, inheritance, or publicity rights; no therapy, healthcare, hospice documentation, or medical advice; no automatic publication; no public archive by default; no minors as account owners; no DNA storage or genetic analysis; no permanent lock-in to proprietary formats.

## Timeline / Milestones
Sixteen-week revenue-first launch: weeks 1-2 foundation, threat model, consent model, and media spike; weeks 3-4 core archive domain and provenance; weeks 5-6 persistence, large upload, fixity, and derivatives; weeks 7-8 interview, transcription, speaker correction, and extraction; weeks 9-10 editor, timeline, family graph, and source citations; weeks 11-12 book, EPUB, PDF, audiobook, and private portal exports; weeks 13-14 auth, rights, privacy, billing, and abuse controls; week 15 live-fire, accessibility, performance, preservation, and operations; week 16 counsel, insurer, pilot, and ship readiness.

## Deployment Target
Staging and production Fly.io applications in a US region, Cloudflare edge and R2 with configured jurisdiction controls where available, Neon US PostgreSQL, Upstash US Redis, GitHub Container Registry, isolated media-worker machines with temporary encrypted scratch storage. Production deployment is manual after all gates, vendor reviews, rights documents, and insurance reviews pass.

## Runtime Budgets
Each milestone maximum six attempts; ordinary milestones 90 minutes; media processing, auth, consent, rights, deletion, portability, provenance, and live-fire milestones 180 minutes. AI, transcription, TTS, media, storage, and print jobs enforce per-plan duration, size, concurrency, token, and dollar ceilings.

## Special Instructions
Rights, privacy, consent, provenance, and editorial truthfulness are product architecture. Produce a layered Privacy Policy, Terms of Service, AI Processing Notice, Recording and Interview Consent, Contributor Release, Publication Approval, Voice and Likeness Policy, Copyright and Takedown Policy, Minor Content Policy, Editorial Ethics Policy, Subprocessor Register, Retention Schedule, DPA template, DPIA, Incident Response Plan, and counsel review checklist. Every quotation must be either verbatim from an approved transcript/source or explicitly marked as paraphrase. Every generated historical claim requires evidence or must be labeled as unverified interpretation. DeepSeek remains optional, isolated, replaceable, and barred from prohibited sensitive content. Cache optimization never overrides minimization, rights, consent, purpose limitation, or deletion.
=== END FILE ===

=== FILE: CONTRIBUTING.md ===
# Contributing

Read AGENTS.md. Use feature branches, pinned dependencies, strict TypeScript, domain invariants in comments, tests for every behavior, and documentation updates. Commit format is `[EP-XXX][Mk] imperative summary`. Never introduce a provider promise without evidence or bypass the AI gateway.
=== END FILE ===

=== FILE: CONTRIBUTOR_RELEASE_TEMPLATE.md ===
# Contributor Release Template - Counsel Review Required

This implementation template records contributor identity, authority, contributed assets, ownership or license basis, permitted uses, territories, media, term, editing permission, attribution preference, privacy selections, AI-processing selection, publication selection, sublicensing needed for service providers, withdrawal process, warranties, dispute contact, signature evidence, and document version. It must not be presented as finalized legal advice until approved by qualified counsel for launch jurisdictions.
=== END FILE ===

=== FILE: COPYRIGHT_AND_TAKEDOWN_POLICY.md ===
# Copyright and Takedown Policy

The service accepts only material the uploader owns or is authorized to use. It provides a documented notice, counter-notice, restriction, preservation, and repeat-infringer workflow reviewed by counsel. A credible rights dispute restricts sharing and publication without automatically destroying evidence. Print and narration jobs are halted when affected assets are unresolved.
=== END FILE ===

=== FILE: DATA_PROCESSING_ADDENDUM_TEMPLATE.md ===
# Data Processing Addendum Template - Counsel Review Required

This template covers roles, documented instructions, confidentiality, security measures, subprocessors, international transfers, assistance with rights requests, incident notice, deletion or return, audits, sensitive-data restrictions, training prohibition where contracted, retention, government requests, and precedence. Production partner use requires counsel-approved execution and vendor-specific annexes.
=== END FILE ===

=== FILE: DATA_RETENTION_SCHEDULE.md ===
# Data Retention Schedule - Approval Required

| Category | Default while active | After deletion request | Notes |
|---|---|---|---|
| Original media | Until user deletion or account termination | Grace period then primary deletion; backups expire on documented schedule | Fixity and rights status travel with object |
| Derivatives | While needed | Delete before or with original; regenerable | Thumbnails, playback, OCR, normalized audio |
| Transcripts and revisions | While archive active | Delete with source unless separately retained by instruction | Approved quote lineage must not outlive source without legal basis |
| Generated chapters and editions | While active | Delete on request subject to distributed-copy limits | Edition hash may remain in minimal audit evidence |
| Consent and rights evidence | Active plus legally approved period | Restrict and retain only as legally required | Needed to establish authority and withdrawal |
| Security audit events | Approved security period | Retained and access-restricted | No content |
| Provider job payloads | Minimum possible | Request deletion promptly where supported | Contract-specific |
| Worker scratch files | Job duration only | Immediate secure wipe | Encrypted ephemeral storage |
| Deleted account backups | Documented rolling expiry | Automatic expiry | Restore process must reapply deletion tombstones |
| Billing and tax records | Statutory period | Retain only required fields | Stripe is payment system of record |
=== END FILE ===

=== FILE: DECISIONS.md ===
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

Add a decision before introducing a new canonical name, dependency, provider promise, data category, or exception. Use `.agent/templates/adr-template.md`.
=== END FILE ===

=== FILE: DEPLOYMENT.md ===
# Deployment

Build one immutable OCI image per app and worker. GitHub Actions runs verify, builds and signs images, deploys staging, runs smoke and live-fire, and prepares production. Production is MANUAL: `fly deploy --app "$FLY_APP_PRODUCTION" --image "ghcr.io/$GHCR_OWNER/family-historian:$RELEASE_TAG" --strategy rolling`. Run migrations with a release command before traffic only when backward compatible. Rollback uses the prior signed image and compatible schema.
=== END FILE ===

=== FILE: DPIA.md ===
# Data Protection Impact Assessment - AI Family Historian

High-risk processing includes private recordings, family relationships, sensitive allegations, minors, living-person information, external AI transfer, voice generation, publication, and long-term archival storage. Necessity is limited to user-requested preservation and publishing. Controls include private defaults, granular consent, local transcription fallback, minimization, provider isolation, rights records, evidence-linked generation, no facial recognition, no posthumous voice cloning, living-person restrictions, encryption, deletion, portability, takedown, and human publication approval. Residual risks requiring counsel and leadership acceptance include international provider processing, family authority disputes, defamation, publicity rights, copyright ownership, irreversible distributed copies, and provider retention. Production cannot launch until residual risk and transfer decisions are signed.
=== END FILE ===

=== FILE: EDITORIAL_ETHICS_POLICY.md ===
# Editorial Ethics Policy

The product preserves the distinction between memory, evidence, interpretation, and generated prose. It does not force agreement between conflicting recollections. Direct quotations remain exact to approved source spans. Editorial cleanup that changes meaning is prohibited. Paraphrases are labeled. Composite scenes, invented dialogue, synthetic quotations, and fabricated sensory detail are prohibited. Sensitive allegations receive restricted defaults. AI uncertainty is exposed rather than concealed. Subjects and contributors can submit corrections and competing accounts without erasing prior provenance.
=== END FILE ===

=== FILE: ENVIRONMENT.md ===
# Environment

Node.js 24.4.1, pnpm 10.13.1, Docker 28.3.2, PostgreSQL client 17, git 2.45 or newer, curl, jq, openssl, awk, sed, grep, and POSIX sh. `.env` is validated at startup. Local, test, staging, and production use the same behavior with different credentials. Production refuses insecure cookies, missing encryption keys, AI without vendor approval evidence, public buckets, and wildcard CORS.
=== END FILE ===

=== FILE: HOW_TO_USE.md ===
# How to Use This Blueprint Pack

1. Save BLUEPRINT_PACK.md in an empty repository and use the splitter below, or use the materialized ZIP.

```sh
#!/usr/bin/env sh
set -eu
pack="${1:-BLUEPRINT_PACK.md}"
[ -f "$pack" ] || { echo "unpack: missing $pack" >&2; exit 1; }
awk '
  /^=== FILE: /{
    path=substr($0, 11)
    sub(/ ===$/, "", path)
    cmd="mkdir -p \"$(dirname \"" path "\")\""
    system(cmd)
    printf "" > path
    out=1
    next
  }
  /^=== END FILE ===$/{ out=0; close(path); next }
  out { print >> path }
' "$pack"
echo "unpack: ok"
```

2. Initialize git, commit the pack, obtain every PREFLIGHT.md item, copy .env.example to .env, and run `sh scripts/preflight.sh` until `preflight: ok`.
3. Give any supported agent `.agent/prompts/run-graph.md`.
4. Observe `.agent/state/LEDGER.md` and git history without using chat as state.
5. Relay between agents through the same prompt and lease protocol.
6. On BLOCKED, read the structured report in the active ExecPlan, make only the named decision, reset as instructed, and relaunch.
7. Use the single-node prompts only for bounded maintenance. Never implement from ROADMAP.md.
8. RUN_COMPLETE plus fresh verify and production-readiness sentinels is the ship decision. Production deployment remains manual.
=== END FILE ===

=== FILE: INCIDENT_RESPONSE_PLAN.md ===
# Incident Response Plan

Detect through alerts, reports, and integrity checks. Triage severity, affected archives, media, rights, credentials, and providers. Contain sessions, links, keys, jobs, and publication. Preserve evidence without spreading content. Notify leadership, security, privacy, counsel, insurer, and affected customers according to the decision tree and applicable deadlines. Eradicate, restore from verified backups, run fixity checks, verify access controls, document root cause, and track corrective actions. Unauthorized publication, voice generation, or share-link exposure is treated as a high-severity content incident even without account takeover.
=== END FILE ===

=== FILE: MEDIA_PROVENANCE_POLICY.md ===
# Media and Narrative Provenance Policy

Every original receives a cryptographic checksum, acquisition method, uploader, capture or import date when known, rights record, visibility, and chain of custody. Derivatives reference the original and transformation recipe. Every transcript token references media time offsets and revision. Every generated paragraph references source fact and quotation identifiers, model, prompt version, archive capsule version, and approver. Export manifests preserve these relationships in documented JSON and CSV schemas.
=== END FILE ===

=== FILE: MINOR_CONTENT_POLICY.md ===
# Minor Content Policy

Minors cannot own accounts. Upload or recording involving a minor requires verified guardian authority and a documented purpose. Visibility defaults to owner-only. Public sharing, biometric inference, voice cloning, sensitive location exposure, school details, medical details, and targeted marketing are prohibited. On reaching adulthood, the subject must have a practical correction, restriction, export, and deletion path where law permits.
=== END FILE ===

=== FILE: OBSERVABILITY.md ===
# Observability

Pino JSON logs include timestamp, level, service, environment, request_id, trace_id, tenant_pseudonym, actor_pseudonym, action, outcome, duration_ms, policy_decision, and error_class. Payloads are forbidden. Metrics include HTTP, queue, DB, object, auth, AI token/cache/cost, DLP, deletion, export, report, and emergency-access signals. Alerts page on tenant isolation, repeated export failure, deletion SLA breach, auth attack, audit-chain failure, and backup failure.
=== END FILE ===

=== FILE: OPERATIONS.md ===
# Operations

Health endpoints are `/health/live`, `/health/ready`, and `/health/dependencies`. Operators monitor queue depth, DB pool, R2 failures, AI error and cache ratios, consent failures, DLP blocks, report latency, privacy request age, deletion backlog, emergency requests, and auth anomalies. Backups run daily and restore is proven quarterly. Incidents follow `.agent/checklists/incident-response.md`.
=== END FILE ===

=== FILE: PRIVACY_POLICY_DRAFT.md ===
# AI Family Historian Privacy Policy Draft - Counsel Review Required

## Scope and role
This draft describes a private family-history service that stores recordings, photographs, documents, transcripts, relationships, stories, rights records, generated works, account information, usage records, and payment references. It must be localized and approved before publication.

## Data collected
Account and contact data; family archive content; audio and video recordings; photographs and scans; transcript and correction history; people, dates, places, relationships, and life events; contributor and subject consent; copyright, voice, likeness, and publication permissions; visibility choices; device, security, audit, billing, support, and operational telemetry. The service does not intentionally collect passwords, private keys, complete payment-card data, DNA data, or biometric identity templates.

## Sources
Data comes from account holders, invited contributors, recorded participants, authorized integrations, service providers, and technical interaction. Uploaders must have authority to contribute content and identify other people.

## Purposes
Provide private capture, preservation, transcription, organization, search, editing, publishing, sharing, export, support, billing, security, legal compliance, and user-requested AI functions. No sale, targeted advertising, data brokerage, or use of private archive content to train general models unless a separate future opt-in is legally and contractually implemented; launch policy prohibits such training.

## AI and external processing
External processing is off until the relevant user enables it and receives a layered notice. DeepSeek may receive minimized, redacted text for selected editorial tasks. Deepgram may receive opted-in audio for transcription. ElevenLabs may receive approved narration text and only permitted voice material. Provider identity, processing location, retention, training, deletion, and subprocessors must be disclosed according to current contracts and policies; the company must not promise facts it has not contractually verified. Local processing alternatives are described where available.

## Sharing
Content is private by default. It is shared only with invited members, selected link recipients, processors needed for requested functions, print or fulfillment vendors for an approved order, professional advisers authorized by the owner, or authorities where legally required. Public publication requires explicit edition approval.

## Sensitive and living-person information
Users control item visibility. Sensitive allegations, health, sexuality, parentage, immigration, finances, and minor information receive restricted defaults. The product may restrict sharing while rights or safety disputes are reviewed.

## Retention and deletion
Retention follows DATA_RETENTION_SCHEDULE.md. Users can delete items or archives subject to grace periods, backup expiry, fraud/security evidence, legal obligations, active disputes, and irreversible limitations of already distributed physical or downloaded copies. Processor deletion is requested and tracked where supported.

## Rights
Authenticated users and qualifying data subjects can request access, correction, export, restriction, objection, consent withdrawal, and deletion as applicable. Identity, authority, and archive relationships are verified before disclosure. Appeals and authorized-agent requests follow applicable law.

## Security
Encryption, tenant isolation, least privilege, passkeys/MFA, immutable audit and provenance, malware scanning, short-lived links, support access controls, vendor review, backups, fixity verification, and incident response are used. No system is guaranteed perfectly secure.

## Children
Account owners must be adults. Minor content requires verified guardian authority and is private by default. The service is not directed to children.

## International transfers and subprocessors
The current subprocessor register and transfer mechanisms are published and material changes are notified as required. DeepSeek-related transfer and government-access risk requires explicit disclosure and launch approval.

## Contact and changes
Publish company legal identity, address, privacy contact, effective date, version history, and complaint or appeal methods before launch. Material changes require renewed notice or consent where legally required.
=== END FILE ===

=== FILE: PRODUCTION_READINESS.md ===
# Production Readiness

All fourteen outcomes pass live-fire. One fresh `scripts/verify.sh` emits every sentinel. Reality, security, privacy, performance, accessibility, observability, deployment, restore, rollback, legal review, vendor review, insurance, and incident contacts pass. DeepSeek claims match archived current evidence. Privacy and Terms match actual code. The release tag exists and production deploy remains manual.
=== END FILE ===

=== FILE: PROJECT_BRIEF.md ===
# AI Family Historian Project Brief

## Problem
Families lose irreplaceable stories, context, voices, photographs, and cultural knowledge because conventional memoir production is expensive, slow, fragmented, and difficult for older adults to complete.

## Product
AI Family Historian is a private evidence-linked archive and publishing system. It captures interviews and media, preserves originals, records provenance and rights, lets families confirm facts and resolve disagreements, and produces books, audio, timelines, and private portals without representing generated language as historical evidence.

## Primary outcomes
The sixteen numbered outcomes in BLUEPRINT_INPUT.md are the ship criteria and each maps to a live-fire proof in scripts/live-fire.sh.

## Business goals
Sell high-margin concierge onboarding and production packages, then retain families through private hosting, annual interviews, preservation checks, contributor seats, storage, and new-edition generation.

## Technical goals
Support 1,000 archives on a modular-monolith launch topology; isolate media processing; preserve fixity and provenance; make all AI providers replaceable; enforce cache efficiency; and export open, documented formats.

## Out of scope
All items in BLUEPRINT_INPUT.md Non-Goals are enforced boundaries.

## Production readiness
PRODUCTION_READINESS.md and EP-010 define the only valid ship decision.
=== END FILE ===

=== FILE: PUBLICATION_APPROVAL_TEMPLATE.md ===
# Publication Approval Template - Counsel Review Required

Each edition approval identifies the exact edition hash, included chapters, media, quotations, narration, audience, distribution channels, print quantity or storefront, embargo, living-person review status, rights exceptions, unresolved disputes, and approver authority. Any content change invalidates approval and creates a new edition.
=== END FILE ===

=== FILE: RECORDING_AND_INTERVIEW_CONSENT.md ===
# Recording and Interview Consent Requirements

Before capture, the interface identifies the recorder, archive owner, purpose, invited audience, processors, expected outputs, retention, withdrawal method, and whether AI transcription or generation is enabled. Recording begins only after affirmative consent and a persistent visible and audible state. New participants require consent before their speech is retained. Consent is versioned and bound to recording_session_id. Withdrawal stops future use and triggers the configured deletion or restriction workflow; already printed or lawfully distributed copies cannot be remotely recalled and this limitation is disclosed. Jurisdiction-specific all-party consent review is a production launch requirement.
=== END FILE ===

=== FILE: RELEASE.md ===
# Release

Use semantic versions. Release candidates require clean verify, staging deployment, migration rehearsal, restore proof, rollback drill, legal and privacy artifact hashes, and zero critical open defects. Production approval is manual because auto-deploy is not authorized. Monitor for 24 hours after release.
=== END FILE ===

=== FILE: ROADMAP.md ===
# Roadmap

Do not implement from this file. Implementation happens only through the graph: run sh scripts/graph-next.sh.

EP-000 proves toolchain and external readiness. EP-001 creates the pinned foundation. EP-002 implements domain invariants. EP-003 adds encrypted persistence and migrations. EP-004 exposes validated services and workflows. EP-005 implements accessible user outcomes. EP-006 implements authentication, authorization, privacy, and security. EP-007 hardens tests and live-fire. EP-008 adds observable operations. EP-009 proves staging, release, and rollback. EP-010 executes the complete ship standard.
=== END FILE ===

=== FILE: ROLLBACK.md ===
# Rollback

Rollback triggers include elevated error rate, tenant boundary issue, corrupted output, audit failure, deletion failure, AI data-policy breach, or material privacy mismatch. Disable affected feature first, then roll back image. Database rollback uses forward-fix unless the migration has a proven reverse path. Verify health, smoke, audit continuity, and data integrity.
=== END FILE ===

=== FILE: SECURITY.md ===
# AI Family Historian Security

## Security goals
Protect private family media, living-person information, recordings, identities, rights records, generated works, and payment metadata against unauthorized access, cross-tenant disclosure, impersonation, extortion, doxxing, deepfake abuse, destructive loss, and silent alteration.

## Threat model
Primary threats include credential theft, malicious invitees, abusive family members, insecure share links, media parser exploits, poisoned files, prompt injection inside source documents, cross-tenant object access, provider compromise, unauthorized publication, fraudulent voice cloning, defamatory generated claims, support abuse, ransomware, and archive loss.

## Authentication and authorization
Passkeys are preferred; TOTP MFA is available and mandatory for owners, editors with publication rights, support, and administrators. Server sessions are secure, rotated, revocable, and device-visible. Authorization combines organization role, archive role, item visibility, subject consent, rights status, publication state, and purpose. The API rechecks permission for every object download and derivative request.

## Upload security
Use direct signed multipart upload with strict size, type, and count quotas. Finalization independently verifies object size, MIME signature, checksum, ownership, and upload state. Quarantine until ClamAV and parser-safe normalization complete. Never send customer files to public malware scanning services. Run FFmpeg, ImageMagick, OCR, and ExifTool in restricted containers with resource, syscall, network, and time limits.

## Voice and likeness safety
The platform never offers unrestricted cloning. Professional voice workflows require the living subject to complete provider verification in their own identity context. Another person cannot create that professional clone on the subject's behalf. Deceased-person cloning from archived recordings is prohibited. Generated narration carries provenance and disclosure metadata. Any suspected impersonation freezes generation and sharing pending review.

## Editorial and defamation safeguards
High-risk claims involving crimes, abuse, parentage, health, sexuality, finances, immigration, or misconduct receive restricted defaults and a publication review gate. The model cannot convert allegations into stated fact. Living-person allegations require source attribution, owner review, and legal review when publication risk is material.

## Secrets and logs
Secrets live only in secret managers or environment injection, never source. Logs exclude transcript text, images, prompts, names, filenames, addresses, access tokens, signed URLs, and provider payloads. Stable error codes replace sensitive values.

## Encryption and keys
TLS in transit. Provider storage encryption plus application envelope encryption for restricted fields. Per-archive data keys wrapped by KMS. Keys rotate and are versioned. Temporary media scratch is encrypted and wiped. Backups are encrypted and restoration-tested.

## AI and prompt injection
Uploaded content is untrusted evidence, never instruction. The gateway separates policies from source text, scans for injection patterns, constrains output to schemas, validates citations, and rejects tool or command requests embedded in documents. Prohibited content is redacted before external processing.

## API protections
Strict CORS allowlist, CSRF defenses for cookie-authenticated mutations, secure headers, body and upload limits, per-user and per-archive rate limits, webhook signatures, idempotency keys, replay protection, SSRF-resistant fetch allowlists, and no arbitrary URL ingestion.

## Safe migrations and production data
Use expand-migrate-contract. No destructive production query outside reviewed migrations or documented deletion jobs. Developers do not download production media. Support content access is approved, time-limited, visible, and audited.

## Dependency policy
Exact versions and lockfile required. Critical or high exploitable vulnerabilities block release unless a time-bounded ADR documents reachability, compensating control, owner, and expiry.

## Security checks
scripts/security-check.sh verifies secret scanning, dependency policy, insecure patterns, headers, authorization tests, upload constraints, log redaction, provider isolation, and rights enforcement. SECURITY STOP conditions are destructive irreversible action not specified, or a legal/security judgment not answered by approved specs.
=== END FILE ===

=== FILE: SUBPROCESSOR_REGISTER.md ===
# Subprocessor Register - Verify Before Launch

| Provider | Function | Data categories | Optional | Launch condition |
|---|---|---|---|---|
| DeepSeek | Redacted editorial language processing | Selected minimized text and pseudonymous evidence IDs | Yes | Contract, transfer, retention, training, deletion, and security review |
| Deepgram | Speech transcription | Selected audio, language and callback metadata | Yes when local fallback selected | Contract, retention, training, deletion, region and security review |
| ElevenLabs | Narration and verified self-voice | Approved text and permitted voice samples | Yes | Voice policy, subject verification, retention, deletion, region and contract review |
| Cloudflare | Edge, WAF, Turnstile, R2, optional Stream | Network metadata and encrypted media objects | No for core hosting | DPA, region, deletion and security review |
| Neon | PostgreSQL | Structured encrypted records | No | DPA, region, backup and security review |
| Upstash | Queue and cache metadata | Job IDs and non-content cache data | No | DPA, region and security review |
| Fly.io | Application and worker compute | Transient application and media data | No | DPA, region, disk and security review |
| Stripe | Billing | Customer and payment references | No for paid plans | DPA and checkout disclosure |
| Resend | Transactional email | Recipient, template data and links | No | DPA and link minimization |
| Sentry/OTel provider | Redacted diagnostics | Pseudonymous technical telemetry | No | Scrubbing validation and DPA |
| Print provider | Physical book fulfillment | Approved edition and shipping details | Yes | Separate approval before integration |
=== END FILE ===

=== FILE: TERMS_OF_SERVICE_DRAFT.md ===
# AI Family Historian Terms of Service Draft - Counsel Review Required

## Service
The service provides private archive, interview, transcription, organization, editing, generation, narration, sharing, export, and publishing tools. It is not a genealogy authority, historian of record, law firm, publisher accepting editorial responsibility, therapist, healthcare provider, or arbiter of family disputes.

## Eligibility and accounts
Account owners must be adults with legal capacity. Users protect credentials, maintain accurate contact information, and remain responsible for invited users.

## Content authority and rights
Users may upload only content they own or are authorized to use. Users retain ownership of source content. They grant the limited license needed to host, process, create requested derivatives, share as instructed, and fulfill approved orders. Rights in AI-assisted output, and any limits imposed by law or providers, must be disclosed without guarantee.

## Consent and other people
Users must obtain legally sufficient recording consent, contributor releases, voice and likeness permission, guardian authority, and publication permission. The service may require evidence, restrict content, or reject a workflow. Users must not secretly record, impersonate, dox, harass, defame, exploit minors, upload intimate content without consent, or synthesize false statements as authentic.

## AI limitations
AI can omit, distort, infer, or invent. Generated content is a draft. Users must review facts, quotations, rights, and publication risk. The service preserves provenance and applies controls but does not guarantee historical accuracy. Direct quotations must come from approved source spans; attempts to represent synthetic text or audio as authentic are prohibited.

## Voice and likeness
Only licensed stock narration and permitted verified self-voice workflows are allowed. Professional cloning of another person and posthumous voice cloning from archive material are prohibited. Provider rules also apply.

## Sensitive claims and disputes
The company may restrict or remove sharing, generation, print, or publication when content presents rights, privacy, safety, defamation, impersonation, or legal risk. Competing family recollections may remain visible as disputed rather than being resolved by the company.

## Fees and pass-through usage
Plans may include storage, transcription, generation, narration, export, and contributor allowances. Overage and physical production require displayed pricing or approval before charge. Refund, cancellation, renewal, tax, failed payment, and chargeback terms must be completed before launch.

## Availability, preservation, and exports
The service uses backups and fixity checks but is not the user's sole archival copy. Users should maintain independent exports. Service levels and discontinuation export periods are stated by plan.

## Privacy and processors
The Privacy Policy and AI Processing Notice govern data handling. Users choose optional processing where available. Provider availability and terms may change, and the company may substitute or disable providers to protect users.

## Prohibited conduct
No unlawful content, infringement, malware, scraping, credential abuse, model extraction, bypassing quotas, unauthorized surveillance, deepfakes, fraudulent impersonation, non-consensual intimate content, child exploitation, public disclosure of private living-person data, or use that threatens safety.

## Takedown and suspension
The company may preserve evidence, restrict access, suspend accounts, and process copyright, privacy, safety, or rights complaints. Notice and appeal procedures apply where appropriate.

## Disclaimers, liability, indemnity, disputes
Counsel must complete enforceable jurisdiction-specific warranty disclaimers, limitation of liability, exclusions, indemnity, arbitration or court selection, class-action treatment, consumer carve-outs, survival, and governing law. Liability cannot be disclaimed where prohibited, and drafting must account for media, privacy, security, and gross-negligence risk.

## Termination and deletion
Users may cancel and export. Termination, deletion, backup expiry, legal holds, disputes, and already distributed copies follow the published policies.

## Changes and contact
Publish legal entity, notices address, effective date, version, change mechanism, and acceptance records before launch.
=== END FILE ===

=== FILE: TESTING.md ===
# Testing

Unit tests cover domain rules. Integration tests use real PostgreSQL, Redis, object storage emulator only when protocol-compatible, and actual provider sandboxes. E2E uses the real web and API entry points. Test doubles are legal only in `tests/unit/doubles` and never in live-fire. Every core outcome maps to a named E2E and live-fire proof. Flaky tests are bugs and cannot be retried until green. Accessibility uses axe and keyboard flows. Performance uses k6. Security includes tenant isolation, IDOR, upload, prompt injection, DLP, consent, deletion, and emergency-access abuse.
=== END FILE ===

=== FILE: VOICE_AND_LIKENESS_POLICY.md ===
# Voice and Likeness Policy

AI Family Historian permits licensed stock narration and a living subject's verified self-voice when the provider and product verification flows are completed. It prohibits professional cloning of another person's voice, posthumous voice cloning from archive recordings, deceptive impersonation, synthetic statements presented as authentic recordings, and unauthorized likeness generation. Every generated audio asset records provider, voice license or verification reference, source text, generation time, disclosure state, approver, and revocation state. Publication and sharing stop immediately when rights are withdrawn or disputed, subject to legal retention of evidence.
=== END FILE ===

=== FILE: scripts/build.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
pnpm build
echo "build: ok"
=== END FILE ===

=== FILE: scripts/dependency-audit.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
pnpm audit --audit-level high
echo "dependency audit: ok"
=== END FILE ===

=== FILE: scripts/format-check.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
pnpm format:check
echo "format check: ok"
=== END FILE ===

=== FILE: scripts/graph-next.sh ===
#!/usr/bin/env sh
# 6LAYER deterministic scheduler. Reads GRAPH-TABLE and the ledger.
# Prints exactly one line:
#   NEXT <id>    first PENDING node whose deps are all DONE
#   RESUME <id>  a node holds an unreleased lease
#   BLOCKED <id> a node is terminally blocked
#   STALL <id>   no eligible node but work remains (graph defect; treat as BLOCKED)
#   ALL_DONE     every node is DONE
set -eu
GRAPH=".agent/GRAPH.md"
[ -f "$GRAPH" ] || { echo "graph-next.sh: missing $GRAPH" >&2; exit 1; }
tmp=$(mktemp)
trap 'rm -f "$tmp" "$tmp.status"' EXIT
awk '
  /^GRAPH-TABLE-BEGIN$/ { t=1; next }
  /^GRAPH-TABLE-END$/   { t=0 }
  t && $1=="NODE"       { print $2, $4 }
' "$GRAPH" > "$tmp"
[ -s "$tmp" ] || { echo "graph-next.sh: GRAPH-TABLE empty or missing" >&2; exit 1; }
: > "$tmp.status"
while read -r id deps; do
  st=$(sh scripts/ledger.sh status "$id")
  printf '%s %s %s\n' "$id" "$st" "$deps" >> "$tmp.status"
done < "$tmp"
blocked=$(awk '$2=="BLOCKED"{print $1; exit}' "$tmp.status")
if [ -n "$blocked" ]; then echo "BLOCKED $blocked"; exit 0; fi
resume=$(awk '$2=="IN_PROGRESS"{print $1; exit}' "$tmp.status")
if [ -n "$resume" ]; then echo "RESUME $resume"; exit 0; fi
next=$(awk '
  { st[$1]=$2; ord[NR]=$1; dep[$1]=$3; n=NR }
  END {
    for (i=1; i<=n; i++) {
      id=ord[i]
      if (st[id]=="PENDING") {
        ok=1
        m=split(dep[id], a, ",")
        for (j=1; j<=m; j++) { d=a[j]; if (d!="-" && st[d]!="DONE") { ok=0; break } }
        if (ok) { print id; exit }
      }
    }
  }
' "$tmp.status")
if [ -n "$next" ]; then
  echo "NEXT $next"
else
  undone=$(awk '$2!="DONE"{print $1; exit}' "$tmp.status")
  if [ -z "$undone" ]; then echo "ALL_DONE"; else echo "STALL $undone"; fi
fi
=== END FILE ===

=== FILE: scripts/install.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
corepack enable && pnpm install --frozen-lockfile
echo "install: ok"
=== END FILE ===

=== FILE: scripts/ledger.sh ===
#!/usr/bin/env sh
# 6LAYER ledger helper. Append-only event writer + status reader.
# The ledger is the single source of runtime truth. Details must not contain " | ".
# Usage:
#   sh scripts/ledger.sh append <AGENT_ID> <NODE|-> <EVENT> [detail...]
#   sh scripts/ledger.sh status <NODE>     -> DONE | BLOCKED | IN_PROGRESS | PENDING
#   sh scripts/ledger.sh tail [n]
set -eu
LEDGER=".agent/state/LEDGER.md"
[ -f "$LEDGER" ] || { echo "ledger.sh: missing $LEDGER (repo not bootstrapped)" >&2; exit 1; }
cmd="${1:-}"
[ -n "$cmd" ] && shift
case "$cmd" in
  append)
    agent="${1:?agent id}"; node="${2:?node id or -}"; event="${3:?event}"; shift 3
    detail="${*:-}"
    ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    printf '%s | %s | %s | %s | %s\n' "$ts" "$agent" "$node" "$event" "$detail" >> "$LEDGER"
    ;;
  status)
    node="${1:?node id}"
    line=$(grep -E "\| $node \| (NODE_DONE|NODE_BLOCKED|LEASE_RELEASE|LEASE) \|" "$LEDGER" | tail -n 1)
    case "$line" in
      *"| NODE_DONE |"*)     echo DONE ;;
      *"| NODE_BLOCKED |"*)  echo BLOCKED ;;
      *"| LEASE_RELEASE |"*) echo PENDING ;;
      *"| LEASE |"*)         echo IN_PROGRESS ;;
      *)                     echo PENDING ;;
    esac
    ;;
  tail)
    n="${1:-30}"
    tail -n "$n" "$LEDGER"
    ;;
  *)
    echo "usage: ledger.sh append|status|tail ..." >&2
    exit 2
    ;;
esac
=== END FILE ===

=== FILE: scripts/lint.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
pnpm lint
echo "lint: ok"
=== END FILE ===

=== FILE: scripts/live-fire.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "live-fire: ERROR - package.json missing; complete EP-001" >&2; exit 1; }
pnpm exec tsx tests/live-fire/run.ts --proof archive-membership
pnpm exec tsx tests/live-fire/run.ts --proof consented-interview
pnpm exec tsx tests/live-fire/run.ts --proof multipart-media-ingestion
pnpm exec tsx tests/live-fire/run.ts --proof evidence-extraction
pnpm exec tsx tests/live-fire/run.ts --proof timeline-disputes
pnpm exec tsx tests/live-fire/run.ts --proof cited-memoir-draft
pnpm exec tsx tests/live-fire/run.ts --proof book-pdf-epub
pnpm exec tsx tests/live-fire/run.ts --proof authorized-narration
pnpm exec tsx tests/live-fire/run.ts --proof private-family-portal
pnpm exec tsx tests/live-fire/run.ts --proof portable-export
pnpm exec tsx tests/live-fire/run.ts --proof verified-deletion
pnpm exec tsx tests/live-fire/run.ts --proof rights-and-consent
pnpm exec tsx tests/live-fire/run.ts --proof sensitive-claim-gate
pnpm exec tsx tests/live-fire/run.ts --proof ai-cache-telemetry
pnpm exec tsx tests/live-fire/run.ts --proof billing-and-quotas
pnpm exec tsx tests/live-fire/run.ts --proof annual-preservation-review
echo "live-fire: ok"
=== END FILE ===

=== FILE: scripts/preflight.sh ===
#!/usr/bin/env sh
set -eu
fail() { echo "preflight: FAIL - $1" >&2; exit 1; }
[ -f AGENTS.md ] && [ -d .agent ] || fail "run from repository root"
for f in AGENTS.md COMMANDS.md PREFLIGHT.md .env.example .agent/GRAPH.md .agent/LOOPS.md .agent/state/LEDGER.md .agent/reality-patterns .agent/reality-allow; do [ -f "$f" ] || fail "missing required file: $f"; done
for t in git awk grep sed curl jq openssl node corepack pnpm docker; do command -v "$t" >/dev/null 2>&1 || fail "missing required tool: $t"; done
[ -f .env ] || fail "missing .env (copy .env.example, fill every REQUIRED value, rerun)"
set -a; . ./.env; set +a
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
awk '/^PREFLIGHT-TABLE-BEGIN$/{t=1;next} /^PREFLIGHT-TABLE-END$/{t=0} t && NF' PREFLIGHT.md > "$TMP"
[ -s "$TMP" ] || fail "PREFLIGHT-TABLE missing or empty"
if command -v timeout >/dev/null 2>&1; then TCMD="timeout 30"; else TCMD=""; fi
while IFS='|' read -r var req probe; do
  eval "val=\${$var:-}"
  if [ -z "$val" ]; then [ "$req" = OPTIONAL ] && continue; fail "env var not set: $var"; fi
  if [ "$probe" != "-" ]; then [ -f "$probe" ] || fail "missing probe: $probe"; $TCMD sh "$probe" >/dev/null 2>&1 || fail "credential probe failed: $var"; fi
done < "$TMP"
echo "preflight: ok"
=== END FILE ===

=== FILE: scripts/probes/database_url.sh ===
#!/usr/bin/env sh
set -eu
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "select 1" | grep -qx 1
=== END FILE ===

=== FILE: scripts/probes/deepgram_api_key.sh ===
#!/usr/bin/env sh
set -eu
: "${DEEPGRAM_API_KEY:?}"
curl -fsS --max-time 20 -H "Authorization: Token $DEEPGRAM_API_KEY" https://api.deepgram.com/v1/projects >/dev/null
=== END FILE ===

=== FILE: scripts/probes/deepseek_api_key.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 -H "Authorization: Bearer $DEEPSEEK_API_KEY" "$DEEPSEEK_BASE_URL/models" >/dev/null
=== END FILE ===

=== FILE: scripts/probes/elevenlabs_api_key.sh ===
#!/usr/bin/env sh
set -eu
: "${ELEVENLABS_API_KEY:?}"
curl -fsS --max-time 20 -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/user >/dev/null
=== END FILE ===

=== FILE: scripts/probes/fly.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 -H "Authorization: Bearer $FLY_API_TOKEN" https://api.fly.io/graphql -H "content-type: application/json" --data-binary "{"query":"query { viewer { email } }"}" >/dev/null
=== END FILE ===

=== FILE: scripts/probes/github.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 -H "Authorization: Bearer $GHCR_TOKEN" https://api.github.com/user >/dev/null
=== END FILE ===

=== FILE: scripts/probes/otel.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 -I "$OTEL_EXPORTER_OTLP_ENDPOINT" >/dev/null || [ $? -eq 22 ]
=== END FILE ===

=== FILE: scripts/probes/r2.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 "$R2_ENDPOINT" >/dev/null || [ $? -eq 22 ]
=== END FILE ===

=== FILE: scripts/probes/redis_url.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 "${REDIS_HTTP_URL:-https://example.invalid}" >/dev/null
=== END FILE ===

=== FILE: scripts/probes/resend.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains >/dev/null
=== END FILE ===

=== FILE: scripts/probes/sentry.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 "${SENTRY_DSN%/*}" >/dev/null || [ $? -eq 22 ]
=== END FILE ===

=== FILE: scripts/probes/stripe.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 -u "$STRIPE_SECRET_KEY:" https://api.stripe.com/v1/balance >/dev/null
=== END FILE ===

=== FILE: scripts/probes/turnstile.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 https://challenges.cloudflare.com/turnstile/v0/siteverify -d "secret=$TURNSTILE_SECRET_KEY" -d "response=preflight-invalid-token" >/dev/null
=== END FILE ===

=== FILE: scripts/probes/twilio.sh ===
#!/usr/bin/env sh
set -eu
curl -fsS --max-time 20 -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json" >/dev/null
=== END FILE ===

=== FILE: scripts/production-readiness-check.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
sh scripts/verify.sh
for f in compliance/evidence/counsel-approval.md compliance/evidence/deepseek-vendor-review.md compliance/evidence/dpia-approved.md compliance/evidence/insurance-certificate.md compliance/evidence/retention-schedule-approved.md compliance/evidence/data-region-verification.md compliance/evidence/data-broker-determination.md; do
  [ -s "$f" ] || { echo "production readiness: missing $f" >&2; exit 1; }
done
echo "production readiness: ok"
=== END FILE ===

=== FILE: scripts/reality-gate.sh ===
#!/usr/bin/env sh
# 6LAYER reality gate: lexical layer of the no-mock law.
set -eu
PAT=".agent/reality-patterns"
ALLOW=".agent/reality-allow"
[ -f "$PAT" ] || { echo "reality gate: missing $PAT" >&2; exit 1; }
[ -f "$ALLOW" ] || { echo "reality gate: missing $ALLOW" >&2; exit 1; }
SRC_DIRS="apps packages"
hits=0
for d in $SRC_DIRS; do
  [ -d "$d" ] || continue
  out=$(grep -RInE -f "$PAT" "$d" 2>/dev/null | grep -vE -f "$ALLOW" || true)
  if [ -n "$out" ]; then printf '%s
' "$out"; hits=1; fi
done
[ "$hits" -eq 0 ] || { echo "reality gate: FAIL (forbidden implementation markers listed above)" >&2; exit 1; }
echo "reality gate: ok"
=== END FILE ===

=== FILE: scripts/security-check.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
pnpm security:check
echo "security check: ok"
=== END FILE ===

=== FILE: scripts/smoke-test.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
pnpm smoke
echo "smoke test: ok"
=== END FILE ===

=== FILE: scripts/test-e2e.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
pnpm test:e2e
echo "e2e tests: ok"
=== END FILE ===

=== FILE: scripts/test-integration.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
pnpm test:integration
echo "integration tests: ok"
=== END FILE ===

=== FILE: scripts/test-unit.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
pnpm test:unit
echo "unit tests: ok"
=== END FILE ===

=== FILE: scripts/typecheck.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
pnpm typecheck
echo "typecheck: ok"
=== END FILE ===

=== FILE: scripts/verify.sh ===
#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
sh scripts/preflight.sh
sh scripts/lint.sh
sh scripts/format-check.sh
sh scripts/typecheck.sh
sh scripts/test-unit.sh
sh scripts/test-integration.sh
sh scripts/test-e2e.sh
sh scripts/build.sh
sh scripts/security-check.sh
sh scripts/dependency-audit.sh
sh scripts/reality-gate.sh
sh scripts/smoke-test.sh
sh scripts/live-fire.sh
echo "verify: ok"
=== END FILE ===


# How to Use This Blueprint Pack

See HOW_TO_USE.md in the materialized repository.

=== PACK COMPLETE: 122 FILES ===
