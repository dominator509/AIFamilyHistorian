#!/usr/bin/env sh
set -eu
: "${STRIPE_SECRET_KEY:?}"
export PROBE_URL='https://api.stripe.com/v1/balance'
export PROBE_BASIC_USER_ENV=STRIPE_SECRET_KEY
exec node scripts/probes/http_request.mjs
