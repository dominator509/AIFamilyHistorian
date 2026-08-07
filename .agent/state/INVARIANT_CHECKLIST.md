# Working Invariant Checklist

Status values are `PENDING`, `IMPLEMENTED`, and `VERIFIED`. Only observed tests or live-fire evidence may set `VERIFIED`.

| ID | Invariant | Implementation status | Verification status | Evidence |
|---|---|---|---|---|
| INV-001 | Approved structured source records, never model output, are authoritative. | IMPLEMENTED | PENDING | Pure-domain fact confirmation and unsupported-claim tests pass; persistence/API/live-fire remain. |
| INV-002 | Every published factual claim maps to evidence or is visibly labeled interpretation. | IMPLEMENTED | PENDING | Generated factual claims without evidence are rejected in unit tests; publication live-fire remains. |
| INV-003 | Published quotations equal approved source spans byte-for-byte. | IMPLEMENTED | VERIFIED | Exact source-span checks pass in domain, provenance, and publication unit/live-fire coverage. |
| INV-004 | External processing requires current purpose-specific consent. | IMPLEMENTED | PENDING | Purpose isolation and withdrawal unit tests pass; gateway/provider proof remains. |
| INV-005 | Voice generation is limited to licensed stock voice or a living subject's verified self-voice. | IMPLEMENTED | PENDING | Stock license, living self-verification, and posthumous rejection unit tests pass; adapter proof remains. |
| INV-006 | Original media is immutable and fixity-verifiable. | IMPLEMENTED | VERIFIED | PostgreSQL rejects metadata mutation; S3 conditional writes reject byte replacement; SHA-256 metadata is asserted against real local services; media pipeline rejects original identity/fixity mutation. |
| INV-007 | Public sharing and print fulfillment require explicit immutable edition approval. | IMPLEMENTED | PENDING | Edition hash pinning and stale/disputed rejection unit tests pass; API/UI proof remains. |
| INV-008 | Rights and visibility checks apply at read, export, share, generation and publication boundaries. | IMPLEMENTED | PENDING | Pure permission policy rejects standing admin access and unauthorized approval; boundary coverage remains. |
| INV-009 | AI, transcription, narration and print providers are replaceable adapters. | IMPLEMENTED | PENDING | DeepSeek gateway plus Deepgram, ElevenLabs, Resend, Stripe, and Turnstile HTTP adapters pass local protocol contract tests; authenticated vendor probes remain. |
| INV-010 | Cache optimization never overrides minimization, consent, rights, deletion or purpose limitation. | IMPLEMENTED | PENDING | Gateway policy runs before stable-prefix construction and redacts outbound content; cache isolation/invalidation and hosted telemetry remain. |
| INV-011 | Destructive workflows are delayed, auditable, idempotent and verifiable. | IMPLEMENTED | VERIFIED | Delayed evidence-complete idempotent deletion state machine and append-only audit chain pass unit/live-fire coverage; hosted processor proof remains. |
| INV-012 | Open documented export formats prevent platform lock-in. | IMPLEMENTED | VERIFIED | Publication bundle emits deterministic JSONL/CSV/PDF/EPUB artifacts and portable manifests; the 25 GB resumable chunk manifest/part recovery planner and local backup restore pass, while actual large transfer and formal accessibility audit remain. |
| DOM-001 | Original object bytes never mutate. | IMPLEMENTED | VERIFIED | tests/integration/database/persistence.test.ts and tests/integration/storage/object-storage.test.ts. |
| DOM-002 | Confirmed facts have evidence and a confirmer; competing disputes may coexist. | IMPLEMENTED | VERIFIED | `tests/unit/domain/invariants.test.ts`. |
| DOM-003 | Publication approval pins exactly one immutable edition hash. | IMPLEMENTED | VERIFIED | `tests/unit/domain/invariants.test.ts`. |
| DOM-004 | Generated chapter revisions record model, prompt, inputs, citations and approver. | IMPLEMENTED | VERIFIED | `tests/unit/domain/invariants.test.ts`. |
| DOM-005 | Deletion produces storage and processor evidence and is idempotent. | IMPLEMENTED | VERIFIED | `tests/unit/domain/invariants.test.ts`. |
