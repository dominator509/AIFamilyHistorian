#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
worker_image="${WORKER_IMAGE:-family-historian-worker:local}"
repo_root=$(pwd -W 2>/dev/null || pwd)
internal_network=''
if [ -f .env ] && docker image inspect "$worker_image" >/dev/null 2>&1 && docker compose exec -T postgres true </dev/null >/dev/null 2>&1; then
  internal_network=$(docker network ls --filter label=com.docker.compose.network=family_historian_internal --format '{{.Name}}' | awk 'NR == 1 { print; exit }')
fi
if [ -n "$internal_network" ]; then
  set -a
  . ./.env
  set +a
  internal_db=$(DATABASE_URL="$DATABASE_URL" node --input-type=module -e "const u=new URL(process.env.DATABASE_URL); u.hostname='postgres'; u.port='5432'; process.stdout.write(u.toString())")
  mount_args=''
  for source_dir in apps/*/src packages/*/src; do
    mount_args="$mount_args --mount type=bind,source=$repo_root/$source_dir,target=/app/$source_dir,readonly"
  done
  echo "e2e tests: isolated internal runner enabled"
  MSYS_NO_PATHCONV=1 docker run --rm \
    --network "$internal_network" \
    --env-file .env \
    -v "$repo_root/.env:/app/.env:ro" \
    -v "$repo_root/tests:/app/tests:ro" \
    -v "$repo_root/drizzle:/app/drizzle:ro" \
    -e CI=true \
    -e NODE_ENV=test \
    -e DATABASE_URL="$internal_db" \
    -e R2_ENDPOINT=http://object-storage:9000 \
    $mount_args \
    "$worker_image" \
    /app/node_modules/.bin/vitest run tests/e2e
  echo "e2e tests: ok"
  exit 0
fi
corepack pnpm test:e2e
echo "e2e tests: ok"
