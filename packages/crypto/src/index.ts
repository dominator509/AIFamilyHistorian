import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';

export const MAX_RESTRICTED_TEXT_BYTES = 16 * 1024 * 1024;
export const MAX_RESTRICTED_BLOB_BYTES = 32 * 1024 * 1024;
const MAX_SEALED_COMPONENT_CHARS = 24 * 1024 * 1024;

const sealedBlobSchema = z.object({
  ciphertext: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/u)
    .max(MAX_SEALED_COMPONENT_CHARS),
  iv: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/u)
    .max(32),
  tag: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/u)
    .max(64),
});
const blobSchema = z.discriminatedUnion('v', [
  z.object({
    v: z.literal(1),
    alg: z.literal('A256GCM'),
    wrappedKey: sealedBlobSchema,
    value: sealedBlobSchema,
  }),
  z.object({
    v: z.literal(2),
    alg: z.literal('A256GCM'),
    scope: z.string().min(1).max(200),
    wrappedKey: sealedBlobSchema,
    value: sealedBlobSchema,
  }),
]);

export type EncryptedTextBlob = z.infer<typeof blobSchema>;

function normalizeMasterKey(masterSecret: string): Buffer {
  if (masterSecret.length < 32) throw new Error('field encryption master key is too short');
  return createHash('sha256').update(masterSecret, 'utf8').digest();
}

function scopedWrappingKey(masterSecret: string, scope: string): Buffer {
  if (!scope || scope.length > 200) throw new Error('field encryption scope is invalid');
  return createHmac('sha256', normalizeMasterKey(masterSecret))
    .update(`family-historian:field-key:v1:${scope}`, 'utf8')
    .digest();
}

function seal(key: Buffer, plaintext: Buffer): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  };
}

function open(key: Buffer, bundle: { ciphertext: string; iv: string; tag: string }): Buffer {
  const iv = Buffer.from(bundle.iv, 'base64url');
  const tag = Buffer.from(bundle.tag, 'base64url');
  const ciphertext = Buffer.from(bundle.ciphertext, 'base64url');
  if (iv.length !== 12 || tag.length !== 16)
    throw new Error('field encryption envelope metadata is invalid');
  if (ciphertext.length > MAX_RESTRICTED_TEXT_BYTES)
    throw new Error('field encryption ciphertext exceeds the allowed size');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  if (plaintext.length > MAX_RESTRICTED_TEXT_BYTES)
    throw new Error('field encryption plaintext exceeds the allowed size');
  return plaintext;
}

export function encryptRestrictedText(
  masterSecret: string,
  plaintext: string,
  scope?: string,
): string {
  const plaintextBytes = Buffer.from(plaintext, 'utf8');
  if (plaintextBytes.length > MAX_RESTRICTED_TEXT_BYTES)
    throw new Error('field encryption plaintext exceeds the allowed size');
  const wrappingKey = scope
    ? scopedWrappingKey(masterSecret, scope)
    : normalizeMasterKey(masterSecret);
  const dataKey = randomBytes(32);
  const wrappedKey = seal(wrappingKey, dataKey);
  const value = seal(dataKey, plaintextBytes);
  const blob = JSON.stringify({
    v: scope ? 2 : 1,
    alg: 'A256GCM',
    ...(scope ? { scope } : {}),
    wrappedKey,
    value,
  } as const);
  if (Buffer.byteLength(blob, 'utf8') > MAX_RESTRICTED_BLOB_BYTES)
    throw new Error('field encryption blob exceeds the allowed size');
  return blob;
}

export function decryptRestrictedText(masterSecret: string, blob: string, scope?: string): string {
  if (Buffer.byteLength(blob, 'utf8') > MAX_RESTRICTED_BLOB_BYTES)
    throw new Error('field encryption blob exceeds the allowed size');
  const parsed = blobSchema.parse(JSON.parse(blob));
  if (parsed.v === 2 && parsed.scope !== scope)
    throw new Error('field encryption scope does not match');
  const wrappingKey =
    parsed.v === 2
      ? scopedWrappingKey(masterSecret, parsed.scope)
      : normalizeMasterKey(masterSecret);
  const dataKey = open(wrappingKey, parsed.wrappedKey);
  const plaintext = open(dataKey, parsed.value);
  return new TextDecoder().decode(plaintext);
}
