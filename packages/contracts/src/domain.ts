import { z } from 'zod';

export const uuidSchema = z.uuid();
export type EntityId = z.infer<typeof uuidSchema>;

export const consentStatusSchema = z.enum([
  'pending',
  'granted',
  'withdrawn',
  'expired',
  'disputed',
]);
export const rightsStatusSchema = z.enum([
  'pending',
  'verified',
  'restricted',
  'disputed',
  'expired',
]);
export const transcriptStatusSchema = z.enum([
  'processing',
  'draft',
  'corrected',
  'approved',
  'restricted',
]);
export const factStatusSchema = z.enum([
  'candidate',
  'confirmed',
  'disputed',
  'rejected',
  'superseded',
]);
export const editionStatusSchema = z.enum([
  'draft',
  'rights_review',
  'owner_review',
  'approved',
  'generating',
  'ready',
  'withdrawn',
]);
export const jobStatusSchema = z.enum([
  'queued',
  'running',
  'retryable_failed',
  'terminal_failed',
  'completed',
  'cancelled',
]);
export const visibilitySchema = z.enum([
  'owner_only',
  'selected_contributors',
  'family_members',
  'link_recipients',
  'public_approved',
]);

export type ConsentStatus = z.infer<typeof consentStatusSchema>;
export type RightsStatus = z.infer<typeof rightsStatusSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;

export const roleSchema = z.enum([
  'organization_owner',
  'archive_owner',
  'story_subject',
  'interviewer',
  'editor',
  'fact_checker',
  'contributor',
  'viewer',
  'legacy_steward',
  'support_jit',
  'platform_admin',
]);
export type Role = z.infer<typeof roleSchema>;

export const evidenceLinkSchema = z
  .object({
    id: uuidSchema,
    sourceId: uuidSchema,
    revisionId: uuidSchema,
    startOffset: z.number().int().nonnegative().refine(Number.isSafeInteger, {
      message: 'evidence startOffset must be a safe integer',
    }),
    endOffset: z.number().int().positive().refine(Number.isSafeInteger, {
      message: 'evidence endOffset must be a safe integer',
    }),
  })
  .refine((value) => value.endOffset > value.startOffset, {
    message: 'evidence endOffset must be greater than startOffset',
    path: ['endOffset'],
  });
export type EvidenceLink = z.infer<typeof evidenceLinkSchema>;

export const problemCodeSchema = z.enum([
  'AUTH_REQUIRED',
  'PERMISSION_DENIED',
  'CONSENT_REQUIRED',
  'CONSENT_WITHDRAWN',
  'RIGHTS_UNVERIFIED',
  'RIGHTS_DISPUTED',
  'QUOTE_NOT_APPROVED',
  'EVIDENCE_MISSING',
  'UNSUPPORTED_CLAIM',
  'UPLOAD_INCOMPLETE',
  'CHECKSUM_MISMATCH',
  'MEDIA_UNSAFE',
  'MEDIA_PROCESSING_FAILED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_POLICY_REJECTED',
  'BUDGET_EXCEEDED',
  'QUOTA_EXCEEDED',
  'EDITION_STALE',
  'DELETION_PENDING',
  'RATE_LIMITED',
  'CONFLICT',
  'VALIDATION_FAILED',
  'INTERNAL_ERROR',
]);
export type ProblemCode = z.infer<typeof problemCodeSchema>;
