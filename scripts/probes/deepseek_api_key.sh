#!/usr/bin/env sh
set -eu
: "${DEEPSEEK_API_KEY:?}"
base_url="${DEEPSEEK_BASE_URL:-https://api.deepseek.com}"
export PROBE_URL="$base_url/models"
export PROBE_SECRET_ENV=DEEPSEEK_API_KEY
export PROBE_HEADER_NAME=Authorization
export PROBE_HEADER_PREFIX='Bearer '
exec node scripts/probes/http_request.mjs
