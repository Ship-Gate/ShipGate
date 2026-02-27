/**
 * Storage Provider Interface
 * 
 * Abstract interface for file storage backends.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface StorageConfig {
  provider: 'S3' | 'GCS' | 'AZURE_BLOB' | 'LOCAL';
  bucket: string;
  region?: string;
  endpoint?: string;
}

export interface StorageMetadata {
  key: string;
  size: number;
  contentType: string;
  checksum?: string;
  etag?: string;
  lastModified: Date;
  metadata: Record<string, string>;
}

export interface PresignedUrlOptions {
  key: string;
  operation: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  expiresIn: number; // seconds
  contentType?: string;
  contentLength?: number;
  checksum?: string;
  responseContentType?: string;
  responseContentDisposition?: string;
  metadata?: Record<string, string>;
}

export interface UploadOptions {
  key: string;
  body: Buffer | Uint8Array | ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: number;
  checksum?: string;
  metadata?: Record<string, string>;
}

export interface MultipartUploadOptions {
  key: string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface MultipartUpload {
  uploadId: string;
  key: string;
}

export interface UploadPartOptions {
  key: string;
  uploadId: string;
  partNumber: number;
  body: Buffer | Uint8Array;
}

export interface UploadedPart {
  partNumber: number;
  etag: string;
  size: number;
}

export interface CompleteMultipartOptions {
  key: string;
  uploadId: string;
  parts: UploadedPart[];
}

export interface CopyOptions {
  sourceKey: string;
  destinationKey: string;
  sourceBucket?: string;
  metadata?: Record<string, string>;
}

export interface ListOptions {
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListResult {
  objects: StorageMetadata[];
  prefixes: string[];
  isTruncated: boolean;
  continuationToken?: string;
}

// ============================================================================
// STORAGE PROVIDER INTERFACE
// ============================================================================

export interface StorageProvider {
  /** Provider name */
  readonly name: string;
  
  /** Bucket name */
  readonly bucket: string;

  /**
   * Create a presigned URL for direct client access
   */
  createPresignedUrl(options: PresignedUrlOptions): Promise<string>;

  /**
   * Upload a file directly
   */
  upload(options: UploadOptions): Promise<StorageMetadata>;

  /**
   * Download a file
   */
  download(key: string): Promise<{
    body: ReadableStream<Uint8Array>;
    metadata: StorageMetadata;
  }>;

  /**
   * Get file metadata without downloading
   */
  getMetadata(key: string): Promise<StorageMetadata | null>;

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Delete a file
   */
  delete(key: string): Promise<void>;

  /**
   * Delete multiple files
   */
  deleteMany(keys: string[]): Promise<{
    deleted: string[];
    errors: Array<{ key: string; error: string }>;
  }>;

  /**
   * Copy a file
   */
  copy(options: CopyOptions): Promise<StorageMetadata>;

  /**
   * List files with prefix
   */
  list(options: ListOptions): Promise<ListResult>;

  /**
   * Initiate multipart upload
   */
  createMultipartUpload(options: MultipartUploadOptions): Promise<MultipartUpload>;

  /**
   * Upload a part in multipart upload
   */
  uploadPart(options: UploadPartOptions): Promise<UploadedPart>;

  /**
   * Complete multipart upload
   */
  completeMultipartUpload(options: CompleteMultipartOptions): Promise<StorageMetadata>;

  /**
   * Abort multipart upload
   */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
}

// ============================================================================
// IN-MEMORY STORAGE (for testing)
// ============================================================================

export class InMemoryStorageProvider implements StorageProvider {
  readonly name = 'IN_MEMORY';
  
  private files = new Map<string, {
    body: Buffer;
    metadata: StorageMetadata;
  }>();
  
  private multipartUploads = new Map<string, {
    key: string;
    parts: Map<number, { body: Buffer; etag: string }>;
    contentType: string;
    metadata?: Record<string, string>;
  }>();

  constructor(public readonly bucket: string = 'test-bucket') {}

  async createPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    const expires = Date.now() + options.expiresIn * 1000;
    const params = new URLSearchParams({
      key: options.key,
      operation: options.operation,
      expires: expires.toString(),
    });
    
    if (options.contentType) {
      params.set('contentType', options.contentType);
    }
    
    return `https://${this.bucket}.storage.example.com/${options.key}?${params.toString()}`;
  }

  async upload(options: UploadOptions): Promise<StorageMetadata> {
    let body: Buffer;
    
    if (Buffer.isBuffer(options.body)) {
      body = options.body;
    } else if (options.body instanceof Uint8Array) {
      body = Buffer.from(options.body);
    } else {
      const chunks: Uint8Array[] = [];
      const reader = options.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      body = Buffer.concat(chunks);
    }

    const metadata: StorageMetadata = {
      key: options.key,
      size: body.length,
      contentType: options.contentType,
      checksum: options.checksum,
      etag: `"${this.generateEtag(body)}"`,
      lastModified: new Date(),
      metadata: options.metadata ?? {},
    };

    this.files.set(options.key, { body, metadata });
    return metadata;
  }

  async download(key: string): Promise<{
    body: ReadableStream<Uint8Array>;
    metadata: StorageMetadata;
  }> {
    const file = this.files.get(key);
    if (!file) {
      throw new Error(`File not found: ${key}`);
    }

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(file.body));
        controller.close();
      },
    });

    return { body, metadata: file.metadata };
  }

  async getMetadata(key: string): Promise<StorageMetadata | null> {
    const file = this.files.get(key);
    return file?.metadata ?? null;
  }

  async exists(key: string): Promise<boolean> {
    return this.files.has(key);
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async deleteMany(keys: string[]): Promise<{
    deleted: string[];
    errors: Array<{ key: string; error: string }>;
  }> {
    const deleted: string[] = [];
    const errors: Array<{ key: string; error: string }> = [];

    for (const key of keys) {
      if (this.files.has(key)) {
        this.files.delete(key);
        deleted.push(key);
      } else {
        errors.push({ key, error: 'Not found' });
      }
    }

    return { deleted, errors };
  }

  async copy(options: CopyOptions): Promise<StorageMetadata> {
    const source = this.files.get(options.sourceKey);
    if (!source) {
      throw new Error(`Source file not found: ${options.sourceKey}`);
    }

    const metadata: StorageMetadata = {
      ...source.metadata,
      key: options.destinationKey,
      lastModified: new Date(),
      metadata: { ...source.metadata.metadata, ...options.metadata },
    };

    this.files.set(options.destinationKey, {
      body: Buffer.from(source.body),
      metadata,
    });

    return metadata;
  }

  async list(options: ListOptions): Promise<ListResult> {
    const objects: StorageMetadata[] = [];
    const prefixSet = new Set<string>();

    for (const [key, file] of this.files) {
      if (options.prefix && !key.startsWith(options.prefix)) {
        continue;
      }

      if (options.delimiter) {
        const suffix = options.prefix ? key.slice(options.prefix.length) : key;
        const delimIndex = suffix.indexOf(options.delimiter);
        
        if (delimIndex !== -1) {
          const prefix = (options.prefix ?? '') + suffix.slice(0, delimIndex + 1);
          prefixSet.add(prefix);
          continue;
        }
      }

      objects.push(file.metadata);
    }

    return {
      objects: objects.slice(0, options.maxKeys ?? 1000),
      prefixes: Array.from(prefixSet),
      isTruncated: objects.length > (options.maxKeys ?? 1000),
    };
  }

  async createMultipartUpload(options: MultipartUploadOptions): Promise<MultipartUpload> {
    const uploadId = Math.random().toString(36).substring(2);
    this.multipartUploads.set(uploadId, {
      key: options.key,
      parts: new Map(),
      contentType: options.contentType,
      metadata: options.metadata,
    });
    return { uploadId, key: options.key };
  }

  async uploadPart(options: UploadPartOptions): Promise<UploadedPart> {
    const upload = this.multipartUploads.get(options.uploadId);
    if (!upload) {
      throw new Error(`Upload not found: ${options.uploadId}`);
    }

    const body = Buffer.isBuffer(options.body) 
      ? options.body 
      : Buffer.from(options.body);
    const etag = `"${this.generateEtag(body)}"`;

    upload.parts.set(options.partNumber, { body, etag });

    return {
      partNumber: options.partNumber,
      etag,
      size: body.length,
    };
  }

  async completeMultipartUpload(options: CompleteMultipartOptions): Promise<StorageMetadata> {
    const upload = this.multipartUploads.get(options.uploadId);
    if (!upload) {
      throw new Error(`Upload not found: ${options.uploadId}`);
    }

    const sortedParts = options.parts.sort((a, b) => a.partNumber - b.partNumber);
    const bodies: Buffer[] = [];

    for (const part of sortedParts) {
      const uploadedPart = upload.parts.get(part.partNumber);
      if (!uploadedPart) {
        throw new Error(`Part not found: ${part.partNumber}`);
      }
      bodies.push(uploadedPart.body);
    }

    const body = Buffer.concat(bodies);
    const metadata: StorageMetadata = {
      key: options.key,
      size: body.length,
      contentType: upload.contentType,
      etag: `"${this.generateEtag(body)}"`,
      lastModified: new Date(),
      metadata: upload.metadata ?? {},
    };

    this.files.set(options.key, { body, metadata });
    this.multipartUploads.delete(options.uploadId);

    return metadata;
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    this.multipartUploads.delete(uploadId);
  }

  // Helper
  private generateEtag(body: Buffer): string {
    // Simple hash for testing - in production use crypto
    let hash = 0;
    for (let i = 0; i < body.length; i++) {
      hash = ((hash << 5) - hash) + (body[i] ?? 0);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // Test helpers
  clear(): void {
    this.files.clear();
    this.multipartUploads.clear();
  }

  getFile(key: string): Buffer | undefined {
    return this.files.get(key)?.body;
  }

  setFile(key: string, body: Buffer, contentType: string = 'application/octet-stream'): void {
    this.files.set(key, {
      body,
      metadata: {
        key,
        size: body.length,
        contentType,
        etag: `"${this.generateEtag(body)}"`,
        lastModified: new Date(),
        metadata: {},
      },
    });
  }
}
