import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const sessionSchema = z.object({
  userId: z.uuid(),
  organizationId: z.uuid(),
  archiveIds: z.array(z.uuid()).min(1),
  permissions: z.array(z.string().min(1)),
  expiresAt: z.number().int().positive(),
});
export type SessionPrincipal = z.infer<typeof sessionSchema>;

function signature(secret: string, payload: string): Buffer {
  return createHmac('sha256', secret).update(`v1.${payload}`, 'utf8').digest();
}

export function issueSessionToken(secret: string, principal: SessionPrincipal): string {
  if (secret.length < 32) throw new Error('session secret is too short');
  const payload = Buffer.from(JSON.stringify(sessionSchema.parse(principal)), 'utf8').toString(
    'base64url',
  );
  return `v1.${payload}.${signature(secret, payload).toString('base64url')}`;
}

export function verifySessionToken(secret: string, token: string): SessionPrincipal {
  if (secret.length < 32) throw new Error('session secret is too short');
  const [version, payload, supplied] = token.split('.');
  if (version !== 'v1' || !payload || !supplied) throw new Error('AUTH_REQUIRED');
  const expected = signature(secret, payload);
  const suppliedBuffer = Buffer.from(supplied, 'base64url');
  if (expected.length !== suppliedBuffer.length || !timingSafeEqual(expected, suppliedBuffer))
    throw new Error('AUTH_REQUIRED');
  const principal = sessionSchema.parse(
    JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
  );
  if (principal.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error('AUTH_REQUIRED');
  return principal;
}
