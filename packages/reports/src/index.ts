import { z } from 'zod';

export const MAX_READINESS_ITEMS = 256;
export const MAX_READINESS_LABEL_CHARS = 256;
export const MAX_READINESS_REASON_CHARS = 2_048;

const reportItemSchema = z.object({
  id: z.uuid(),
  label: z.string().min(1).max(MAX_READINESS_LABEL_CHARS),
  status: z.enum(['ready', 'blocked']),
  reason: z.string().min(1).max(MAX_READINESS_REASON_CHARS).optional(),
});

export const releaseReadinessReportSchema = z.object({
  editionId: z.uuid(),
  editionHash: z.string().regex(/^[a-f0-9]{64}$/u),
  rights: z.array(reportItemSchema).min(1).max(MAX_READINESS_ITEMS),
  consents: z.array(reportItemSchema).min(1).max(MAX_READINESS_ITEMS),
  citations: z.array(reportItemSchema).min(1).max(MAX_READINESS_ITEMS),
});
export type ReleaseReadinessReport = z.infer<typeof releaseReadinessReportSchema>;

export function assertReleaseReady(report: ReleaseReadinessReport): void {
  const parsed = releaseReadinessReportSchema.parse(report);
  const items = [...parsed.rights, ...parsed.consents, ...parsed.citations];
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id))
      throw new Error(`release blocked: duplicate readiness evidence ${item.id}`);
    ids.add(item.id);
  }
  const blocked = items.filter((item) => item.status === 'blocked');
  if (blocked.length > 0)
    throw new Error(
      `release blocked: ${blocked.map((item) => `${item.label}: ${item.reason ?? 'unresolved'}`).join('; ')}`,
    );
}
