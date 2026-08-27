# AI Family Historian

AI Family Historian is a privacy-first family memory preservation service. It organizes verified life information, protects sensitive records, isolates optional AI processing, and produces trustworthy emergency and executor-preparation outputs.

The project does not provide legal, medical, tax, financial-advisory, fiduciary, or secret-custody services.

## Current status

The repository is under active engineering hardening. Local code and verification gates are maintained fail-closed. Production release still requires the provider credentials, deployment targets, legal and vendor approvals, retention evidence, and hosted worker-sandbox attestation listed in `PREFLIGHT.md`.

## Requirements

- Node.js 24.4.1 through 24.x
- Corepack with pnpm 10.13.1
- Docker and Docker Compose
- The additional local media tools listed in `PREFLIGHT.md` for full media verification

## Local development

From the repository root:

```sh
sh scripts/install.sh
sh scripts/generate-local-env.sh
docker compose up -d --wait
sh scripts/verify.sh
docker compose down
```

The generated `.env` is local-only and must never be committed. Complete every required value in `PREFLIGHT.md` before treating `preflight: ok` as available.

## Checks

The canonical commands are documented in `COMMANDS.md`. Common focused checks are:

```sh
sh scripts/lint.sh
sh scripts/typecheck.sh
sh scripts/test-unit.sh
sh scripts/security-check.sh
sh scripts/secret-scan.sh
```

Production readiness is fail-closed by `sh scripts/production-readiness-check.sh` and requires the external evidence and approvals described in `PREFLIGHT.md`.

## Repository guidance

- `AGENTS.md` is the repository control plane.
- `PREFLIGHT.md` defines required credentials and release evidence.
- `DEPLOYMENT.md` defines the manual, digest-pinned deployment procedure.
- `SECURITY.md` defines security and data-handling boundaries.

Do not place customer secrets, raw sensitive payloads, access tokens, or unredacted model content in source, logs, tickets, analytics, traces, or prompts.
