import { z } from 'zod';
import { problemCodeSchema } from './domain.js';

export const problemDetailsSchema = z.object({
  type: z.url(),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  code: problemCodeSchema,
  detail: z.string().min(1),
  retryable: z.boolean(),
  userAction: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
