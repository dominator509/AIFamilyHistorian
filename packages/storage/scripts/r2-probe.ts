import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

const endpoint = process.env.R2_ENDPOINT?.trim();
const bucket = process.env.R2_BUCKET?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey)
  throw new Error('R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required');

const url = new URL(endpoint);
const client = new S3Client({
  region: 'auto',
  endpoint: url.toString().replace(/\/$/u, ''),
  forcePathStyle: ['127.0.0.1', 'localhost', '::1'].includes(url.hostname),
  credentials: { accessKeyId, secretAccessKey },
  maxAttempts: 2,
});

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log('r2: authenticated bucket access ok');
} finally {
  client.destroy();
}
