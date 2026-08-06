# Data Retention Schedule - Approval Required

| Category | Default while active | After deletion request | Notes |
|---|---|---|---|
| Original media | Until user deletion or account termination | Grace period then primary deletion; backups expire on documented schedule | Fixity and rights status travel with object |
| Derivatives | While needed | Delete before or with original; regenerable | Thumbnails, playback, OCR, normalized audio |
| Transcripts and revisions | While archive active | Delete with source unless separately retained by instruction | Approved quote lineage must not outlive source without legal basis |
| Generated chapters and editions | While active | Delete on request subject to distributed-copy limits | Edition hash may remain in minimal audit evidence |
| Consent and rights evidence | Active plus legally approved period | Restrict and retain only as legally required | Needed to establish authority and withdrawal |
| Security audit events | Approved security period | Retained and access-restricted | No content |
| Provider job payloads | Minimum possible | Request deletion promptly where supported | Contract-specific |
| Worker scratch files | Job duration only | Immediate secure wipe | Encrypted ephemeral storage |
| Deleted account backups | Documented rolling expiry | Automatic expiry | Restore process must reapply deletion tombstones |
| Billing and tax records | Statutory period | Retain only required fields | Stripe is payment system of record |
