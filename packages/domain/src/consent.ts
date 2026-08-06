import type { ConsentStatus, EntityId } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export type ConsentPurpose =
  | 'recording'
  | 'transcription'
  | 'ai_editorial'
  | 'translation'
  | 'narration'
  | 'verified_self_voice'
  | 'publication'
  | 'marketing'
  | 'public_sharing';

export interface ConsentRecord {
  readonly id: EntityId;
  readonly subjectId: EntityId;
  readonly purpose: ConsentPurpose;
  readonly policyVersion: string;
  readonly status: ConsentStatus;
  readonly decidedAt: string;
}

export function assertActiveConsent(
  records: readonly ConsentRecord[],
  subjectId: EntityId,
  purpose: ConsentPurpose,
): ConsentRecord {
  uuidSchema.parse(subjectId);
  const matching = records.filter(
    (record) => record.subjectId === subjectId && record.purpose === purpose,
  );
  const current = matching.at(-1);
  if (!current) throw new DomainError('CONSENT_REQUIRED', `consent required for ${purpose}`);
  if (current.status === 'withdrawn')
    throw new DomainError('CONSENT_WITHDRAWN', `consent withdrawn for ${purpose}`);
  if (current.status !== 'granted')
    throw new DomainError('CONSENT_REQUIRED', `active consent required for ${purpose}`);
  return current;
}

export function withdrawConsent(record: ConsentRecord, decidedAt: string): ConsentRecord {
  if (record.status === 'withdrawn') return record;
  return Object.freeze({ ...record, status: 'withdrawn', decidedAt });
}
