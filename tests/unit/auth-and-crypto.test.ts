import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  acceptTotpCode,
  authorizeArchivePermission,
  consumeRecoveryCode,
  createTotpEnrollment,
  generateRecoveryCodes,
  issueSessionToken,
  parseAuthorizationHeader,
  verifySessionToken,
  verifyTotpCode,
} from '../../packages/auth/src/index.js';
import { decryptRestrictedText, encryptRestrictedText } from '../../packages/crypto/src/index.js';

describe('session principal and auth policy', () => {
  const secret = '000000000000000000000000000000000000000000000000000000000000000000';

  const principal = {
    userId: '019fd8a1-f366-7961-b027-89cf42f5c218',
    organizationId: '019fd8a1-f366-7961-b027-89cf42f5c219',
    archiveIds: ['019fd8a1-f366-7961-b027-89cf42f5c220'],
    permissions: ['records:read', 'uploads:write', 'archive:*'],
    expiresAt: Math.floor(Date.now() / 1000) + 60,
  };

  it('issues and verifies an authentic bearer token', () => {
    const token = issueSessionToken(secret, principal);
    expect(token.startsWith('v1.')).toBe(true);
    const parsed = verifySessionToken(secret, token);
    expect(parsed.userId).toBe(principal.userId);
  });

  it('rejects invalid Authorization headers', () => {
    expect(() => parseAuthorizationHeader(undefined)).toThrow('AUTH_REQUIRED');
    expect(() => parseAuthorizationHeader('Token foo')).toThrow('AUTH_REQUIRED');
  });

  it('rejects forged tokens deterministically', () => {
    const token = issueSessionToken(secret, principal);
    const [version, payload] = token.split('.');
    const forged = `${version}.${payload}.${createHmac('sha256', secret).update('mismatch').digest('base64url')}`;
    expect(() => verifySessionToken(secret, forged)).toThrow('AUTH_REQUIRED');
  });

  it('authorizes scoped archive access only with permission', () => {
    const value = verifySessionToken(secret, issueSessionToken(secret, principal));
    expect(() => authorizeArchivePermission(value, 'other-archive', 'records:write')).toThrow(
      'PERMISSION_DENIED',
    );
    expect(() =>
      authorizeArchivePermission(value, '019fd8a1-f366-7961-b027-89cf42f5c220', 'records:write'),
    ).not.toThrow();
  });

  it('supports RFC-compatible TOTP enrollment, replay protection, and recovery codes', () => {
    const enrollment = createTotpEnrollment({
      userId: principal.userId,
      label: 'owner@example.test',
    });
    expect(enrollment.otpauthUri).toContain('otpauth://totp/');
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(verifyTotpCode(secret, '287082', 59_000)).toBe(1);
    expect(verifyTotpCode(secret, '000000', 59_000)).toBeNull();
    const factor = {
      userId: principal.userId,
      secretBase32: secret,
      enabledAt: '2026-08-07T00:00:00.000Z',
      lastAcceptedStep: null,
    };
    const accepted = acceptTotpCode(factor, '287082', 59_000);
    expect(() => acceptTotpCode(accepted, '287082', 59_000)).toThrow('MFA_REQUIRED');
    const recovery = generateRecoveryCodes(5);
    const consumed = consumeRecoveryCode(recovery.set, recovery.codes[0]!);
    expect(consumed.hashes).toHaveLength(4);
    expect(() => consumeRecoveryCode(consumed, recovery.codes[0]!)).toThrow(
      'RECOVERY_CODE_INVALID',
    );
  });
});

describe('restricted text envelope encryption', () => {
  it('encrypts and decrypts text with deterministic validation failure on tampering', () => {
    const masterKey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const plaintext = 'private family note';
    const encrypted = encryptRestrictedText(masterKey, plaintext);
    expect(decryptRestrictedText(masterKey, encrypted)).toBe(plaintext);

    const parsed = JSON.parse(encrypted) as {
      value: { ciphertext: string; iv: string; tag: string };
    };
    const tampered = {
      ...parsed,
      value: {
        ...parsed.value,
        ciphertext: 'tamper',
      },
    };
    expect(() => decryptRestrictedText(masterKey, JSON.stringify(tampered))).toThrow();
  });
});
