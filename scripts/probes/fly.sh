#!/usr/bin/env sh
set -eu
: "${FLY_API_TOKEN:?}"
curl -fsS --max-time 20 \
  -H "Authorization: Bearer $FLY_API_TOKEN" \
  -H "content-type: application/json" \
  --data-binary '{"query":"query { viewer { email } }"}' \
  https://api.fly.io/graphql >/dev/null
