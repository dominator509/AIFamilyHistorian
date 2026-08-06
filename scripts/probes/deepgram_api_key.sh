#!/usr/bin/env sh
set -eu
: "${DEEPGRAM_API_KEY:?}"
curl -fsS --max-time 20 -H "Authorization: Token $DEEPGRAM_API_KEY" https://api.deepgram.com/v1/projects >/dev/null
