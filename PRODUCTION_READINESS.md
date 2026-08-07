# Production Readiness

Current status is **MAXIMUM_ENGINEERING_COMPLETE**, not production approved. All sixteen locally executable live-fire proofs pass against real local PostgreSQL, Redis, MinIO, Mailpit, and OTLP services, including the authenticated DeepSeek cache/provenance proof. Lint, formatting, typecheck, unit, integration, E2E, build, security, dependency, reality, and smoke gates pass locally.

`sh scripts/verify.sh` and `sh scripts/production-readiness-check.sh` remain fail-closed at `env var not set: DEEPGRAM_API_KEY`. Hosted provider probes, CI/staging/deployment verification, backup/restore drills, formal accessibility/performance audits, production secret injection, and legal/vendor/insurance/DPIA/data-region approvals remain unverified. No production release tag or deployment may be claimed until those gates emit their genuine sentinels.

The authoritative deferred register is `.agent/state/DEFERRED_EXTERNALS.md`; the current repository state and exact resume commands are in `REMOTE_SESSION_HANDOFF.md`.
