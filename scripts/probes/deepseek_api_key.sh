#!/usr/bin/env sh
set -eu
: "${DEEPSEEK_API_KEY:?}"
base_url="${DEEPSEEK_BASE_URL:-https://api.deepseek.com}"
curl -fsS --max-time 20 -H "Authorization: Bearer $DEEPSEEK_API_KEY" "$base_url/models" >/dev/null
