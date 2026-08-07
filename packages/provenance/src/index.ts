import { createHash, timingSafeEqual } from 'node:crypto';
import type { EntityId } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { z } from 'zod';

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

const lineageValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

const lineageSchema = z.record(z.string().min(1), lineageValueSchema);

export interface EvidenceSpan {
  readonly sourceId: EntityId;
  readonly revisionId: EntityId;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface ClaimEvidence {
  readonly text: string;
  readonly classification: 'factual' | 'interpretation' | 'connective_prose' | 'quotation';
  readonly evidence: readonly EvidenceSpan[];
}

export interface ProvenanceEvent {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly familyArchiveId: EntityId;
  readonly entityType: string;
  readonly entityId: EntityId;
  readonly eventType: string;
  readonly lineage: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly previousHash: string | null;
  readonly eventHash: string;
}

export class ProvenanceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ProvenanceError';
  }
}

/** Build a source span without allowing inverted or negative offsets. */
export function createEvidenceSpan(input: EvidenceSpan, sourceText?: string): EvidenceSpan {
  uuidSchema.parse(input.sourceId);
  uuidSchema.parse(input.revisionId);
  if (!Number.isInteger(input.startOffset) || input.startOffset < 0)
    throw new ProvenanceError('evidence startOffset must be a non-negative integer');
  if (!Number.isInteger(input.endOffset) || input.endOffset <= input.startOffset)
    throw new ProvenanceError('evidence endOffset must be greater than startOffset');
  if (sourceText !== undefined && input.endOffset > sourceText.length)
    throw new ProvenanceError('evidence span exceeds source text');
  return Object.freeze({ ...input });
}

/** Factual claims require evidence; quotations additionally require byte-for-byte source text. */
export function assertClaimEvidence(claim: ClaimEvidence, sourceText?: string): void {
  if (claim.text.trim().length === 0) throw new ProvenanceError('claim text is required');
  if (claim.classification === 'factual' && claim.evidence.length === 0)
    throw new ProvenanceError('factual claims require evidence');
  for (const span of claim.evidence) createEvidenceSpan(span, sourceText);
  if (claim.classification === 'quotation') {
    if (sourceText === undefined) throw new ProvenanceError('quotation source text is required');
    const exact = claim.evidence.some(
      (span) => sourceText.slice(span.startOffset, span.endOffset) === claim.text,
    );
    if (!exact) throw new ProvenanceError('quotation does not match an approved source span');
  }
}

/**
 * Create an append-only provenance event. Raw source, prompt, and provider payload fields are
 * rejected from lineage so the event can be safely persisted and exported.
 */
export function createProvenanceEvent(
  input: Omit<ProvenanceEvent, 'eventHash' | 'previousHash'> & {
    readonly previousHash?: string | null;
  },
): ProvenanceEvent {
  uuidSchema.parse(input.id);
  uuidSchema.parse(input.organizationId);
  uuidSchema.parse(input.familyArchiveId);
  uuidSchema.parse(input.entityId);
  const previousHash = input.previousHash ?? null;
  if (previousHash !== null) hashSchema.parse(previousHash);
  const lineage = lineageSchema.parse(input.lineage);
  assertSafeLineage(lineage);
  const canonical = canonicalJson({
    id: input.id,
    organizationId: input.organizationId,
    familyArchiveId: input.familyArchiveId,
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    lineage,
    occurredAt: input.occurredAt,
    previousHash,
  });
  const eventHash = sha256(canonical);
  return Object.freeze({
    id: input.id,
    organizationId: input.organizationId,
    familyArchiveId: input.familyArchiveId,
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    lineage: Object.freeze({ ...lineage }),
    occurredAt: input.occurredAt,
    previousHash,
    eventHash,
  });
}

/** Verify every hash and link in an ordered append-only event chain. */
export function verifyProvenanceChain(events: readonly ProvenanceEvent[]): void {
  let previousHash: string | null = null;
  for (const event of events) {
    if (event.previousHash !== previousHash)
      throw new ProvenanceError(`provenance chain link mismatch at ${event.id}`);
    const expected = createProvenanceEvent({ ...event, previousHash }).eventHash;
    if (!safeEqualHash(expected, event.eventHash))
      throw new ProvenanceError(`provenance event hash mismatch at ${event.id}`);
    previousHash = event.eventHash;
  }
}

export function buildProvenanceManifest(events: readonly ProvenanceEvent[]): {
  readonly eventCount: number;
  readonly firstEventHash: string | null;
  readonly lastEventHash: string | null;
  readonly chainHash: string;
} {
  verifyProvenanceChain(events);
  const serialized = events.map((event) => canonicalJson(event)).join('\n');
  return Object.freeze({
    eventCount: events.length,
    firstEventHash: events[0]?.eventHash ?? null,
    lastEventHash: events.at(-1)?.eventHash ?? null,
    chainHash: sha256(serialized),
  });
}

function assertSafeLineage(value: Record<string, unknown>): void {
  const forbidden =
    /^(?:sourceText|transcript|rawPrompt|prompt|content|payload|filename|email|address|phone)$/iu;
  const walk = (current: unknown): void => {
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }
    if (!current || typeof current !== 'object') return;
    for (const [key, nested] of Object.entries(current)) {
      if (forbidden.test(key)) throw new ProvenanceError(`lineage field is not allowed: ${key}`);
      walk(nested);
    }
  };
  walk(value);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
    .join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeEqualHash(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
