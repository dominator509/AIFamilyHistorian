import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, open, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform, type TransformCallback } from 'node:stream';

const MAGIC = Buffer.from('AFH-BACKUP-V1\n', 'ascii');
const IV_BYTES = 12;
const TAG_BYTES = 16;

function keyFromEnvironment(): Buffer {
  const value = process.env.BACKUP_ENCRYPTION_KEY ?? '';
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must decode to 32 bytes');
  return key;
}

async function encrypt(inputPath: string, outputPath: string): Promise<void> {
  if (inputPath === outputPath) throw new Error('backup input and output must differ');
  const nonce = randomBytes(IV_BYTES);
  const streamCipher = createCipheriv('aes-256-gcm', keyFromEnvironment(), nonce);
  let headerWritten = false;
  const envelope = new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
      if (!headerWritten) {
        this.push(MAGIC);
        this.push(nonce);
        headerWritten = true;
      }
      this.push(chunk);
      callback();
    },
    flush(callback: TransformCallback) {
      if (!headerWritten) {
        this.push(MAGIC);
        this.push(nonce);
      }
      this.push(streamCipher.getAuthTag());
      callback();
    },
  });
  await pipeline(
    createReadStream(inputPath),
    streamCipher,
    envelope,
    createWriteStream(outputPath),
  );
  await chmod(outputPath, 0o600);
}

async function decrypt(inputPath: string, outputPath: string): Promise<void> {
  const input = await open(inputPath, 'r');
  try {
    const headerLength = MAGIC.length + IV_BYTES;
    const header = Buffer.alloc(headerLength);
    const headerRead = await input.read(header, 0, header.length, 0);
    if (headerRead.bytesRead !== header.length || !header.subarray(0, MAGIC.length).equals(MAGIC))
      throw new Error('backup envelope header is invalid');
    const fileSize = (await stat(inputPath)).size;
    if (fileSize < headerLength + TAG_BYTES) throw new Error('backup envelope is truncated');
    const tag = Buffer.alloc(TAG_BYTES);
    const tagRead = await input.read(tag, 0, tag.length, fileSize - TAG_BYTES);
    if (tagRead.bytesRead !== tag.length) throw new Error('backup envelope tag is truncated');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFromEnvironment(),
      header.subarray(MAGIC.length),
    );
    decipher.setAuthTag(tag);
    const ciphertext = createReadStream(inputPath, {
      start: headerLength,
      end: fileSize - TAG_BYTES - 1,
    });
    const output = outputPath === '-' ? process.stdout : createWriteStream(outputPath);
    await pipeline(ciphertext, decipher, output);
    if (outputPath !== '-') await chmod(outputPath, 0o600);
  } finally {
    await input.close();
  }
}

const [, , operation, inputPath, outputPath] = process.argv;
if (!operation || !inputPath || !outputPath || !['encrypt', 'decrypt'].includes(operation))
  throw new Error('usage: tsx scripts/backup-crypto.ts encrypt|decrypt <input> <output>');
if (operation === 'encrypt') await encrypt(inputPath, outputPath);
else await decrypt(inputPath, outputPath);
