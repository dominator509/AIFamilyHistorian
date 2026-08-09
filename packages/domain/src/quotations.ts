import type { EntityId } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export interface ApprovedSourceSpan {
  readonly id: EntityId;
  readonly revisionId: EntityId;
  readonly text: string;
  readonly approved: boolean;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface Quotation {
  readonly id: EntityId;
  readonly sourceSpanId: EntityId;
  readonly sourceRevisionId: EntityId;
  readonly text: string;
}

export function createQuotation(
  id: EntityId,
  requestedText: string,
  span: ApprovedSourceSpan,
): Quotation {
  uuidSchema.parse(id);
  uuidSchema.parse(span.id);
  uuidSchema.parse(span.revisionId);
  if (!span.approved)
    throw new DomainError('QUOTE_NOT_APPROVED', 'quotation source span is not approved');
  if (requestedText !== span.text)
    throw new DomainError(
      'QUOTE_NOT_APPROVED',
      'quotation must equal the approved source span byte-for-byte',
    );
  if (
    !Number.isSafeInteger(span.startOffset) ||
    span.startOffset < 0 ||
    !Number.isSafeInteger(span.endOffset) ||
    span.endOffset <= span.startOffset
  )
    throw new DomainError('VALIDATION_FAILED', 'source span offsets are invalid');
  if (span.endOffset - span.startOffset !== span.text.length)
    throw new DomainError('VALIDATION_FAILED', 'source span offsets do not match quotation text');
  return Object.freeze({
    id,
    sourceSpanId: span.id,
    sourceRevisionId: span.revisionId,
    text: requestedText,
  });
}
