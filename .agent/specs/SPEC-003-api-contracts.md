# Spec 003 API Contracts

Canonical route families:
- /v1/archives
- /v1/archives/:archiveId/members
- /v1/archives/:archiveId/recording-sessions
- /v1/archives/:archiveId/uploads
- /v1/archives/:archiveId/media
- /v1/archives/:archiveId/transcripts
- /v1/archives/:archiveId/people
- /v1/archives/:archiveId/events
- /v1/archives/:archiveId/facts
- /v1/archives/:archiveId/chapters
- /v1/archives/:archiveId/editions
- /v1/archives/:archiveId/narration
- /v1/archives/:archiveId/shares
- /v1/archives/:archiveId/exports
- /v1/archives/:archiveId/rights
- /v1/privacy-requests
- /v1/billing
- /health/live and /health/ready

Mutations require Idempotency-Key, optimistic version where relevant, authenticated archive scope, Zod validation, audit event, and stable problem+json errors. Upload API creates, signs, resumes, completes, verifies, and aborts multipart sessions. Provider callbacks use dedicated signature-verified routes and never trust client-supplied archive identifiers. Generated content responses include provenance_summary and unsupported_claim_count.
