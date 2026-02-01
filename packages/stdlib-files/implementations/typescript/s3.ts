/**
 * AWS S3 Storage Provider
 * 
 * Implementation of StorageProvider using AWS S3.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  StorageProvider,
  StorageMetadata,
  PresignedUrlOptions,
  UploadOptions,
  MultipartUploadOptions,
  MultipartUpload,
  UploadPartOptions,
  UploadedPart,
  CompleteMultipartOptions,
  CopyOptions,
  ListOptions,
  ListResult,
} from './storage.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface S3Config {
  provider: 'S3';
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  checksumAlgorithm?: 'SHA256' | 'SHA1' | 'CRC32' | 'CRC32C';
}

// ============================================================================
// S3 STORAGE PROVIDER
// ============================================================================

export class S3StorageProvider implements StorageProvider {
  readonly name = 'S3';
  readonly bucket: string;
  
  private client: S3Client;
  private checksumAlgorithm?: 'SHA256' | 'SHA1' | 'CRC32' | 'CRC32C';

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.checksumAlgorithm = config.checksumAlgorithm;

    const clientConfig: S3ClientConfig = {
      region: config.region,
    };

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }

    if (config.forcePathStyle) {
      clientConfig.forcePathStyle = true;
    }

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.client = new S3Client(clientConfig);
  }

  async createPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    let command;

    switch (options.operation) {
      case 'GET':
        command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: options.key,
          ResponseContentType: options.responseContentType,
          ResponseContentDisposition: options.responseContentDisposition,
        });
        break;

      case 'PUT':
        command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: options.key,
          ContentType: options.contentType,
          ContentLength: options.contentLength,
          ChecksumSHA256: options.checksum,
          Metadata: options.metadata,
        });
        break;

      case 'DELETE':
        command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: options.key,
        });
        break;

      case 'HEAD':
        command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: options.key,
        });
        break;

      default:
        throw new Error(`Unsupported operation: ${options.operation}`);
    }

    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn,
    });
  }

  async upload(options: UploadOptions): Promise<StorageMetadata> {
    let body: Buffer | Uint8Array | ReadableStream<Uint8Array>;
    
    if (Buffer.isBuffer(options.body) || options.body instanceof Uint8Array) {
      body = options.body;
    } else {
      // Convert stream to buffer for S3 SDK
      const chunks: Uint8Array[] = [];
      const reader = options.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      body = Buffer.concat(chunks);
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: options.key,
      Body: body,
      ContentType: options.contentType,
      ContentLength: options.contentLength,
      ChecksumSHA256: options.checksum,
      Metadata: options.metadata,
    });

    const response = await this.client.send(command);

    return {
      key: options.key,
      size: options.contentLength ?? (body as Buffer).length,
      contentType: options.contentType,
      checksum: options.checksum,
      etag: response.ETag,
      lastModified: new Date(),
      metadata: options.metadata ?? {},
    };
  }

  async download(key: string): Promise<{
    body: ReadableStream<Uint8Array>;
    metadata: StorageMetadata;
  }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`No body in response for key: ${key}`);
    }

    const metadata: StorageMetadata = {
      key,
      size: response.ContentLength ?? 0,
      contentType: response.ContentType ?? 'application/octet-stream',
      checksum: response.ChecksumSHA256,
      etag: response.ETag,
      lastModified: response.LastModified ?? new Date(),
      metadata: response.Metadata ?? {},
    };

    // Convert AWS SDK stream to web ReadableStream
    const awsStream = response.Body as AsyncIterable<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        for await (const chunk of awsStream) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    return { body, metadata };
  }

  async getMetadata(key: string): Promise<StorageMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        key,
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/octet-stream',
        checksum: response.ChecksumSHA256,
        etag: response.ETag,
        lastModified: response.LastModified ?? new Date(),
        metadata: response.Metadata ?? {},
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async deleteMany(keys: string[]): Promise<{
    deleted: string[];
    errors: Array<{ key: string; error: string }>;
  }> {
    if (keys.length === 0) {
      return { deleted: [], errors: [] };
    }

    // S3 supports up to 1000 objects per delete request
    const batches = [];
    for (let i = 0; i < keys.length; i += 1000) {
      batches.push(keys.slice(i, i + 1000));
    }

    const deleted: string[] = [];
    const errors: Array<{ key: string; error: string }> = [];

    for (const batch of batches) {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: batch.map(Key => ({ Key })),
          Quiet: false,
        },
      });

      const response = await this.client.send(command);

      if (response.Deleted) {
        for (const obj of response.Deleted) {
          if (obj.Key) {
            deleted.push(obj.Key);
          }
        }
      }

      if (response.Errors) {
        for (const err of response.Errors) {
          if (err.Key) {
            errors.push({
              key: err.Key,
              error: err.Message ?? 'Unknown error',
            });
          }
        }
      }
    }

    return { deleted, errors };
  }

  async copy(options: CopyOptions): Promise<StorageMetadata> {
    const sourceBucket = options.sourceBucket ?? this.bucket;
    const copySource = `${sourceBucket}/${options.sourceKey}`;

    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      Key: options.destinationKey,
      CopySource: copySource,
      Metadata: options.metadata,
      MetadataDirective: options.metadata ? 'REPLACE' : 'COPY',
    });

    const response = await this.client.send(command);

    // Get full metadata of the copied object
    const metadata = await this.getMetadata(options.destinationKey);
    if (!metadata) {
      throw new Error('Failed to get metadata of copied object');
    }

    return metadata;
  }

  async list(options: ListOptions): Promise<ListResult> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: options.prefix,
      Delimiter: options.delimiter,
      MaxKeys: options.maxKeys,
      ContinuationToken: options.continuationToken,
    });

    const response = await this.client.send(command);

    const objects: StorageMetadata[] = (response.Contents ?? []).map(obj => ({
      key: obj.Key ?? '',
      size: obj.Size ?? 0,
      contentType: 'application/octet-stream', // Not returned by list
      etag: obj.ETag,
      lastModified: obj.LastModified ?? new Date(),
      metadata: {},
    }));

    const prefixes = (response.CommonPrefixes ?? [])
      .map(p => p.Prefix)
      .filter((p): p is string => p !== undefined);

    return {
      objects,
      prefixes,
      isTruncated: response.IsTruncated ?? false,
      continuationToken: response.NextContinuationToken,
    };
  }

  async createMultipartUpload(options: MultipartUploadOptions): Promise<MultipartUpload> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: options.key,
      ContentType: options.contentType,
      Metadata: options.metadata,
    });

    const response = await this.client.send(command);

    if (!response.UploadId) {
      throw new Error('No upload ID returned');
    }

    return {
      uploadId: response.UploadId,
      key: options.key,
    };
  }

  async uploadPart(options: UploadPartOptions): Promise<UploadedPart> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: options.key,
      UploadId: options.uploadId,
      PartNumber: options.partNumber,
      Body: options.body,
    });

    const response = await this.client.send(command);

    if (!response.ETag) {
      throw new Error('No ETag returned for part');
    }

    return {
      partNumber: options.partNumber,
      etag: response.ETag,
      size: options.body.length,
    };
  }

  async completeMultipartUpload(options: CompleteMultipartOptions): Promise<StorageMetadata> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: options.key,
      UploadId: options.uploadId,
      MultipartUpload: {
        Parts: options.parts.map(part => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    });

    const response = await this.client.send(command);

    // Get full metadata
    const metadata = await this.getMetadata(options.key);
    if (!metadata) {
      throw new Error('Failed to get metadata of completed upload');
    }

    return metadata;
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    });

    await this.client.send(command);
  }

  /**
   * Get presigned URL for multipart upload part
   */
  async getPresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn: number
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createS3Provider(config: Omit<S3Config, 'provider'>): S3StorageProvider {
  return new S3StorageProvider({ ...config, provider: 'S3' });
}

/**
 * Create S3 provider with environment variable configuration
 */
export function createS3ProviderFromEnv(): S3StorageProvider {
  const bucket = process.env['S3_BUCKET'];
  const region = process.env['S3_REGION'] ?? process.env['AWS_REGION'];
  
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is required');
  }
  
  if (!region) {
    throw new Error('S3_REGION or AWS_REGION environment variable is required');
  }

  return new S3StorageProvider({
    provider: 'S3',
    bucket,
    region,
    endpoint: process.env['S3_ENDPOINT'],
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
    forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] === 'true',
  });
}
