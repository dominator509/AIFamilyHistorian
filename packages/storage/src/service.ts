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
import type { StorageConfig } from './config.js';

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
    const response = await this.#client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: contentType,
        Metadata: { 'expected-sha256': sha256Base64 },
      }),
    );
    if (!response.UploadId) throw new Error('object storage did not return an upload id');
    return response.UploadId;
  }

  public async putOriginal(
    key: string,
    bytes: Uint8Array,
    contentType: string,
    sha256Base64: string,
  ): Promise<void> {
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
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000)
      throw new RangeError('multipart part number is invalid');
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
    if (parts.length === 0) throw new Error('multipart completion requires at least one part');
    await this.#client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        UploadId: uploadId,
        IfNoneMatch: '*',
        MultipartUpload: {
          Parts: [...parts].sort((left, right) => (left.PartNumber ?? 0) - (right.PartNumber ?? 0)),
        },
      }),
    );
  }

  public async abortMultipart(key: string, uploadId: string): Promise<void> {
    await this.#client.send(
      new AbortMultipartUploadCommand({ Bucket: this.config.bucket, Key: key, UploadId: uploadId }),
    );
  }

  public async listMultipartParts(
    key: string,
    uploadId: string,
  ): Promise<readonly { partNumber: number; etag: string; byteSize: number }[]> {
    const parts: { partNumber: number; etag: string; byteSize: number }[] = [];
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
        if (part.PartNumber === undefined || !part.ETag) continue;
        parts.push({
          partNumber: part.PartNumber,
          etag: part.ETag,
          byteSize: part.Size ?? 0,
        });
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

  public async readBytes(key: string): Promise<Uint8Array> {
    const response = await this.#client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    if (!response.Body) throw new Error('object body is missing');
    return response.Body.transformToByteArray();
  }

  /** Stream an object to a worker-owned file without buffering the full payload in memory. */
  public async downloadToFile(
    key: string,
    destinationPath: string,
  ): Promise<{ sha256Base64: string; byteSize: number }> {
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
  public async sha256Base64(key: string): Promise<{ sha256Base64: string; byteSize: number }> {
    const response = await this.#client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    const body = response.Body as AsyncIterable<Uint8Array> | undefined;
    if (!body || typeof body[Symbol.asyncIterator] !== 'function')
      throw new Error('object body is not streamable');
    const hash = createHash('sha256');
    let byteSize = 0;
    for await (const chunk of body) {
      hash.update(chunk);
      byteSize += chunk.byteLength;
    }
    return { sha256Base64: hash.digest('base64'), byteSize };
  }

  public async delete(key: string): Promise<void> {
    await this.#client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  public destroy(): void {
    this.#client.destroy();
  }
}

export interface CompletedUploadPart {
  ETag?: string;
  PartNumber?: number;
  ChecksumSHA256?: string;
}
