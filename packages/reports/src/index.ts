import { z } from 'zod';

const reportItemSchema = z.object({
  id: z.uuid(),
  label: z.string().min(1),
  status: z.enum(['ready', 'blocked']),
  reason: z.string().min(1).optional(),
});

export const releaseReadinessReportSchema = z.object({
  editionId: z.uuid(),
  editionHash: z.string().regex(/^[a-f0-9]{64}$/u),
  rights: z.array(reportItemSchema),
  consents: z.array(reportItemSchema),
  citations: z.array(reportItemSchema),
});
export type ReleaseReadinessReport = z.infer<typeof releaseReadinessReportSchema>;

export function assertReleaseReady(report: ReleaseReadinessReport): void {
  const parsed = releaseReadinessReportSchema.parse(report);
  const blocked = [...parsed.rights, ...parsed.consents, ...parsed.citations].filter(
    (item) => item.status === 'blocked',
  );
  if (blocked.length > 0)
    throw new Error(
      `release blocked: ${blocked.map((item) => `${item.label}: ${item.reason ?? 'unresolved'}`).join('; ')}`,
    );
}
