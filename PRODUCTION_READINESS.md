# Production Readiness

Current status is **ENGINEERING CONTINUATION IN PROGRESS; NOT PRODUCTION APPROVED**. The repository is not a release candidate: the graph remains `RESUME EP-000`, no green release tag exists, and no production deployment has been attempted.

## Verified local engineering

- Real local PostgreSQL, Redis, MinIO, Mailpit, OpenTelemetry, ClamAV, FFmpeg, OCR, and media-worker flows are covered by the internal Compose runner.
- Unit: 27 files / 134 tests. Integration: 13 files / 41 tests. E2E: 3 files / 11 tests. All 16 live-fire proofs pass.
- Typecheck, lint, format, build, security baseline, secret scan, dependency, reality, smoke, and encrypted backup/restore checks pass at the current source checkpoint.
- Outbox leases renew and are token-fenced. Privacy, export, and narration intake transactions lock their active lease before authoritative writes. Media quarantine transitions are row-locked and compare-and-set; multipart storage completion validates provider-facing manifests independently of HTTP schemas.
- Local worker isolation is declared read-only, capability-free, no-new-privileges, PID/memory/CPU bounded, scratch-bounded, and internal-network-only. These declarations do not prove hosted isolation.
- The worker now serves loopback-only `/health/live` and `/health/ready` endpoints; readiness follows Redis dependency state and is cleared during shutdown, so the image healthcheck reflects the actual worker process without creating a public listener.
- HARDENING-135 additionally guards the Fly worker against accidental public service routing; the manifest and security harness require no public worker service declarations, while hosted syscall, egress, cgroup/PID, read-only-root, and scratch attestation remain separate release gates.
- The read-only runtime image preinstalls pinned pnpm under an image-owned Corepack home; the rebuilt worker stayed `Up (healthy)` in the real internal Compose stack. The local rehearsal is explicitly development-mode for its internal HTTP MinIO endpoint; hosted Fly remains production/HTTPS-only.
- HARDENING-89 additionally pins CI actions to reviewed immutable commit SHAs and the Node Docker base to a reviewed OCI digest; the security harness rejects mutable action references and undigested Node base lines. Workflow YAML, API/worker image builds, security, typecheck, and format checks pass locally.

## Engineering work still pending

- Implement and verify privacy fulfillment, export generation, transcription, narration synthesis, and deletion execution workers. Current intake handlers intentionally stop at review-required states and unsupported job types fail closed.
- Complete native Better Auth/passkey/WebAuthn and Argon2id identity issuance, migration, device lifecycle, and live-fire coverage.
- Tagged PDF structure semantics and EPUB language/navigation metadata are implemented and regression-tested; complete formal accessibility/PDF/EPUB audits, large-transfer/recovery rehearsal, hosted queue topology/fairness, production KMS wrapping/restore drills, and hosted media/provider fixtures remain pending.
- `sh scripts/accessibility-check.sh` now provides a deterministic local semantic probe for those PDF/EPUB invariants; it does not claim formal PDF/UA or screen-reader conformance.

## External and release gates

`sh scripts/production-readiness-check.sh` currently fails closed with **16 unresolved requirements**. The unresolved set includes the Resend credential probe, Turnstile, Sentry, GitHub, Fly.io, legal/vendor/insurance/DPIA/retention artifacts, and the required `WORKER_SANDBOX_EVIDENCE_FILE` attestation for hosted syscall, network-egress, cgroup/PID, read-only-root, and bounded-scratch controls.

Production secrets must be injected through the approved secret manager; credentials pasted into chat must be rotated before use. Hosted provider delivery, CI/staging, DNS/certificates, production migrations, rollback, legal approvals, insurance, vendor/DPA review, data-region/data-broker determinations, and explicit release authorization remain unverified.

The authoritative external register is `.agent/state/DEFERRED_EXTERNALS.md`. The exact current checkpoint and resume commands are in `REMOTE_SESSION_HANDOFF.md`.
