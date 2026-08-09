#!/usr/bin/env sh
set -eu

set -a
. ./.env
set +a

sh scripts/probes/database_url.sh
sh scripts/probes/redis_url.sh
sh scripts/probes/r2.sh

worker_image="${WORKER_IMAGE:-family-historian-worker:local}"
internal_network=''
if docker image inspect "$worker_image" >/dev/null 2>&1 && docker compose ps -q smtp >/dev/null 2>&1; then
  internal_network=$(docker network ls --filter label=com.docker.compose.network=family_historian_internal --format '{{.Name}}' | awk 'NR == 1 { print; exit }')
fi

probe_internal_http() {
  service="$1"
  port="$2"
  path="$3"
  [ -n "$internal_network" ] || return 1
  MSYS_NO_PATHCONV=1 docker run --rm --network "$internal_network" "$worker_image" \
    node --input-type=module -e "const response=await fetch('http://${service}:${port}${path}'); if (!response.ok) process.exit(1)" \
    >/dev/null 2>&1
}

if ! curl -fsS --max-time 10 "${MAILPIT_HTTP_URL:-http://localhost:18025}/api/v1/info" >/dev/null; then
  probe_internal_http smtp 8025 /api/v1/info
fi
if ! curl -fsS --max-time 10 http://127.0.0.1:13134/ >/dev/null; then
  probe_internal_http telemetry 13133 /
fi

echo 'local services: ok'
