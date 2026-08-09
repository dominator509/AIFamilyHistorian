#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "ERROR: package.json is created during EP-001; see .agent/execplans/EP-001-foundation.md" >&2; exit 1; }
worker_image="${WORKER_IMAGE:-family-historian-worker:local}"
repo_root=$(pwd -W 2>/dev/null || pwd)

# Compose deliberately keeps the database, Redis, and object-storage services
# on an internal-only network. When those services are healthy but their host
# ports are not published, run the complete integration suite from a disposable
# worker-image container on that same network instead of falsely treating a
# host-port refusal as an application failure.
internal_network=''
clamav_volume=''
if [ -f .env ] && docker image inspect "$worker_image" >/dev/null 2>&1 && docker compose exec -T postgres true </dev/null >/dev/null 2>&1; then
  internal_network=$(docker network ls --filter label=com.docker.compose.network=family_historian_internal --format '{{.Name}}' | awk 'NR == 1 { print; exit }')
  clamav_volume=$(docker volume ls --filter label=com.docker.compose.volume=clamav_signatures --format '{{.Name}}' | awk 'NR == 1 { print; exit }')
fi
if [ -n "$internal_network" ]; then
  mount_args=''
  for source_dir in apps/*/src packages/*/src; do
    mount_args="$mount_args --mount type=bind,source=$repo_root/$source_dir,target=/app/$source_dir,readonly"
  done
  if [ -n "$clamav_volume" ]; then
    mount_args="$mount_args --mount type=volume,source=$clamav_volume,target=/var/lib/clamav,readonly"
  fi
  echo "integration tests: isolated internal runner enabled"
  MSYS_NO_PATHCONV=1 docker run --rm \
    --network "$internal_network" \
    --env-file .env \
    -v "$repo_root/.env:/app/.env:ro" \
    -v "$repo_root/tests:/app/tests:ro" \
    -v "$repo_root/drizzle:/app/drizzle:ro" \
    -e CI=true \
    -e NODE_ENV=test \
    -e R2_ENDPOINT=http://object-storage:9000 \
    -e MAILPIT_HTTP_URL=http://smtp:8025 \
    -e LOCAL_TELEMETRY_HEALTH_URL=http://telemetry:13133/ \
    $mount_args \
    "$worker_image" \
    sh -ec '
      export DATABASE_URL="$(node --input-type=module -e "const u=new URL(process.env.DATABASE_URL); u.hostname=\"postgres\"; u.port=\"5432\"; process.stdout.write(u.toString())")"
      export REDIS_URL="$(node --input-type=module -e "const u=new URL(process.env.REDIS_URL); u.hostname=\"redis\"; u.port=\"6379\"; process.stdout.write(u.toString())")"
      exec /app/node_modules/.bin/vitest run tests/integration
    '
  echo "integration tests: ok"
  exit 0
fi
corepack pnpm test:integration
echo "integration tests: ok"
