import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ObjectStorage,
  originalObjectKey,
  parseStorageConfig,
} from '../../../packages/storage/src/index.js';
import { uuidV7 } from '../../../packages/database/src/index.js';

if (!process.env.R2_ENDPOINT) process.loadEnvFile('.env');
const storage = new ObjectStorage(parseStorageConfig(process.env));

afterAll(() => storage.destroy());

describe('S3-compatible object storage', () => {
  it('writes, verifies, reads, and deletes an immutable-key original', async () => {
    const bytes = new TextEncoder().encode('family historian fixity fixture');
    const checksum = createHash('sha256').update(bytes).digest('base64');
    const key = originalObjectKey(uuidV7(), uuidV7());
    expect(key).not.toContain('fixture');
    await storage.putOriginal(key, bytes, 'application/octet-stream', checksum);
    expect(await storage.readBytes(key)).toEqual(bytes);
    expect(await storage.head(key)).toMatchObject({
      byteSize: bytes.byteLength,
      expectedSha256: checksum,
    });
    const replacement = new TextEncoder().encode('mutated');
    const replacementChecksum = createHash('sha256').update(replacement).digest('base64');
    await expect(
      storage.putOriginal(key, replacement, 'text/plain', replacementChecksum),
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 412 } });
    expect(await storage.readBytes(key)).toEqual(bytes);
    await storage.delete(key);
    await expect(storage.head(key)).rejects.toThrow();
  });

  it('creates, signs, and aborts a real multipart upload', async () => {
    const key = originalObjectKey(uuidV7(), uuidV7());
    const checksum = createHash('sha256').update('multipart').digest('base64');
    const uploadId = await storage.beginMultipart(key, 'application/octet-stream', checksum);
    const url = await storage.signUploadPart(key, uploadId, 1, 60);
    expect(new URL(url).searchParams.get('uploadId')).toBe(uploadId);
    await storage.abortMultipart(key, uploadId);
  });
});
