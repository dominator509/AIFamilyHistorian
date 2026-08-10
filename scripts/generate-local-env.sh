#!/usr/bin/env sh
set -eu

umask 077
force=false
case "${1:-}" in
  '') ;;
  --force) force=true ;;
  *) echo 'usage: generate-local-env.sh [--force]' >&2; exit 2 ;;
esac
[ ! -e .env ] || [ "$force" = true ] || { echo "local env: exists (not overwritten)"; exit 0; }

session_secret=$(openssl rand -hex 32)
field_key=$(openssl rand -base64 32 | tr -d '\r\n')
download_secret=$(openssl rand -hex 32)
backup_key=$(openssl rand -base64 32 | tr -d '\r\n')
postgres_password=$(openssl rand -hex 24)
worker_postgres_password=$(openssl rand -hex 24)
redis_password=$(openssl rand -hex 24)
s3_user="local$(openssl rand -hex 8)"
s3_password=$(openssl rand -hex 24)
tmp=$(mktemp .env.XXXXXX)
trap 'rm -f "$tmp"' EXIT

{
  echo '# Local development configuration. Generated secrets are not production credentials.'
  printf 'LOCAL_POSTGRES_PASSWORD=%s\n' "$postgres_password"
  printf 'LOCAL_WORKER_POSTGRES_PASSWORD=%s\n' "$worker_postgres_password"
  printf 'LOCAL_REDIS_PASSWORD=%s\n' "$redis_password"
  printf 'LOCAL_S3_ROOT_USER=%s\n' "$s3_user"
  printf 'LOCAL_S3_ROOT_PASSWORD=%s\n' "$s3_password"
  echo 'SMTP_HOST=localhost'
  echo 'SMTP_PORT=11025'
  echo 'MAILPIT_HTTP_URL=http://localhost:18025'
  echo 'CORS_ALLOWED_ORIGINS='
  printf 'DATABASE_URL=postgresql://family_historian:%s@127.0.0.1:35432/family_historian\n' "$postgres_password"
  printf 'WORKER_DATABASE_URL=postgresql://family_historian_worker:%s@127.0.0.1:35432/family_historian\n' "$worker_postgres_password"
  printf 'REDIS_URL=redis://:%s@127.0.0.1:36379\n' "$redis_password"
  echo 'R2_ACCOUNT_ID=local'
  printf 'R2_ACCESS_KEY_ID=%s\n' "$s3_user"
  printf 'R2_SECRET_ACCESS_KEY=%s\n' "$s3_password"
  echo 'R2_BUCKET=family-historian-local'
  echo 'R2_ENDPOINT=http://127.0.0.1:39000'
  echo 'DEEPSEEK_API_KEY='
  echo 'DEEPGRAM_API_KEY='
  echo 'ELEVENLABS_API_KEY='
  echo 'STRIPE_SECRET_KEY='
  echo 'STRIPE_WEBHOOK_SECRET=whsec_local-test-only'
  echo 'STRIPE_PRICE_ID='
  echo 'RESEND_API_KEY='
  echo "EMAIL_FROM='Family Historian <noreply@example.invalid>'"
  echo 'TURNSTILE_SITE_KEY='
  echo 'TURNSTILE_SECRET_KEY='
  echo 'SENTRY_DSN='
  echo 'SENTRY_AUTH_TOKEN='
  echo 'OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:14318'
  echo 'OTEL_EXPORTER_OTLP_HEADERS='
  echo 'GITHUB_TOKEN='
  echo 'GITHUB_REPOSITORY='
  echo 'FLY_API_TOKEN='
  echo 'FLY_APP_STAGING='
  echo 'FLY_APP_PRODUCTION='
  echo 'FLY_APP_WORKER_PRODUCTION='
  printf 'SESSION_SECRET=%s\n' "$session_secret"
  printf 'FIELD_ENCRYPTION_MASTER_KEY=%s\n' "$field_key"
  printf 'DOWNLOAD_SIGNING_SECRET=%s\n' "$download_secret"
  printf 'BACKUP_ENCRYPTION_KEY=%s\n' "$backup_key"
  echo 'LEGAL_APPROVAL_FILE='
  echo 'VENDOR_RISK_APPROVAL_FILE='
  echo 'INSURANCE_EVIDENCE_FILE='
  echo 'DPIA_APPROVAL_FILE='
  echo 'RETENTION_APPROVAL_FILE='
  echo 'WORKER_SANDBOX_EVIDENCE_FILE='
  echo 'WORKER_SANDBOX_EVIDENCE_PUBLIC_KEY_FILE='
  echo 'WORKER_SANDBOX_EVIDENCE_REQUIRE_BINDING=0'
  echo 'WORKER_SANDBOX_EVIDENCE_EXPECTED_IMAGE_DIGEST='
  echo 'WORKER_SANDBOX_EVIDENCE_EXPECTED_APP='
  echo 'WORKER_SANDBOX_EVIDENCE_EXPECTED_WORKER_ID='
  echo 'WORKER_SANDBOX_EVIDENCE_EXPECTED_PUBLIC_KEY_SHA256='
} > "$tmp"
mv -f "$tmp" .env
trap - EXIT

echo 'local env: generated'
