#!/usr/bin/env sh
set -eu

set -a
. ./.env
set +a

sh scripts/probes/database_url.sh
sh scripts/probes/redis_url.sh
sh scripts/probes/r2.sh
curl -fsS --max-time 10 "${MAILPIT_HTTP_URL:-http://localhost:18025}/api/v1/info" >/dev/null
curl -fsS --max-time 10 http://127.0.0.1:13134/ >/dev/null

echo 'local services: ok'
