#!/usr/bin/env sh
set -eu
: "${DEEPGRAM_API_KEY:?}"
export PROBE_URL='https://api.deepgram.com/v1/projects'
export PROBE_SECRET_ENV=DEEPGRAM_API_KEY
export PROBE_HEADER_NAME=Authorization
export PROBE_HEADER_PREFIX='Token '
exec node scripts/probes/http_request.mjs
