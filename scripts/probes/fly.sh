#!/usr/bin/env sh
set -eu
: "${FLY_API_TOKEN:?}"
export PROBE_URL='https://api.fly.io/graphql'
export PROBE_SECRET_ENV=FLY_API_TOKEN
export PROBE_HEADER_NAME=Authorization
export PROBE_HEADER_PREFIX='Bearer '
export PROBE_HEADERS_JSON='{"content-type":"application/json"}'
export PROBE_BODY='{"query":"query { viewer { email } }"}'
exec node scripts/probes/http_request.mjs
