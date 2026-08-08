import { describe, expect, it } from 'vitest';
import { parseRuntimeEnvironment } from '../../packages/config/src/index.js';

const base = {
  NODE_ENV: 'production' as const,
  HOST: '0.0.0.0',
  PORT: '8080',
  DATABASE_URL: 'postgresql://user:password@example.invalid/db',
  REDIS_URL: 'rediss://:password@example.invalid:6380',
  SESSION_SECRET: 'replace-with-at-least-32-random-bytes',
  FIELD_ENCRYPTION_MASTER_KEY: 'replace-with-32-byte-base64-key',
  DOWNLOAD_SIGNING_SECRET: 'replace-with-at-least-32-random-bytes',
};

describe('runtime configuration', () => {
  it('rejects production placeholder secrets', () => {
    expect(() => parseRuntimeEnvironment(base)).toThrow(/placeholder/u);
  });

  it('accepts explicitly configured non-placeholder production secrets', () => {
    expect(
      parseRuntimeEnvironment({
        ...base,
        SESSION_SECRET: 'session-secret-0123456789-abcdefghijklmnopqrstuvwxyz',
        FIELD_ENCRYPTION_MASTER_KEY: 'field-key-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        DOWNLOAD_SIGNING_SECRET: 'download-secret-0123456789-!@#$%^&*()',
      }).NODE_ENV,
    ).toBe('production');
  });

  it('rejects production secrets with insufficient character diversity', () => {
    expect(() =>
      parseRuntimeEnvironment({
        ...base,
        SESSION_SECRET: 'a'.repeat(64),
        FIELD_ENCRYPTION_MASTER_KEY: 'b'.repeat(64),
        DOWNLOAD_SIGNING_SECRET: 'c'.repeat(64),
      }),
    ).toThrow(/character diversity/u);
  });
});
