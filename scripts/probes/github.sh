#!/usr/bin/env sh
set -eu
: "${GITHUB_TOKEN:?}"
curl -fsS --max-time 20 \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/user >/dev/null
