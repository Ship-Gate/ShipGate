/**
 * @isl-lang/stdlib-files
 * 
 * File storage standard library implementation.
 * Provides upload, download, and file management operations.
 */

export * from './storage.js';
export * from './s3.js';

import type { StorageProvider, StorageConfig } from './storage.js';
import { S3StorageProvider, type S3Config } from './s3.js';

// ============================================================================
// TYPES
// ============================================================================

export type FileId = string;
export type FolderId = string;

export interface File {
  id: FileId;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  status: FileStatus;
  ownerId: string;
  folderId: FolderId | null;
  checksum: string;
  storageProvider: string;
  storageKey: string;
  storageBucket: string;
  accessLevel: AccessLevel;
  sharedWith: string[];
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  expiresAt: Date | null;
}

export interface Folder {
  id: FolderId;
  name: string;
  path: string;
  parentId: FolderId | null;
  depth: number;
  ownerId: string;
  accessLevel: AccessLevel;
  sharedWith: string[];
  inheritPermissions: boolean;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export enum FileStatus {
  UPLOADING = 'UPLOADING',
  READY = 'READY',
  PROCESSING = 'PROCESSING',
  DELETED = 'DELETED',
}

export enum AccessLevel {
  PRIVATE = 'PRIVATE',
  SHARED = 'SHARED',
  PUBLIC = 'PUBLIC',
}

// ============================================================================
// UPLOAD TYPES
// ============================================================================

export interface UploadInput {
  name: string;
  folderId?: FolderId;
  mimeType: string;
  size: number;
  checksum: string;
  metadata?: Record<string, string>;
  expiresAt?: Date;
  accessLevel?: AccessLevel;
}

export interface UploadResult {
  file: File;
  uploadUrl: string;
  expiresAt: Date;
}

export interface CompleteUploadInput {
  fileId: FileId;
  parts?: UploadPart[];
}

export interface UploadPart {
  partNumber: number;
  etag: string;
  size: number;
}

// ============================================================================
// DOWNLOAD TYPES
// ============================================================================

export interface DownloadInput {
  fileId: FileId;
  expiresIn?: number; // seconds
  disposition?: 'inline' | 'attachment';
  responseContentType?: string;
}

export interface DownloadResult {
  file: File;
  downloadUrl: string;
  expiresAt: Date;
}

// ============================================================================
// DELETE TYPES
// ============================================================================

export interface DeleteInput {
  fileId: FileId;
  permanent?: boolean;
}

export interface BulkDeleteInput {
  fileIds: FileId[];
  permanent?: boolean;
}

export interface BulkDeleteResult {
  deleted: FileId[];
  deletedCount: number;
  failed: Array<{ fileId: FileId; error: string }>;
  failedCount: number;
  totalBytesFreed: number;
}

// ============================================================================
// PRESIGNED URL TYPES
// ============================================================================

export type PresignedOperation = 'GET' | 'PUT' | 'DELETE' | 'HEAD';

export interface CreatePresignedUrlInput {
  fileId?: FileId;
  operation: PresignedOperation;
  expiresIn: number; // seconds
  key?: string;
  contentType?: string;
  contentLengthRange?: { min: number; max: number };
}

export interface PresignedUrlResult {
  url: string;
  method: string;
  expiresAt: Date;
  headers?: Record<string, string>;
  fileId?: FileId;
}

// ============================================================================
// ERRORS
// ============================================================================

export class FilesError extends Error {
  constructor(
    public code: string,
    message: string,
    public retriable: boolean = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'FilesError';
  }
}

export class FileNotFoundError extends FilesError {
  constructor(fileId: string) {
    super('FILE_NOT_FOUND', `File not found: ${fileId}`, false);
  }
}

export class FolderNotFoundError extends FilesError {
  constructor(folderId: string) {
    super('FOLDER_NOT_FOUND', `Folder not found: ${folderId}`, false);
  }
}

export class AccessDeniedError extends FilesError {
  constructor(message: string = 'Access denied') {
    super('ACCESS_DENIED', message, false);
  }
}

export class QuotaExceededError extends FilesError {
  constructor(used: number, quota: number) {
    super('QUOTA_EXCEEDED', `Storage quota exceeded: ${used}/${quota} bytes`, false);
  }
}

export class FileTooLargeError extends FilesError {
  constructor(size: number, maxSize: number) {
    super('FILE_TOO_LARGE', `File too large: ${size} bytes (max: ${maxSize})`, false);
  }
}

export class InvalidMimeTypeError extends FilesError {
  constructor(mimeType: string) {
    super('INVALID_MIME_TYPE', `MIME type not allowed: ${mimeType}`, false);
  }
}

export class ChecksumMismatchError extends FilesError {
  constructor(expected: string, actual: string) {
    super('CHECKSUM_MISMATCH', `Checksum mismatch: expected ${expected}, got ${actual}`, false);
  }
}

export class UploadExpiredError extends FilesError {
  constructor(fileId: string) {
    super('UPLOAD_EXPIRED', `Upload expired for file: ${fileId}`, false);
  }
}

// ============================================================================
// FILE SERVICE
// ============================================================================

export interface FileServiceConfig {
  storage: StorageConfig;
  maxFileSize: number;
  allowedMimeTypes?: string[];
  uploadExpirySeconds: number;
  defaultDownloadExpirySeconds: number;
  restoreWindowDays: number;
}

export interface FileRepository {
  create(file: Omit<File, 'id' | 'createdAt' | 'updatedAt'>): Promise<File>;
  findById(id: FileId): Promise<File | null>;
  findByPath(path: string): Promise<File | null>;
  update(id: FileId, updates: Partial<File>): Promise<File>;
  delete(id: FileId): Promise<void>;
  findByOwner(ownerId: string, status?: FileStatus): Promise<File[]>;
  findByFolder(folderId: FolderId): Promise<File[]>;
}

export interface FolderRepository {
  create(folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder>;
  findById(id: FolderId): Promise<Folder | null>;
  findByPath(path: string): Promise<Folder | null>;
  update(id: FolderId, updates: Partial<Folder>): Promise<Folder>;
  delete(id: FolderId): Promise<void>;
  findByParent(parentId: FolderId | null): Promise<Folder[]>;
  findByOwner(ownerId: string): Promise<Folder[]>;
}

export interface UserQuotaService {
  getUsed(userId: string): Promise<number>;
  getQuota(userId: string): Promise<number>;
  checkAvailable(userId: string, additionalBytes: number): Promise<boolean>;
  updateUsed(userId: string, deltaBytes: number): Promise<void>;
}

export class FileService {
  constructor(
    private config: FileServiceConfig,
    private storage: StorageProvider,
    private fileRepo: FileRepository,
    private folderRepo: FolderRepository,
    private quotaService: UserQuotaService
  ) {}

  /**
   * Initiate a file upload
   */
  async upload(input: UploadInput, userId: string): Promise<UploadResult> {
    // Validate MIME type
    if (this.config.allowedMimeTypes && this.config.allowedMimeTypes.length > 0) {
      if (!this.config.allowedMimeTypes.includes(input.mimeType)) {
        throw new InvalidMimeTypeError(input.mimeType);
      }
    }

    // Validate file size
    if (input.size > this.config.maxFileSize) {
      throw new FileTooLargeError(input.size, this.config.maxFileSize);
    }

    // Check folder exists
    if (input.folderId) {
      const folder = await this.folderRepo.findById(input.folderId);
      if (!folder) {
        throw new FolderNotFoundError(input.folderId);
      }
      if (folder.ownerId !== userId && !folder.sharedWith.includes(userId)) {
        throw new AccessDeniedError('No access to folder');
      }
    }

    // Check quota
    const hasQuota = await this.quotaService.checkAvailable(userId, input.size);
    if (!hasQuota) {
      const used = await this.quotaService.getUsed(userId);
      const quota = await this.quotaService.getQuota(userId);
      throw new QuotaExceededError(used + input.size, quota);
    }

    // Generate storage key
    const storageKey = this.generateStorageKey(userId, input.name);

    // Create file record
    const file = await this.fileRepo.create({
      name: input.name,
      path: this.buildPath(input.folderId, input.name),
      mimeType: input.mimeType,
      size: input.size,
      status: FileStatus.UPLOADING,
      ownerId: userId,
      folderId: input.folderId ?? null,
      checksum: input.checksum,
      storageProvider: this.storage.name,
      storageKey,
      storageBucket: this.storage.bucket,
      accessLevel: input.accessLevel ?? AccessLevel.PRIVATE,
      sharedWith: [],
      metadata: input.metadata ?? {},
      deletedAt: null,
      expiresAt: input.expiresAt ?? null,
    });

    // Generate presigned upload URL
    const expiresAt = new Date(Date.now() + this.config.uploadExpirySeconds * 1000);
    const uploadUrl = await this.storage.createPresignedUrl({
      key: storageKey,
      operation: 'PUT',
      expiresIn: this.config.uploadExpirySeconds,
      contentType: input.mimeType,
      contentLength: input.size,
      checksum: input.checksum,
    });

    return {
      file,
      uploadUrl,
      expiresAt,
    };
  }

  /**
   * Complete an upload after data transfer
   */
  async completeUpload(input: CompleteUploadInput, userId: string): Promise<File> {
    const file = await this.fileRepo.findById(input.fileId);
    
    if (!file) {
      throw new FileNotFoundError(input.fileId);
    }

    if (file.ownerId !== userId) {
      throw new AccessDeniedError('Not the file owner');
    }

    if (file.status !== FileStatus.UPLOADING) {
      throw new FilesError('INVALID_STATE', 'File is not in uploading state');
    }

    // Check if upload expired
    const uploadExpiry = new Date(file.createdAt.getTime() + this.config.uploadExpirySeconds * 1000);
    if (new Date() > uploadExpiry) {
      throw new UploadExpiredError(input.fileId);
    }

    // Verify the file exists in storage
    const metadata = await this.storage.getMetadata(file.storageKey);
    if (!metadata) {
      throw new FilesError('UPLOAD_INCOMPLETE', 'File data not found in storage', true, 5);
    }

    // Verify checksum
    if (metadata.checksum && metadata.checksum !== file.checksum) {
      // Delete the invalid file
      await this.storage.delete(file.storageKey);
      await this.fileRepo.update(input.fileId, {
        status: FileStatus.DELETED,
        deletedAt: new Date(),
      });
      throw new ChecksumMismatchError(file.checksum, metadata.checksum);
    }

    // Verify size
    if (metadata.size !== file.size) {
      throw new FilesError('SIZE_MISMATCH', `Size mismatch: expected ${file.size}, got ${metadata.size}`);
    }

    // Update file status
    const updatedFile = await this.fileRepo.update(input.fileId, {
      status: FileStatus.READY,
    });

    // Update quota
    await this.quotaService.updateUsed(userId, file.size);

    return updatedFile;
  }

  /**
   * Get a download URL for a file
   */
  async download(input: DownloadInput, userId: string): Promise<DownloadResult> {
    const file = await this.fileRepo.findById(input.fileId);
    
    if (!file) {
      throw new FileNotFoundError(input.fileId);
    }

    if (!this.canAccess(file, userId)) {
      throw new AccessDeniedError();
    }

    if (file.status !== FileStatus.READY) {
      throw new FilesError('FILE_NOT_READY', 'File is not available for download', true, 5);
    }

    if (file.expiresAt && new Date() > file.expiresAt) {
      throw new FilesError('FILE_EXPIRED', 'File has expired');
    }

    const expiresIn = input.expiresIn ?? this.config.defaultDownloadExpirySeconds;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const downloadUrl = await this.storage.createPresignedUrl({
      key: file.storageKey,
      operation: 'GET',
      expiresIn,
      responseContentType: input.responseContentType ?? file.mimeType,
      responseContentDisposition: input.disposition === 'attachment'
        ? `attachment; filename="${file.name}"`
        : undefined,
    });

    return {
      file,
      downloadUrl,
      expiresAt,
    };
  }

  /**
   * Delete a file
   */
  async delete(input: DeleteInput, userId: string): Promise<boolean> {
    const file = await this.fileRepo.findById(input.fileId);
    
    if (!file) {
      throw new FileNotFoundError(input.fileId);
    }

    if (file.ownerId !== userId) {
      throw new AccessDeniedError('Not the file owner');
    }

    if (file.status === FileStatus.DELETED) {
      throw new FilesError('FILE_ALREADY_DELETED', 'File is already deleted');
    }

    if (input.permanent) {
      // Permanent delete - remove from storage
      await this.storage.delete(file.storageKey);
      await this.fileRepo.delete(input.fileId);
    } else {
      // Soft delete
      await this.fileRepo.update(input.fileId, {
        status: FileStatus.DELETED,
        deletedAt: new Date(),
      });
    }

    // Update quota
    if (file.status === FileStatus.READY) {
      await this.quotaService.updateUsed(userId, -file.size);
    }

    return true;
  }

  /**
   * Bulk delete files
   */
  async bulkDelete(input: BulkDeleteInput, userId: string): Promise<BulkDeleteResult> {
    const result: BulkDeleteResult = {
      deleted: [],
      deletedCount: 0,
      failed: [],
      failedCount: 0,
      totalBytesFreed: 0,
    };

    for (const fileId of input.fileIds) {
      try {
        const file = await this.fileRepo.findById(fileId);
        if (file && file.status === FileStatus.READY) {
          result.totalBytesFreed += file.size;
        }
        
        await this.delete({ fileId, permanent: input.permanent }, userId);
        result.deleted.push(fileId);
        result.deletedCount++;
      } catch (error) {
        result.failed.push({
          fileId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.failedCount++;
      }
    }

    return result;
  }

  /**
   * Create a presigned URL
   */
  async createPresignedUrl(
    input: CreatePresignedUrlInput,
    userId: string
  ): Promise<PresignedUrlResult> {
    let key: string;
    let fileId: FileId | undefined;

    if (input.fileId) {
      const file = await this.fileRepo.findById(input.fileId);
      if (!file) {
        throw new FileNotFoundError(input.fileId);
      }
      if (!this.canAccess(file, userId)) {
        throw new AccessDeniedError();
      }
      key = file.storageKey;
      fileId = file.id;
    } else if (input.key) {
      key = input.key;
    } else {
      throw new FilesError('INVALID_INPUT', 'Either fileId or key must be provided');
    }

    const expiresAt = new Date(Date.now() + input.expiresIn * 1000);
    const url = await this.storage.createPresignedUrl({
      key,
      operation: input.operation,
      expiresIn: input.expiresIn,
      contentType: input.contentType,
    });

    return {
      url,
      method: input.operation,
      expiresAt,
      fileId,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private canAccess(file: File, userId: string): boolean {
    if (file.ownerId === userId) return true;
    if (file.accessLevel === AccessLevel.PUBLIC) return true;
    if (file.accessLevel === AccessLevel.SHARED && file.sharedWith.includes(userId)) return true;
    return false;
  }

  private generateStorageKey(userId: string, fileName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${userId}/${timestamp}-${random}/${sanitizedName}`;
  }

  private async buildPath(folderId: FolderId | null | undefined, fileName: string): Promise<string> {
    if (!folderId) {
      return `/${fileName}`;
    }
    const folder = await this.folderRepo.findById(folderId);
    return folder ? `${folder.path}/${fileName}` : `/${fileName}`;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export interface CreateFileServiceOptions {
  s3?: S3Config;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  uploadExpirySeconds?: number;
  defaultDownloadExpirySeconds?: number;
  restoreWindowDays?: number;
  fileRepository: FileRepository;
  folderRepository: FolderRepository;
  quotaService: UserQuotaService;
}

export function createFileService(options: CreateFileServiceOptions): FileService {
  if (!options.s3) {
    throw new Error('Storage configuration required (s3)');
  }

  const storage = new S3StorageProvider(options.s3);

  const config: FileServiceConfig = {
    storage: options.s3,
    maxFileSize: options.maxFileSize ?? 5 * 1024 * 1024 * 1024, // 5GB
    allowedMimeTypes: options.allowedMimeTypes,
    uploadExpirySeconds: options.uploadExpirySeconds ?? 3600, // 1 hour
    defaultDownloadExpirySeconds: options.defaultDownloadExpirySeconds ?? 3600,
    restoreWindowDays: options.restoreWindowDays ?? 30,
  };

  return new FileService(
    config,
    storage,
    options.fileRepository,
    options.folderRepository,
    options.quotaService
  );
}
