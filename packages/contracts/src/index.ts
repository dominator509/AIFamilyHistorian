import { z } from 'zod';

export const healthStatusSchema = z.object({
  service: z.string().min(1),
  status: z.enum(['live', 'ready', 'degraded']),
  timestamp: z.iso.datetime(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export * from './domain.js';
export * from './problems.js';
