#!/usr/bin/env sh
set -eu
: "${ELEVENLABS_API_KEY:?}"
export PROBE_URL='https://api.elevenlabs.io/v1/user'
export PROBE_SECRET_ENV=ELEVENLABS_API_KEY
export PROBE_HEADER_NAME=xi-api-key
exec node scripts/probes/http_request.mjs
