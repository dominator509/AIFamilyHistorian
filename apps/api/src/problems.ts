import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { ProblemCode, ProblemDetails } from '@family-historian/contracts';

const statusByCode: Record<ProblemCode, number> = {
  AUTH_REQUIRED: 401,
  PERMISSION_DENIED: 403,
  CONSENT_REQUIRED: 403,
  CONSENT_WITHDRAWN: 403,
  RIGHTS_UNVERIFIED: 409,
  RIGHTS_DISPUTED: 409,
  QUOTE_NOT_APPROVED: 409,
  EVIDENCE_MISSING: 422,
  UNSUPPORTED_CLAIM: 422,
  UPLOAD_INCOMPLETE: 409,
  CHECKSUM_MISMATCH: 422,
  MEDIA_UNSAFE: 422,
  MEDIA_PROCESSING_FAILED: 502,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_POLICY_REJECTED: 422,
  BUDGET_EXCEEDED: 429,
  EDITION_STALE: 409,
  DELETION_PENDING: 409,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  VALIDATION_FAILED: 400,
  INTERNAL_ERROR: 500,
};

export class ApiProblem extends Error {
  public constructor(
    public readonly code: ProblemCode,
    message: string,
    public readonly retryable = false,
    public readonly userAction?: string,
  ) {
    super(message);
  }
}

export function sendProblem(error: unknown, request: FastifyRequest, reply: FastifyReply): void {
  const problem =
    error instanceof ApiProblem
      ? error
      : error instanceof ZodError
        ? new ApiProblem('VALIDATION_FAILED', 'Request validation failed')
        : new ApiProblem('INTERNAL_ERROR', 'The request could not be completed', true);
  const status = statusByCode[problem.code];
  const body: ProblemDetails = {
    type: `https://api.familyhistorian.invalid/problems/${problem.code.toLowerCase().replaceAll('_', '-')}`,
    title: problem.code.replaceAll('_', ' '),
    status,
    code: problem.code,
    detail: problem.message,
    retryable: problem.retryable,
    ...(problem.userAction ? { userAction: problem.userAction } : {}),
    requestId: request.id,
  };
  void reply.status(status).type('application/problem+json').send(body);
}
