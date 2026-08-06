import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3';
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
        ChecksumAlgorithm: 'SHA256',
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
    parts: readonly CompletedPart[],
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

  public async delete(key: string): Promise<void> {
    await this.#client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  public destroy(): void {
    this.#client.destroy();
  }
}
