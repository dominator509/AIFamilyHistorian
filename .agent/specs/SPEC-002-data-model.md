# Spec 002 Data Model and Vocabulary Lock

Canonical tables use snake_case plural names derived from SPEC-001 entities. Primary keys are UUIDv7. Every tenant-scoped table includes organization_id and family_archive_id where applicable. Versioned content uses immutable revision rows and current_revision_id pointers. Restricted text is envelope encrypted. Original media stores only opaque object keys, never public URLs.

Required status enums:
- consent_status: pending, granted, withdrawn, expired, disputed.
- rights_status: pending, verified, restricted, disputed, expired.
- transcript_status: processing, draft, corrected, approved, restricted.
- fact_status: candidate, confirmed, disputed, rejected, superseded.
- edition_status: draft, rights_review, owner_review, approved, generating, ready, withdrawn.
- job_status: queued, running, retryable_failed, terminal_failed, completed, cancelled.
- visibility: owner_only, selected_contributors, family_members, link_recipients, public_approved.

Provenance tables are append-only. RLS policies require matching organization membership and archive permission. Unscoped queries are forbidden. Schema migrations use expand-migrate-contract and include forward, backfill, verification, and rollback instructions.
