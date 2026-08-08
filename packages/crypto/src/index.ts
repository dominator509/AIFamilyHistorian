import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';

const sealedBlobSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  tag: z.string().min(1),
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
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(Buffer.from(bundle.tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(bundle.ciphertext, 'base64url')),
    decipher.final(),
  ]);
  return plaintext;
}

export function encryptRestrictedText(
  masterSecret: string,
  plaintext: string,
  scope?: string,
): string {
  const wrappingKey = scope
    ? scopedWrappingKey(masterSecret, scope)
    : normalizeMasterKey(masterSecret);
  const dataKey = randomBytes(32);
  const wrappedKey = seal(wrappingKey, dataKey);
  const value = seal(dataKey, Buffer.from(plaintext, 'utf8'));
  return JSON.stringify({
    v: scope ? 2 : 1,
    alg: 'A256GCM',
    ...(scope ? { scope } : {}),
    wrappedKey,
    value,
  } as const);
}

export function decryptRestrictedText(masterSecret: string, blob: string, scope?: string): string {
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
