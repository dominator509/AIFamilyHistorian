import type { EntityId } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { DomainError } from './errors.js';

export type VoiceAuthorization =
  | { readonly kind: 'stock'; readonly licenseReference: string }
  | {
      readonly kind: 'verified_self_voice';
      readonly subjectId: EntityId;
      readonly providerVerificationReference: string;
      readonly subjectIsLiving: true;
    };

export function authorizeStockVoice(licenseReference: string): VoiceAuthorization {
  if (licenseReference.trim().length === 0)
    throw new DomainError('RIGHTS_UNVERIFIED', 'stock voice license is required');
  return Object.freeze({ kind: 'stock', licenseReference });
}

export function authorizeSelfVoice(input: {
  subjectId: EntityId;
  providerVerificationReference: string;
  subjectIsLiving: boolean;
}): VoiceAuthorization {
  uuidSchema.parse(input.subjectId);
  if (!input.subjectIsLiving)
    throw new DomainError('PROVIDER_POLICY_REJECTED', 'posthumous voice cloning is prohibited');
  if (input.providerVerificationReference.trim().length === 0)
    throw new DomainError('RIGHTS_UNVERIFIED', 'provider self-verification is required');
  return Object.freeze({
    kind: 'verified_self_voice',
    subjectId: input.subjectId,
    providerVerificationReference: input.providerVerificationReference,
    subjectIsLiving: true,
  });
}
