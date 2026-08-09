#!/usr/bin/env sh
set -eu
: "${TURNSTILE_SECRET_KEY:?}"
export PROBE_URL='https://challenges.cloudflare.com/turnstile/v0/siteverify'
export PROBE_FORM_SECRET_ENV=TURNSTILE_SECRET_KEY
export PROBE_FORM_RESPONSE=preflight-invalid-token
exec node scripts/probes/http_request.mjs
