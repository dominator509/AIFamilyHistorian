# PREFLIGHT - AI Family Historian

This is the only interactive preparation step. Obtain every REQUIRED item, copy .env.example to .env, and run `sh scripts/preflight.sh` until `preflight: ok`. Production launch remains blocked by the documentary approvals listed below even when technical probes pass.

## Credentials and approvals

| Service or evidence | Purpose | Variables or artifact | Minimum scope | Cost | Probe or gate |
|---|---|---|---|---|---|
| Neon PostgreSQL | All persistence and real integration tests | DATABASE_URL | Dedicated nonproduction database owner for setup; runtime least-privilege user later | Paid or free tier | scripts/probes/database_url.sh |
| Upstash Redis | Queues, locks, limits, exact-result cache | REDIS_URL | One isolated database | Paid or free tier | scripts/probes/redis_url.sh |
| Cloudflare R2 | Originals, derivatives, exports | R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT | Object read/write/delete only for project bucket | Usage based | scripts/probes/r2.sh |
| DeepSeek | Interview planning and editorial generation | DEEPSEEK_API_KEY | API inference only | Usage based | scripts/probes/deepseek_api_key.sh |
| Deepgram | Primary transcription | DEEPGRAM_API_KEY | Speech-to-text only | Usage based | scripts/probes/deepgram_api_key.sh; authenticated sample proof: scripts/probes/deepgram_transcription.sh |
| ElevenLabs | Optional stock narration and verified self-voice | ELEVENLABS_API_KEY | Text-to-speech and permitted voice endpoints only | Usage based | scripts/probes/elevenlabs_api_key.sh |
| Stripe | Billing live-fire | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID | Test mode during build | Usage based | scripts/probes/stripe.sh |
| Resend | Invitations and job notices | RESEND_API_KEY, EMAIL_FROM | Sending domain only | Usage based | scripts/probes/resend.sh |
| Cloudflare Turnstile | Abuse prevention | TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY | One site | Free | scripts/probes/turnstile.sh |
| Sentry | Redacted errors | SENTRY_DSN, SENTRY_AUTH_TOKEN | Project event ingest and release upload | Paid or free tier | scripts/probes/sentry.sh |
| OpenTelemetry | Metrics and traces | OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS | Dedicated project ingest | Provider dependent | scripts/probes/otel.sh |
| GitHub | CI and container registry | GITHUB_TOKEN, GITHUB_REPOSITORY | Repository and packages scopes only | Plan dependent | scripts/probes/github.sh |
| Fly.io | Staging and production runtime | FLY_API_TOKEN, FLY_APP_STAGING, FLY_APP_PRODUCTION | Deploy only to named apps | Usage based | scripts/probes/fly.sh |
| Application secrets | Sessions, encryption, webhook state, encrypted backups | SESSION_SECRET, FIELD_ENCRYPTION_MASTER_KEY, DOWNLOAD_SIGNING_SECRET, BACKUP_ENCRYPTION_KEY | Random values generated locally; production backup key must be KMS/secret-manager controlled | None | Presence only |
| Legal launch evidence | Privacy, Terms, recording consent, releases, voice, likeness, copyright, minors, defamation review | LEGAL_APPROVAL_FILE | Signed approval artifact | Professional fee | production-readiness gate |
| Vendor-risk evidence | DeepSeek, Deepgram, ElevenLabs, R2, Neon, Upstash, Sentry and print provider data-flow decisions | VENDOR_RISK_APPROVAL_FILE | Approved and current | Internal/professional | production-readiness gate |
| Insurance evidence | Cyber, technology E&O, and media liability | INSURANCE_EVIDENCE_FILE | Active policy evidence | Paid | production-readiness gate |
| DPIA and retention | Approved data map, DPIA, retention schedule, subprocessor list | DPIA_APPROVAL_FILE, RETENTION_APPROVAL_FILE | Approved artifacts | Internal/professional | production-readiness gate |

Local tools required: git, awk, grep, sed, curl, jq, node 24, pnpm 10 through Corepack, Docker, PostgreSQL client 17, ffmpeg, ffprobe, exiftool, convert or magick, clamscan, OCRmyPDF, and Python 3.12 for local media utilities.

PREFLIGHT-TABLE-BEGIN
DATABASE_URL|REQUIRED|scripts/probes/database_url.sh
REDIS_URL|REQUIRED|scripts/probes/redis_url.sh
R2_ACCOUNT_ID|REQUIRED|-
R2_ACCESS_KEY_ID|REQUIRED|-
R2_SECRET_ACCESS_KEY|REQUIRED|scripts/probes/r2.sh
R2_BUCKET|REQUIRED|-
R2_ENDPOINT|REQUIRED|-
DEEPSEEK_API_KEY|REQUIRED|scripts/probes/deepseek_api_key.sh
DEEPGRAM_API_KEY|REQUIRED|scripts/probes/deepgram_api_key.sh
ELEVENLABS_API_KEY|OPTIONAL|scripts/probes/elevenlabs_api_key.sh
STRIPE_SECRET_KEY|REQUIRED|scripts/probes/stripe.sh
STRIPE_WEBHOOK_SECRET|REQUIRED|-
STRIPE_PRICE_ID|REQUIRED|-
RESEND_API_KEY|REQUIRED|scripts/probes/resend.sh
EMAIL_FROM|REQUIRED|-
TURNSTILE_SITE_KEY|REQUIRED|-
TURNSTILE_SECRET_KEY|REQUIRED|scripts/probes/turnstile.sh
SENTRY_DSN|REQUIRED|scripts/probes/sentry.sh
SENTRY_AUTH_TOKEN|REQUIRED|-
OTEL_EXPORTER_OTLP_ENDPOINT|REQUIRED|scripts/probes/otel.sh
OTEL_EXPORTER_OTLP_HEADERS|OPTIONAL|-
GITHUB_TOKEN|REQUIRED|scripts/probes/github.sh
GITHUB_REPOSITORY|REQUIRED|-
FLY_API_TOKEN|REQUIRED|scripts/probes/fly.sh
FLY_APP_STAGING|REQUIRED|-
FLY_APP_PRODUCTION|REQUIRED|-
SESSION_SECRET|REQUIRED|-
FIELD_ENCRYPTION_MASTER_KEY|REQUIRED|-
DOWNLOAD_SIGNING_SECRET|REQUIRED|-
BACKUP_ENCRYPTION_KEY|REQUIRED|-
LEGAL_APPROVAL_FILE|REQUIRED|-
VENDOR_RISK_APPROVAL_FILE|REQUIRED|-
INSURANCE_EVIDENCE_FILE|REQUIRED|-
DPIA_APPROVAL_FILE|REQUIRED|-
RETENTION_APPROVAL_FILE|REQUIRED|-
PREFLIGHT-TABLE-END
