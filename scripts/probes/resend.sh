#!/usr/bin/env sh
set -eu
: "${RESEND_API_KEY:?}"
export PROBE_URL='https://api.resend.com/domains'
export PROBE_SECRET_ENV=RESEND_API_KEY
export PROBE_HEADER_NAME=Authorization
export PROBE_HEADER_PREFIX='Bearer '
exec node scripts/probes/http_request.mjs
