import { z } from 'zod';
import { factStatusSchema, roleSchema, uuidSchema, visibilitySchema } from './domain.js';

export const idempotencyKeySchema = z.string().min(16).max(200);
export const archiveParamsSchema = z.object({ archiveId: uuidSchema });
export const recordingSessionInputSchema = z.object({
  subjectId: uuidSchema.optional(),
  scheduledAt: z.iso.datetime().optional(),
});
export const memberInputSchema = z.object({ userId: uuidSchema, role: roleSchema });
export const personInputSchema = z.object({
  displayName: z.string().min(1).max(300),
  isLiving: z.boolean(),
  visibility: visibilitySchema.default('owner_only'),
});
export const mediaInputSchema = z.object({
  mediaType: z.enum(['audio', 'video', 'image', 'document']),
  visibility: visibilitySchema.default('owner_only'),
  rightsStatus: z.literal('pending').default('pending'),
});
export const uploadInputSchema = z.object({
  mediaAssetId: uuidSchema,
  contentType: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/u),
  byteSize: z
    .number()
    .int()
    .nonnegative()
    .max(25 * 1024 * 1024 * 1024),
  sha256Hex: z.string().regex(/^[a-f0-9]{64}$/u),
});
export const uploadPartParamsSchema = archiveParamsSchema.extend({
  uploadId: uuidSchema,
  partNumber: z.coerce.number().int().min(1).max(10_000),
});
export const uploadParamsSchema = archiveParamsSchema.extend({ uploadId: uuidSchema });
export const completedPartSchema = z.object({
  ETag: z.string().min(1),
  PartNumber: z.number().int().min(1).max(10_000),
  ChecksumSHA256: z.string().min(1).optional(),
});
export const completeUploadInputSchema = z
  .object({
    parts: z.array(completedPartSchema).min(1).max(10_000),
  })
  .superRefine((input, context) => {
    const seen = new Set<number>();
    input.parts.forEach((part, index) => {
      if (seen.has(part.PartNumber))
        context.addIssue({
          code: 'custom',
          path: ['parts', index, 'PartNumber'],
          message: 'multipart part numbers must be unique',
        });
      seen.add(part.PartNumber);
    });
  });
export const transcriptInputSchema = z.object({
  mediaAssetId: uuidSchema,
  text: z.string().min(1),
  status: z.enum(['draft', 'corrected', 'approved']).default('draft'),
});
export const factInputSchema = z.object({
  text: z.string().min(1),
  confirmerId: uuidSchema,
  evidenceLinkIds: z.array(uuidSchema).min(1).max(1_000),
  status: factStatusSchema.default('confirmed'),
});
export const eventInputSchema = z.object({
  personId: uuidSchema.optional(),
  placeId: uuidSchema.optional(),
  eventType: z.string().min(1).max(100),
  occurredOn: z.iso.date().optional(),
  datePrecision: z.enum(['day', 'month', 'year', 'approximate', 'unknown']),
  description: z.string().max(10_000).optional(),
  visibility: visibilitySchema.default('owner_only'),
});
export const chapterInputSchema = z.object({ title: z.string().min(1).max(500) });
export const editionInputSchema = z.object({
  editionHash: z.string().regex(/^[a-f0-9]{64}$/u),
  manifest: z.record(z.string(), z.unknown()),
});
export const rightsInputSchema = z.object({
  subjectType: z.string().min(1).max(100),
  subjectId: uuidSchema,
  basis: z.string().min(1).max(500),
  status: z.literal('pending').default('pending'),
});
export const shareInputSchema = z.object({
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/u),
  visibility: z.union([
    z.literal('owner_only'),
    z.literal('selected_contributors'),
    z.literal('family_members'),
    z.literal('link_recipients'),
  ]),
  expiresAt: z.iso.datetime(),
});
export const exportInputSchema = z.object({
  kind: z.enum(['portable', 'book', 'epub', 'audiobook']),
});
export const narrationInputSchema = z.object({
  editionId: uuidSchema,
  voiceAuthorizationId: uuidSchema,
});
export const privacyRequestInputSchema = z.object({
  archiveId: uuidSchema.optional(),
  requestType: z.enum(['access', 'correction', 'export', 'deletion', 'restriction', 'objection']),
  requesterReference: z.string().min(1).max(500),
});
export const billingInputSchema = z.object({
  planCode: z.enum(['concierge', 'self_service', 'family', 'institutional']),
  status: z.enum(['trialing', 'active', 'past_due', 'cancelled']),
});
export const mutationResponseSchema = z.object({
  id: uuidSchema,
  status: z.string().min(1),
});
export type MutationResponse = z.infer<typeof mutationResponseSchema>;
