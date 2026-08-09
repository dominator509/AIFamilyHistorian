#!/usr/bin/env sh
set -eu
: "${SENTRY_DSN:?}"
: "${SENTRY_AUTH_TOKEN:?}"
sentry_origin=$(SENTRY_DSN="$SENTRY_DSN" node -p "new URL(process.env.SENTRY_DSN).origin")
export PROBE_URL="$sentry_origin/api/0/"
export PROBE_SECRET_ENV=SENTRY_AUTH_TOKEN
export PROBE_HEADER_NAME=Authorization
export PROBE_HEADER_PREFIX='Bearer '
exec node scripts/probes/http_request.mjs
