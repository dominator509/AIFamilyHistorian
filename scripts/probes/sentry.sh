#!/usr/bin/env sh
set -eu
: "${SENTRY_DSN:?}"
: "${SENTRY_AUTH_TOKEN:?}"
# A Sentry DSN points at an event-ingest host, which does not serve the
# authenticated management API. Validate the auth token against Sentry's
# global API host instead of appending /api/0/ to the DSN origin.
export PROBE_URL='https://sentry.io/api/0/'
export PROBE_SECRET_ENV=SENTRY_AUTH_TOKEN
export PROBE_HEADER_NAME=Authorization
export PROBE_HEADER_PREFIX='Bearer '
exec node scripts/probes/http_request.mjs
