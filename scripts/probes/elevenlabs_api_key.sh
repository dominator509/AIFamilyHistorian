#!/usr/bin/env sh
set -eu
: "${ELEVENLABS_API_KEY:?}"
curl -fsS --max-time 20 -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/user >/dev/null
