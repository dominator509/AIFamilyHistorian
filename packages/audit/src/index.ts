import {
  createProvenanceEvent,
  verifyProvenanceChain,
  type ProvenanceEvent,
} from '@family-historian/provenance';

export type AuditEvent = ProvenanceEvent;

/** Build an append-only, content-redacted audit event with a pseudonymous actor. */
export function createAuditEvent(input: {
  readonly id: string;
  readonly organizationId: string;
  readonly familyArchiveId?: string;
  readonly actorPseudonym: string;
  readonly action: string;
  readonly outcome: 'accepted' | 'rejected' | 'blocked' | 'failed';
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly previousHash?: string | null;
}): AuditEvent {
  if (!/^[a-f0-9]{64}$/u.test(input.actorPseudonym))
    throw new Error('AUDIT_ACTOR_PSEUDONYM_INVALID');
  return createProvenanceEvent({
    id: input.id,
    organizationId: input.organizationId,
    familyArchiveId: input.familyArchiveId ?? input.organizationId,
    entityType: 'audit',
    entityId: input.id,
    eventType: input.action,
    lineage: {
      actorPseudonym: input.actorPseudonym,
      outcome: input.outcome,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
    occurredAt: input.occurredAt,
    ...(input.previousHash !== undefined ? { previousHash: input.previousHash } : {}),
  });
}

export function verifyAuditChain(events: readonly AuditEvent[]): void {
  if (events.some((event) => event.entityType !== 'audit')) throw new Error('AUDIT_CHAIN_INVALID');
  verifyProvenanceChain(events);
}
