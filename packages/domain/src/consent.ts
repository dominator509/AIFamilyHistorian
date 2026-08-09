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

export const MAX_CONSENT_POLICY_VERSION_CHARS = 128;

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
  for (const record of records) validateConsentRecord(record);
  const matching = records.filter(
    (record) => record.subjectId === subjectId && record.purpose === purpose,
  );
  const current = matching.reduce<ConsentRecord | undefined>((latest, record) => {
    if (!latest) return record;
    const latestTime = Date.parse(latest.decidedAt);
    const recordTime = Date.parse(record.decidedAt);
    if (recordTime > latestTime) return record;
    if (recordTime < latestTime) return latest;
    return record.id > latest.id ? record : latest;
  }, undefined);
  if (!current) throw new DomainError('CONSENT_REQUIRED', `consent required for ${purpose}`);
  if (current.status === 'withdrawn')
    throw new DomainError('CONSENT_WITHDRAWN', `consent withdrawn for ${purpose}`);
  if (current.status !== 'granted')
    throw new DomainError('CONSENT_REQUIRED', `active consent required for ${purpose}`);
  return current;
}

export function withdrawConsent(record: ConsentRecord, decidedAt: string): ConsentRecord {
  if (record.status === 'withdrawn') return record;
  validateConsentRecord(record);
  if (!isSafeTimestamp(decidedAt))
    throw new DomainError('VALIDATION_FAILED', 'consent decision timestamp is invalid');
  return Object.freeze({ ...record, status: 'withdrawn', decidedAt });
}

function validateConsentRecord(record: ConsentRecord): void {
  uuidSchema.parse(record.id);
  uuidSchema.parse(record.subjectId);
  if (
    !isSafeReference(record.policyVersion) ||
    !isSafeTimestamp(record.decidedAt) ||
    ![
      'recording',
      'transcription',
      'ai_editorial',
      'translation',
      'narration',
      'verified_self_voice',
      'publication',
      'marketing',
      'public_sharing',
    ].includes(record.purpose) ||
    !['pending', 'granted', 'withdrawn', 'expired', 'disputed'].includes(record.status)
  )
    throw new DomainError('VALIDATION_FAILED', 'consent record is invalid');
}

function isSafeReference(value: string): boolean {
  return (
    value.trim().length > 0 &&
    value.length <= MAX_CONSENT_POLICY_VERSION_CHARS &&
    ![...value].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f;
    })
  );
}

function isSafeTimestamp(value: string): boolean {
  return value.length <= 64 && Number.isFinite(Date.parse(value));
}
