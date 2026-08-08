#!/usr/bin/env sh
set -eu
: "${SENTRY_DSN:?}"
: "${SENTRY_AUTH_TOKEN:?}"
sentry_origin=$(node -p "new URL(process.argv[1]).origin" "$SENTRY_DSN")
curl -fsS --max-time 20 \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "$sentry_origin/api/0/" >/dev/null
