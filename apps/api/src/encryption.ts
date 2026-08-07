import { createCipheriv, createHash, randomBytes } from 'node:crypto';

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

export function encryptRestrictedText(masterSecret: string, plaintext: string): string {
  if (masterSecret.length < 32) throw new Error('field encryption master key is too short');
  const wrappingKey = createHash('sha256').update(masterSecret, 'utf8').digest();
  const dataKey = randomBytes(32);
  return JSON.stringify({
    v: 1,
    alg: 'A256GCM',
    wrappedKey: seal(wrappingKey, dataKey),
    value: seal(dataKey, Buffer.from(plaintext, 'utf8')),
  });
}
