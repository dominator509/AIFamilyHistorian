import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export * from './rate-limit.js';

export const sessionSchema = z.object({
  userId: z.uuid(),
  organizationId: z.uuid(),
  archiveIds: z.array(z.uuid()).min(1),
  permissions: z.array(z.string().min(1)),
  expiresAt: z.number().int().positive(),
});
export type SessionPrincipal = z.infer<typeof sessionSchema>;
const MAX_SESSION_LIFETIME_SECONDS = 24 * 60 * 60;

function signSession(secret: string, payload: string): Buffer {
  return createHmac('sha256', secret).update(`v1.${payload}`, 'utf8').digest();
}

export function issueSessionToken(secret: string, principal: SessionPrincipal): string {
  if (secret.length < 32) throw new Error('session secret is too short');
  const parsed = sessionSchema.parse(principal);
  const now = Math.floor(Date.now() / 1000);
  if (parsed.expiresAt <= now || parsed.expiresAt > now + MAX_SESSION_LIFETIME_SECONDS)
    throw new Error('session lifetime is invalid');
  const payload = Buffer.from(JSON.stringify(parsed), 'utf8').toString('base64url');
  return `v1.${payload}.${signSession(secret, payload).toString('base64url')}`;
}

export function verifySessionToken(secret: string, token: string): SessionPrincipal {
  if (secret.length < 32) throw new Error('session secret is too short');
  const [version, payload, supplied] = token.split('.');
  if (version !== 'v1' || !payload || !supplied) throw new Error('AUTH_REQUIRED');
  const expected = signSession(secret, payload);
  const suppliedBuffer = Buffer.from(supplied, 'base64url');
  if (expected.length !== suppliedBuffer.length || !timingSafeEqual(expected, suppliedBuffer))
    throw new Error('AUTH_REQUIRED');
  const principal = sessionSchema.parse(
    JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
  );
  if (principal.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error('AUTH_REQUIRED');
  return principal;
}

export function parseAuthorizationHeader(value: string | undefined): string {
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/u.exec(value ?? '');
  if (!match) throw new Error('AUTH_REQUIRED');
  return match[1]!;
}

export function authorizeArchivePermission(
  principal: SessionPrincipal,
  archiveId: string,
  permission: string,
): void {
  if (!principal.archiveIds.includes(archiveId)) throw new Error('PERMISSION_DENIED');
  if (!principal.permissions.includes(permission) && !principal.permissions.includes('archive:*'))
    throw new Error('PERMISSION_DENIED');
}

export interface TotpEnrollment {
  readonly userId: string;
  readonly issuer: string;
  readonly label: string;
  readonly secretBase32: string;
  readonly otpauthUri: string;
}

export interface TotpFactor {
  readonly userId: string;
  readonly secretBase32: string;
  readonly enabledAt: string;
  readonly lastAcceptedStep: number | null;
}

export function createTotpEnrollment(input: {
  readonly userId: string;
  readonly label: string;
  readonly issuer?: string;
}): TotpEnrollment {
  if (!input.userId || !input.label) throw new Error('MFA_ENROLLMENT_INVALID');
  const issuer = input.issuer ?? 'AI Family Historian';
  const secretBase32 = encodeBase32(randomBytes(20));
  const otpauthUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(input.label)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  return Object.freeze({ ...input, issuer, secretBase32, otpauthUri });
}

export function verifyTotpCode(
  secretBase32: string,
  code: string,
  atMilliseconds = Date.now(),
  window = 1,
): number | null {
  if (!/^\d{6}$/u.test(code) || !Number.isInteger(window) || window < 0 || window > 2) return null;
  const key = decodeBase32(secretBase32);
  const currentStep = Math.floor(atMilliseconds / 30_000);
  for (let offset = -window; offset <= window; offset += 1) {
    const step = currentStep + offset;
    if (step < 0) continue;
    const expected = totpForStep(key, step);
    const expectedBytes = Buffer.from(expected, 'ascii');
    const suppliedBytes = Buffer.from(code, 'ascii');
    if (timingSafeEqual(expectedBytes, suppliedBytes)) return step;
  }
  return null;
}

export function acceptTotpCode(
  factor: TotpFactor,
  code: string,
  atMilliseconds = Date.now(),
): TotpFactor {
  const step = verifyTotpCode(factor.secretBase32, code, atMilliseconds);
  if (step === null || (factor.lastAcceptedStep !== null && step <= factor.lastAcceptedStep))
    throw new Error('MFA_REQUIRED');
  return Object.freeze({ ...factor, lastAcceptedStep: step });
}

export interface RecoveryCodeSet {
  readonly hashes: readonly string[];
  readonly generatedAt: string;
}

export function generateRecoveryCodes(count = 10): {
  codes: readonly string[];
  set: RecoveryCodeSet;
} {
  if (!Number.isInteger(count) || count < 5 || count > 20)
    throw new Error('RECOVERY_COUNT_INVALID');
  const codes = Array.from({ length: count }, () =>
    formatRecoveryCode(randomBytes(10).toString('hex')),
  );
  return Object.freeze({
    codes: Object.freeze(codes),
    set: Object.freeze({
      hashes: Object.freeze(codes.map(hashRecoveryCode)),
      generatedAt: new Date().toISOString(),
    }),
  });
}

export function consumeRecoveryCode(set: RecoveryCodeSet, code: string): RecoveryCodeSet {
  const hash = hashRecoveryCode(code);
  const index = set.hashes.findIndex((candidate) => candidate === hash);
  if (index < 0) throw new Error('RECOVERY_CODE_INVALID');
  return Object.freeze({
    ...set,
    hashes: Object.freeze(set.hashes.filter((_, candidateIndex) => candidateIndex !== index)),
  });
}

export function hashRecoveryCode(code: string): string {
  const normalized = code.replaceAll(/[-\s]/gu, '').toLowerCase();
  if (!/^[a-f0-9]{20}$/u.test(normalized)) throw new Error('RECOVERY_CODE_INVALID');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function totpForStep(key: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(value % 1_000_000).padStart(6, '0');
}

function formatRecoveryCode(hex: string): string {
  return `${hex.slice(0, 5)}-${hex.slice(5, 10)}-${hex.slice(10, 15)}-${hex.slice(15, 20)}`;
}

function encodeBase32(bytes: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let buffer = 0;
  let bits = 0;
  let output = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = input.replaceAll(/[=\s-]/gu, '').toUpperCase();
  let buffer = 0;
  let bits = 0;
  const output: number[] = [];
  for (const character of normalized) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error('MFA_SECRET_INVALID');
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}
