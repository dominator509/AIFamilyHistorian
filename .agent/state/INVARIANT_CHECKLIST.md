# Working Invariant Checklist

Status values are `PENDING`, `IMPLEMENTED`, and `VERIFIED`. Only observed tests or live-fire evidence may set `VERIFIED`.

| ID | Invariant | Implementation status | Verification status | Evidence |
|---|---|---|---|---|
| INV-001 | Approved structured source records, never model output, are authoritative. | PENDING | PENDING | To be implemented in EP-002 and proven in EP-007. |
| INV-002 | Every published factual claim maps to evidence or is visibly labeled interpretation. | PENDING | PENDING | To be implemented in EP-002/EP-004 and proven in live-fire. |
| INV-003 | Published quotations equal approved source spans byte-for-byte. | PENDING | PENDING | To be implemented in EP-002 and proven in unit/live-fire tests. |
| INV-004 | External processing requires current purpose-specific consent. | PENDING | PENDING | To be enforced by the AI Policy Gateway and provider boundaries. |
| INV-005 | Voice generation is limited to licensed stock voice or a living subject's verified self-voice. | PENDING | PENDING | To be enforced in domain, permission and adapter layers. |
| INV-006 | Original media is immutable and fixity-verifiable. | PENDING | PENDING | To be implemented in storage/database/media layers. |
| INV-007 | Public sharing and print fulfillment require explicit immutable edition approval. | PENDING | PENDING | To be implemented in domain/API/UI. |
| INV-008 | Rights and visibility checks apply at read, export, share, generation and publication boundaries. | PENDING | PENDING | To be implemented in permissions and tested for IDOR/tenant isolation. |
| INV-009 | AI, transcription, narration and print providers are replaceable adapters. | PENDING | PENDING | To be implemented in gateway packages. |
| INV-010 | Cache optimization never overrides minimization, consent, rights, deletion or purpose limitation. | PENDING | PENDING | To be proven through cache isolation/invalidation/privacy tests. |
| INV-011 | Destructive workflows are delayed, auditable, idempotent and verifiable. | PENDING | PENDING | To be implemented for deletion and publication withdrawal. |
| INV-012 | Open documented export formats prevent platform lock-in. | PENDING | PENDING | To be implemented in publishing/export and proven by restore. |
| DOM-001 | Original object bytes never mutate. | PENDING | PENDING | SPEC-001 invariant 1. |
| DOM-002 | Confirmed facts have evidence and a confirmer; competing disputes may coexist. | PENDING | PENDING | SPEC-001 invariants 3-4. |
| DOM-003 | Publication approval pins exactly one immutable edition hash. | PENDING | PENDING | SPEC-001 invariant 5. |
| DOM-004 | Generated chapter revisions record model, prompt, inputs, citations and approver. | PENDING | PENDING | SPEC-001 invariant 8. |
| DOM-005 | Deletion produces storage and processor evidence and is idempotent. | PENDING | PENDING | SPEC-001 invariant 10. |

