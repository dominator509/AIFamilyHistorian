#!/usr/bin/env sh
set -eu
: "${GITHUB_TOKEN:?}"
export PROBE_URL='https://api.github.com/user'
export PROBE_SECRET_ENV=GITHUB_TOKEN
export PROBE_HEADER_NAME=Authorization
export PROBE_HEADER_PREFIX='Bearer '
export PROBE_HEADERS_JSON='{"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}'
exec node scripts/probes/http_request.mjs
