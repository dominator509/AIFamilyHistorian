import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createAuditEvent, verifyAuditChain } from '../../packages/audit/src/index.js';

const organizationId = '01900000-0000-7000-8000-000000000041';
const actorPseudonym = createHash('sha256').update('actor-1').digest('hex');

describe('append-only audit events', () => {
  it('chains redacted audit metadata and rejects content fields', () => {
    const first = createAuditEvent({
      id: '01900000-0000-7000-8000-000000000042',
      organizationId,
      actorPseudonym,
      action: 'archive.read',
      outcome: 'accepted',
      metadata: { permission: 'archive:read' },
      occurredAt: '2026-08-07T00:00:00.000Z',
    });
    const second = createAuditEvent({
      id: '01900000-0000-7000-8000-000000000043',
      organizationId,
      actorPseudonym,
      action: 'archive.export',
      outcome: 'blocked',
      previousHash: first.eventHash,
      occurredAt: '2026-08-07T00:01:00.000Z',
    });
    expect(() => verifyAuditChain([first, second])).not.toThrow();
    expect(() =>
      createAuditEvent({
        id: '01900000-0000-7000-8000-000000000044',
        organizationId,
        actorPseudonym,
        action: 'archive.read',
        outcome: 'accepted',
        metadata: { transcript: 'never store content' },
        occurredAt: '2026-08-07T00:00:00.000Z',
      }),
    ).toThrow('lineage field is not allowed');
  });
});
