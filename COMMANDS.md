# Commands

Export `CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive`. Legal commands are `sh scripts/install.sh`, `preflight.sh`, `lint.sh`, `format-check.sh`, `typecheck.sh`, `test-unit.sh`, `test-integration.sh`, `test-e2e.sh`, `build.sh`, `security-check.sh`, `dependency-audit.sh`, `smoke-test.sh`, `live-fire.sh`, `verify.sh`, and `production-readiness-check.sh`. Local start: `corepack pnpm --filter @family-historian/api start >.agent/state/api.log 2>&1 & echo $! >.agent/state/api.pid`; probe with curl and kill using the PID file. Adapter parity: `for f in AGENTS.md CLAUDE.md HERMES.md OPENCLAW.md; do awk '/PRIME-BLOCK-BEGIN/,/PRIME-BLOCK-END/' "$f" | cksum; done`. Coding agents must not invent commands. If a command is missing or stale, update this file first, citing repository evidence, with a Decision Log entry.

Repository bootstrap and bounded diagnostics authorized by the unattended-build instruction:

- Working tree: `git status --short --branch`; current commit: `git rev-parse HEAD`; disk: `df -h .`.
- Tool versions: `git --version`, `node --version`, `corepack --version`, `pnpm --version`, `docker version`, `docker compose version`, `psql --version`, `ffmpeg -version`, `ffprobe -version`, `exiftool -ver`, `magick -version`, `clamscan --version`, `ocrmypdf --version`, and `python --version`.
- Generate ignored local configuration without printing secrets: `sh scripts/generate-local-env.sh`; replace only an agent-generated local file when local service credentials must be rotated: `sh scripts/generate-local-env.sh --force`.
- Validate authenticated Deepgram transcription against the documented sample fixture after exporting `.env`: `sh scripts/probes/deepgram_transcription.sh`.
- Validate Stripe test-mode checkout creation against the configured price after exporting `.env`: `sh scripts/probes/stripe_checkout.sh`.
- Ensure the ignored local backup-encryption key exists without rotating other local credentials: `sh scripts/ensure-local-backup-key.sh`.
- Validate shell scripts without executing them: `sh -n scripts/*.sh scripts/probes/*.sh`.
- Local dependency lifecycle after EP-001 materializes Compose: `docker compose up -d --wait`; inspect with `docker compose ps`; stop with `docker compose down`.
- Reset only agent-created local development volumes when deterministic initialization is invalid and no project data exists: `docker compose down --volumes`.
- Validate Compose without starting services: `docker compose config --quiet`.
- Prove local dependency connectivity: `sh scripts/local-services-check.sh`.
- Create a local AES-256-GCM encrypted PostgreSQL custom-format backup with a checksum: `sh scripts/backup.sh`.
- Restore a supplied encrypted local backup into an isolated temporary database and run the schema smoke check: `sh scripts/restore-check.sh <backup.dump.enc>`.
- Check optional local media executables without claiming a media live-fire pass: `sh scripts/media-tools-check.sh`.
- Run the bounded local API latency smoke (health endpoint, 100 samples): `sh scripts/performance-smoke.sh`.
- Diagnose a local port collision without mutation: `docker ps --filter publish=<port>`.
- Verify an exact container tag before adding it: `docker manifest inspect <image:tag>`.
- Verify exact npm package metadata before adding it: `pnpm view <package>@<version> version`.
- Materialize the lockfile after an intentional dependency change: `corepack pnpm install --no-frozen-lockfile`; normal installs remain `sh scripts/install.sh`.
- Create only plan-authorized repository directories before applying files: `mkdir -p <paths>`.
- Mechanically format implementation/config files after review: `corepack pnpm exec prettier --write apps packages tests package.json pnpm-workspace.yaml tsconfig.json tsconfig.base.json tsconfig.eslint.json eslint.config.mjs compose.yaml infra`.
- Apply local/test migrations: `corepack pnpm --filter @family-historian/database migrate`; verify schema invariants: `corepack pnpm --filter @family-historian/database verify`.
