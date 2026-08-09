import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MAX_MULTIPART_TOKEN_CHARS } from '@family-historian/contracts';
import type { StorageConfig } from './config.js';

export class ObjectStorageLimitError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ObjectStorageLimitError';
  }
}

/** Maximum object size that may be materialized into a single in-memory value. */
export const MAX_IN_MEMORY_OBJECT_BYTES = 256 * 1024 * 1024;
export const MAX_STREAMED_OBJECT_BYTES = 25 * 1024 * 1024 * 1024;
export const MAX_MULTIPART_PARTS = 10_000;
export const MAX_SIGNED_URL_EXPIRES_SECONDS = 60 * 60;
export const MAX_OBJECT_KEY_CHARS = 1_024;
/** S3 object keys are limited by UTF-8 encoded byte length, not JavaScript code units. */
export const MAX_OBJECT_KEY_BYTES = 1_024;
export const MAX_PROVIDER_UPLOAD_ID_CHARS = 1_024;
/** Keep opaque provider upload identifiers bounded in the wire representation too. */
export const MAX_PROVIDER_UPLOAD_ID_BYTES = 1_024;
export const MAX_STORAGE_CONTENT_TYPE_BYTES = 255;

export function validateObjectKey(key: string): void {
  const hasControlCharacter =
    typeof key === 'string' &&
    [...key].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f;
    });
  if (
    typeof key !== 'string' ||
    key.length < 1 ||
    key.length > MAX_OBJECT_KEY_CHARS ||
    Buffer.byteLength(key, 'utf8') > MAX_OBJECT_KEY_BYTES ||
    hasControlCharacter
  )
    throw new RangeError('object storage key is invalid');
}

export function validateProviderUploadId(uploadId: string): void {
  if (
    typeof uploadId !== 'string' ||
    uploadId.length < 1 ||
    uploadId.length > MAX_PROVIDER_UPLOAD_ID_CHARS ||
    Buffer.byteLength(uploadId, 'utf8') > MAX_PROVIDER_UPLOAD_ID_BYTES ||
    [...uploadId].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f;
    })
  )
    throw new RangeError('object storage upload id is invalid');
}

export function validateStorageContentType(contentType: string): void {
  if (
    typeof contentType !== 'string' ||
    contentType.length < 1 ||
    contentType.length > 255 ||
    Buffer.byteLength(contentType, 'utf8') > MAX_STORAGE_CONTENT_TYPE_BYTES ||
    !/^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/u.test(contentType)
  )
    throw new RangeError('object storage content type is invalid');
}

export function validateSha256Base64(value: string): void {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/u.test(value))
    throw new RangeError('object storage SHA-256 checksum is invalid');
}

export class ObjectStorage {
  readonly #client: S3Client;
  public constructor(private readonly config: StorageConfig) {
    this.#client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      maxAttempts: 3,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  public async beginMultipart(
    key: string,
    contentType: string,
    sha256Base64: string,
  ): Promise<string> {
    validateObjectKey(key);
    validateStorageContentType(contentType);
    validateSha256Base64(sha256Base64);
    const response = await this.#client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: contentType,
        Metadata: { 'expected-sha256': sha256Base64 },
      }),
    );
    if (!response.UploadId) throw new Error('object storage did not return an upload id');
    validateProviderUploadId(response.UploadId);
    return response.UploadId;
  }

  public async putOriginal(
    key: string,
    bytes: Uint8Array,
    contentType: string,
    sha256Base64: string,
  ): Promise<void> {
    validateObjectKey(key);
    validateStorageContentType(contentType);
    validateSha256Base64(sha256Base64);
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        ChecksumSHA256: sha256Base64,
        IfNoneMatch: '*',
        Metadata: { 'expected-sha256': sha256Base64 },
      }),
    );
  }

  public async signUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn = 900,
  ): Promise<string> {
    validateObjectKey(key);
    validateProviderUploadId(uploadId);
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000)
      throw new RangeError('multipart part number is invalid');
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > MAX_SIGNED_URL_EXPIRES_SECONDS)
      throw new RangeError('multipart signed URL expiry is invalid');
    return getSignedUrl(
      this.#client,
      new UploadPartCommand({
        Bucket: this.config.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn },
    );
  }

  public async completeMultipart(
    key: string,
    uploadId: string,
    parts: readonly CompletedUploadPart[],
  ): Promise<void> {
    validateObjectKey(key);
    validateProviderUploadId(uploadId);
    const validatedParts = validateCompletedUploadParts(parts);
    await this.#client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        UploadId: uploadId,
        IfNoneMatch: '*',
        MultipartUpload: {
          Parts: [...validatedParts],
        },
      }),
    );
  }

  public async abortMultipart(key: string, uploadId: string): Promise<void> {
    validateObjectKey(key);
    validateProviderUploadId(uploadId);
    await this.#client.send(
      new AbortMultipartUploadCommand({ Bucket: this.config.bucket, Key: key, UploadId: uploadId }),
    );
  }

  public async listMultipartParts(
    key: string,
    uploadId: string,
  ): Promise<readonly { partNumber: number; etag: string; byteSize: number }[]> {
    validateObjectKey(key);
    validateProviderUploadId(uploadId);
    const parts: { partNumber: number; etag: string; byteSize: number }[] = [];
    const seenPartNumbers = new Set<number>();
    let marker: string | undefined;
    for (let page = 0; page < 100; page += 1) {
      const response = await this.#client.send(
        new ListPartsCommand({
          Bucket: this.config.bucket,
          Key: key,
          UploadId: uploadId,
          ...(marker === undefined ? {} : { PartNumberMarker: marker }),
        }),
      );
      for (const part of response.Parts ?? []) {
        const partNumber = part.PartNumber;
        const byteSize = part.Size ?? 0;
        if (
          partNumber === undefined ||
          !Number.isInteger(partNumber) ||
          partNumber < 1 ||
          partNumber > MAX_MULTIPART_PARTS ||
          !part.ETag ||
          part.ETag.length > MAX_MULTIPART_TOKEN_CHARS ||
          !Number.isSafeInteger(byteSize) ||
          byteSize < 0
        )
          throw new Error('object storage returned an invalid multipart part');
        if (seenPartNumbers.has(partNumber))
          throw new Error('object storage returned a duplicate multipart part');
        seenPartNumbers.add(partNumber);
        parts.push({
          partNumber,
          etag: part.ETag,
          byteSize,
        });
        if (parts.length > MAX_MULTIPART_PARTS)
          throw new ObjectStorageLimitError('object storage returned too many multipart parts');
      }
      if (!response.IsTruncated) return Object.freeze(parts);
      if (!response.NextPartNumberMarker)
        throw new Error('object storage returned a truncated part list without a marker');
      marker = String(response.NextPartNumberMarker);
    }
    throw new Error('object storage multipart part list exceeded the page limit');
  }

  public async head(
    key: string,
  ): Promise<{ byteSize: number; contentType?: string; expectedSha256?: string }> {
    validateObjectKey(key);
    const response = await this.#client.send(
      new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    return {
      byteSize: response.ContentLength ?? 0,
      ...(response.ContentType ? { contentType: response.ContentType } : {}),
      ...(response.Metadata?.['expected-sha256']
        ? { expectedSha256: response.Metadata['expected-sha256'] }
        : {}),
    };
  }

  public async readBytes(key: string, maxBytes = MAX_IN_MEMORY_OBJECT_BYTES): Promise<Uint8Array> {
    validateObjectKey(key);
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_IN_MEMORY_OBJECT_BYTES)
      throw new RangeError('object in-memory byte ceiling is invalid');
    const response = await this.#client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    const body = response.Body as AsyncIterable<Uint8Array> | undefined;
    if (!body || typeof body[Symbol.asyncIterator] !== 'function')
      throw new Error('object body is not streamable');
    return readBoundedBody(body, maxBytes, 'object in-memory byte ceiling');
  }

  /** Read only a bounded object prefix for content-signature validation. */
  public async readPrefix(key: string, maxBytes = 4096): Promise<Uint8Array> {
    validateObjectKey(key);
    if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_048_576)
      throw new RangeError('object prefix limit is invalid');
    const response = await this.#client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Range: `bytes=0-${maxBytes - 1}`,
      }),
    );
    const body = response.Body as AsyncIterable<Uint8Array> | undefined;
    if (!body || typeof body[Symbol.asyncIterator] !== 'function')
      throw new Error('object body is not streamable');
    return readBoundedBody(body, maxBytes, 'object prefix byte ceiling');
  }

  /** Stream an object to a worker-owned file without buffering the full payload in memory. */
  public async downloadToFile(
    key: string,
    destinationPath: string,
    maxBytes = MAX_STREAMED_OBJECT_BYTES,
  ): Promise<{ sha256Base64: string; byteSize: number }> {
    validateObjectKey(key);
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_STREAMED_OBJECT_BYTES)
      throw new RangeError('object download byte ceiling is invalid');
    const response = await this.#client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    const body = response.Body as AsyncIterable<Uint8Array> | undefined;
    if (!body || typeof body[Symbol.asyncIterator] !== 'function')
      throw new Error('object body is not streamable');
    const output = createWriteStream(destinationPath, { flags: 'wx' });
    const hash = createHash('sha256');
    let byteSize = 0;
    try {
      for await (const chunk of body) {
        if (byteSize + chunk.byteLength > maxBytes)
          throw new ObjectStorageLimitError('object exceeds the download byte ceiling');
        hash.update(chunk);
        byteSize += chunk.byteLength;
        if (!output.write(chunk))
          await new Promise<void>((resolve) => output.once('drain', resolve));
      }
      output.end();
      await finished(output);
      return { sha256Base64: hash.digest('base64'), byteSize };
    } catch (error) {
      output.destroy();
      throw error;
    }
  }

  /** Stream an object once to verify its actual bytes without buffering the payload. */
  public async sha256Base64(
    key: string,
    maxBytes = MAX_STREAMED_OBJECT_BYTES,
  ): Promise<{ sha256Base64: string; byteSize: number }> {
    validateObjectKey(key);
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_STREAMED_OBJECT_BYTES)
      throw new RangeError('object hash byte ceiling is invalid');
    const response = await this.#client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    const body = response.Body as AsyncIterable<Uint8Array> | undefined;
    if (!body || typeof body[Symbol.asyncIterator] !== 'function')
      throw new Error('object body is not streamable');
    const hash = createHash('sha256');
    let byteSize = 0;
    for await (const chunk of body) {
      if (byteSize + chunk.byteLength > maxBytes)
        throw new ObjectStorageLimitError('object hash exceeded the byte ceiling');
      hash.update(chunk);
      byteSize += chunk.byteLength;
    }
    return { sha256Base64: hash.digest('base64'), byteSize };
  }

  public async delete(key: string): Promise<void> {
    validateObjectKey(key);
    await this.#client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  public destroy(): void {
    this.#client.destroy();
  }
}

async function readBoundedBody(
  body: AsyncIterable<Uint8Array>,
  maxBytes: number,
  label: string,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let byteSize = 0;
  for await (const chunk of body) {
    if (byteSize + chunk.byteLength > maxBytes)
      throw new ObjectStorageLimitError(`${label} exceeded`);
    chunks.push(chunk);
    byteSize += chunk.byteLength;
  }
  const result = new Uint8Array(byteSize);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export interface CompletedUploadPart {
  ETag?: string;
  PartNumber?: number;
  ChecksumSHA256?: string;
}

/**
 * Validate provider-facing multipart completion data before making a network call.
 * API schemas perform the same checks at the HTTP boundary, but this method is
 * also used by workers and live-fire tooling and must not trust those callers.
 */
export function validateCompletedUploadParts(
  parts: readonly CompletedUploadPart[],
): readonly CompletedUploadPart[] {
  if (parts.length === 0) throw new Error('multipart completion requires at least one part');
  if (parts.length > MAX_MULTIPART_PARTS)
    throw new ObjectStorageLimitError('multipart completion contains too many parts');
  const seen = new Set<number>();
  const normalized = parts.map((part) => {
    const partNumber = part.PartNumber;
    const etag = part.ETag;
    if (
      partNumber === undefined ||
      !Number.isInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > MAX_MULTIPART_PARTS ||
      typeof etag !== 'string' ||
      etag.trim().length === 0 ||
      etag.length > MAX_MULTIPART_TOKEN_CHARS ||
      (part.ChecksumSHA256 !== undefined &&
        (typeof part.ChecksumSHA256 !== 'string' ||
          part.ChecksumSHA256.trim().length === 0 ||
          part.ChecksumSHA256.length > MAX_MULTIPART_TOKEN_CHARS))
    )
      throw new Error('multipart completion contains an invalid part');
    if (seen.has(partNumber))
      throw new Error('multipart completion contains duplicate part numbers');
    seen.add(partNumber);
    return Object.freeze({
      ETag: etag,
      PartNumber: partNumber,
      ...(part.ChecksumSHA256 ? { ChecksumSHA256: part.ChecksumSHA256 } : {}),
    });
  });
  return Object.freeze(normalized.sort((left, right) => left.PartNumber - right.PartNumber));
}
