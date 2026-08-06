# Commands

Export `CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive`. Legal commands are `sh scripts/install.sh`, `preflight.sh`, `lint.sh`, `format-check.sh`, `typecheck.sh`, `test-unit.sh`, `test-integration.sh`, `test-e2e.sh`, `build.sh`, `security-check.sh`, `dependency-audit.sh`, `smoke-test.sh`, `live-fire.sh`, `verify.sh`, and `production-readiness-check.sh`. Local start: `corepack pnpm --filter @family-historian/api start >.agent/state/api.log 2>&1 & echo $! >.agent/state/api.pid`; probe with curl and kill using the PID file. Adapter parity: `for f in AGENTS.md CLAUDE.md HERMES.md OPENCLAW.md; do awk '/PRIME-BLOCK-BEGIN/,/PRIME-BLOCK-END/' "$f" | cksum; done`. Coding agents must not invent commands. If a command is missing or stale, update this file first, citing repository evidence, with a Decision Log entry.

Repository bootstrap and bounded diagnostics authorized by the unattended-build instruction:

- Working tree: `git status --short --branch`; current commit: `git rev-parse HEAD`; disk: `df -h .`.
- Tool versions: `git --version`, `node --version`, `corepack --version`, `pnpm --version`, `docker version`, `docker compose version`, `psql --version`, `ffmpeg -version`, `ffprobe -version`, `exiftool -ver`, `magick -version`, `clamscan --version`, `ocrmypdf --version`, and `python --version`.
- Generate ignored local configuration without printing secrets: `sh scripts/generate-local-env.sh`; replace only an agent-generated local file when local service credentials must be rotated: `sh scripts/generate-local-env.sh --force`.
- Validate shell scripts without executing them: `sh -n scripts/*.sh scripts/probes/*.sh`.
- Local dependency lifecycle after EP-001 materializes Compose: `docker compose up -d --wait`; inspect with `docker compose ps`; stop with `docker compose down`.
- Reset only agent-created local development volumes when deterministic initialization is invalid and no project data exists: `docker compose down --volumes`.
- Validate Compose without starting services: `docker compose config --quiet`.
- Prove local dependency connectivity: `sh scripts/local-services-check.sh`.
- Diagnose a local port collision without mutation: `docker ps --filter publish=<port>`.
- Verify an exact container tag before adding it: `docker manifest inspect <image:tag>`.
- Verify exact npm package metadata before adding it: `pnpm view <package>@<version> version`.
- Materialize the lockfile after an intentional dependency change: `corepack pnpm install --no-frozen-lockfile`; normal installs remain `sh scripts/install.sh`.
- Create only plan-authorized repository directories before applying files: `mkdir -p <paths>`.
- Mechanically format implementation/config files after review: `corepack pnpm exec prettier --write apps packages tests package.json pnpm-workspace.yaml tsconfig.json tsconfig.base.json tsconfig.eslint.json eslint.config.mjs compose.yaml infra`.
- Apply local/test migrations: `corepack pnpm --filter @family-historian/database migrate`; verify schema invariants: `corepack pnpm --filter @family-historian/database verify`.
