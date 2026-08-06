#!/usr/bin/env sh
set -eu

umask 077
[ ! -e .env ] || { echo "local env: exists (not overwritten)"; exit 0; }

session_secret=$(openssl rand -hex 32)
field_key=$(openssl rand -base64 32 | tr -d '\r\n')
download_secret=$(openssl rand -hex 32)

{
  echo '# Local development configuration. Generated secrets are not production credentials.'
  echo 'DATABASE_URL=postgresql://family_historian:family_historian_local@localhost:5432/family_historian'
  echo 'REDIS_URL=redis://localhost:6379'
  echo 'R2_ACCOUNT_ID=local'
  echo 'R2_ACCESS_KEY_ID=family_historian_local'
  echo 'R2_SECRET_ACCESS_KEY='
  echo 'R2_BUCKET=family-historian-local'
  echo 'R2_ENDPOINT=http://localhost:9000'
  echo 'DEEPSEEK_API_KEY='
  echo 'DEEPGRAM_API_KEY='
  echo 'ELEVENLABS_API_KEY='
  echo 'STRIPE_SECRET_KEY='
  echo 'STRIPE_WEBHOOK_SECRET='
  echo 'STRIPE_PRICE_ID='
  echo 'RESEND_API_KEY='
  echo "EMAIL_FROM='Family Historian <noreply@example.invalid>'"
  echo 'TURNSTILE_SITE_KEY='
  echo 'TURNSTILE_SECRET_KEY='
  echo 'SENTRY_DSN='
  echo 'SENTRY_AUTH_TOKEN='
  echo 'OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318'
  echo 'OTEL_EXPORTER_OTLP_HEADERS='
  echo 'GITHUB_TOKEN='
  echo 'GITHUB_REPOSITORY='
  echo 'FLY_API_TOKEN='
  echo 'FLY_APP_STAGING='
  echo 'FLY_APP_PRODUCTION='
  printf 'SESSION_SECRET=%s\n' "$session_secret"
  printf 'FIELD_ENCRYPTION_MASTER_KEY=%s\n' "$field_key"
  printf 'DOWNLOAD_SIGNING_SECRET=%s\n' "$download_secret"
  echo 'LEGAL_APPROVAL_FILE='
  echo 'VENDOR_RISK_APPROVAL_FILE='
  echo 'INSURANCE_EVIDENCE_FILE='
  echo 'DPIA_APPROVAL_FILE='
  echo 'RETENTION_APPROVAL_FILE='
} > .env

echo 'local env: generated'
