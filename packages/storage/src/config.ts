import { z } from 'zod';

const storageEnvironmentSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(16),
  R2_BUCKET: z.string().min(3),
  R2_ENDPOINT: z.url(),
});

export interface StorageConfig {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
  readonly endpoint: string;
  readonly forcePathStyle: boolean;
}

export function parseStorageConfig(source: NodeJS.ProcessEnv): StorageConfig {
  const value = storageEnvironmentSchema.parse(source);
  const endpoint = new URL(value.R2_ENDPOINT);
  const nodeEnv = source.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') {
    if (endpoint.protocol !== 'https:') throw new Error('production object storage requires HTTPS');
    if (['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname))
      throw new Error('production object storage cannot use a local endpoint');
  }
  return Object.freeze({
    accountId: value.R2_ACCOUNT_ID,
    accessKeyId: value.R2_ACCESS_KEY_ID,
    secretAccessKey: value.R2_SECRET_ACCESS_KEY,
    bucket: value.R2_BUCKET,
    endpoint: endpoint.toString().replace(/\/$/, ''),
    // Local HTTP endpoints include Docker service names (for example
    // `object-storage`) that cannot resolve an S3 virtual-host bucket name.
    // Production HTTPS endpoints retain provider-compatible virtual-host mode.
    forcePathStyle:
      endpoint.protocol === 'http:' ||
      endpoint.hostname === '127.0.0.1' ||
      endpoint.hostname === 'localhost',
  });
}
