#!/usr/bin/env sh
set -eu
: "${TWILIO_ACCOUNT_SID:?}"
: "${TWILIO_AUTH_TOKEN:?}"
export PROBE_URL="https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json"
export PROBE_BASIC_USER_ENV=TWILIO_ACCOUNT_SID
export PROBE_BASIC_PASSWORD_ENV=TWILIO_AUTH_TOKEN
exec node scripts/probes/http_request.mjs
