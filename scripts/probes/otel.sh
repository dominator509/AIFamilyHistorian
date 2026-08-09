#!/usr/bin/env sh
set -eu
if curl -fsS --max-time 20 -I "$OTEL_EXPORTER_OTLP_ENDPOINT" >/dev/null; then
  exit 0
fi

# The local Compose stack intentionally keeps service traffic on its internal
# network. If host port forwarding is unavailable, probe the real collector
# over that network from the already-built worker image; do not turn this into
# a synthetic success when the service is absent.
worker_image="${WORKER_IMAGE:-family-historian-worker:local}"
internal_network=''
telemetry_container=''
if [ -f .env ] && docker image inspect "$worker_image" >/dev/null 2>&1; then
  telemetry_container=$(docker compose ps -q telemetry 2>/dev/null || true)
fi
if [ -n "$telemetry_container" ]; then
  internal_network=$(docker network ls --filter label=com.docker.compose.network=family_historian_internal --format '{{.Name}}' | awk 'NR == 1 { print; exit }')
fi
if [ -n "$internal_network" ]; then
  if MSYS_NO_PATHCONV=1 docker run --rm --network "$internal_network" "$worker_image" \
    node --input-type=module -e "const response=await fetch('http://telemetry:4318'); if (response.status >= 500) process.exit(1)" \
    >/dev/null 2>&1; then
    exit 0
  fi
fi
exit 1
