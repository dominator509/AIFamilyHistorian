import { describe, expect, it } from 'vitest';
import { parseStorageConfig } from '../../packages/storage/src/config.js';

const base = {
  R2_ACCOUNT_ID: 'local',
  R2_ACCESS_KEY_ID: 'local-access-key',
  R2_SECRET_ACCESS_KEY: 'local-secret-access-key',
  R2_BUCKET: 'family-historian-local',
  R2_ENDPOINT: 'http://127.0.0.1:39000',
};

describe('storage configuration', () => {
  it('uses the supplied NODE_ENV rather than ambient process state', () => {
    expect(() => parseStorageConfig({ ...base, NODE_ENV: 'production' })).toThrow('requires HTTPS');
  });

  it('rejects local endpoints in production even when HTTPS is used', () => {
    expect(() =>
      parseStorageConfig({
        ...base,
        NODE_ENV: 'production',
        R2_ENDPOINT: 'https://localhost:39000',
      }),
    ).toThrow('cannot use a local endpoint');
  });

  it('accepts local development storage', () => {
    expect(parseStorageConfig({ ...base, NODE_ENV: 'development' }).forcePathStyle).toBe(true);
  });
});
