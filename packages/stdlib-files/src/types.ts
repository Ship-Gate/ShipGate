/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/types
 */

import type { Result, UUID } from '@isl-lang/stdlib-core';

// ============================================================================
// BASIC TYPES
// ============================================================================

export type FileId = UUID;
export type FolderId = UUID;
export type FilePath = string;

export type MimeType = string;
export type FileSize = number;
export type StorageQuota = number;

// ============================================================================
// ENUMS
// ============================================================================

export enum FileStatus {
  UPLOADING = 'UPLOADING',
  READY = 'READY',
  PROCESSING = 'PROCESSING',
  DELETED = 'DELETED',
}

export enum StorageProvider {
  S3 = 'S3',
  GCS = 'GCS',
  AZURE_BLOB = 'AZURE_BLOB',
  LOCAL = 'LOCAL',
}

export enum AccessLevel {
  PRIVATE = 'PRIVATE',
  SHARED = 'SHARED',
  PUBLIC = 'PUBLIC',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface FileMetadata {
  contentType: MimeType;
  contentLength: FileSize;
  checksum: string;
  etag?: string;
  lastModified: Date;
  custom: Record<string, string>;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: FileSize;
  quotaUsedPercent: number;
}

export interface UploadResult {
  file: FileEntry;
  uploadUrl: string;
  expiresAt: Date;
}

export interface DownloadResult {
  file: FileEntry;
  downloadUrl: string;
  expiresAt: Date;
}

export interface FileEntry {
  id: FileId;
  name: string;
  path: FilePath;
  mimeType: MimeType;
  size: FileSize;
  checksum: string;
  status: FileStatus;
  ownerId: UUID;
  folderId?: FolderId;
  accessLevel: AccessLevel;
  sharedWith: UUID[];
  storageProvider: StorageProvider;
  storageKey: string;
  storageBucket: string;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  expiresAt?: Date;
}

export interface FolderEntry {
  id: FolderId;
  name: string;
  path: FilePath;
  parentId?: FolderId;
  depth: number;
  ownerId: UUID;
  accessLevel: AccessLevel;
  sharedWith: UUID[];
  inheritPermissions: boolean;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageConfig {
  provider: StorageProvider;
  bucket?: string;
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  };
  maxFileSize?: FileSize;
  allowedMimeTypes?: MimeType[];
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

export type ReadableStream = NodeJS.ReadableStream;
export type WritableStream = NodeJS.WritableStream;
export type AsyncIterable<T> = AsyncIterableIterator<T>;

export interface StreamOptions {
  chunkSize?: number;
  encoding?: BufferEncoding;
  highWaterMark?: number;
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speed?: number; // bytes per second
}

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speed?: number; // bytes per second
}

// ============================================================================
// OPERATION TYPES
// ============================================================================

export interface ReadOptions {
  encoding?: BufferEncoding;
  stream?: boolean;
  range?: {
    start: number;
    end?: number;
  };
}

export interface WriteOptions {
  encoding?: BufferEncoding;
  stream?: boolean;
  overwrite?: boolean;
  createPath?: boolean;
}

export interface CopyOptions {
  overwrite?: boolean;
  preserveMetadata?: boolean;
}

export interface DeleteOptions {
  permanent?: boolean;
  recursive?: boolean;
}

export interface ListOptions {
  recursive?: boolean;
  includeDeleted?: boolean;
  filter?: {
    mimeTypes?: MimeType[];
    sizeRange?: { min?: FileSize; max?: FileSize };
    dateRange?: { start?: Date; end?: Date };
  };
  sort?: {
    field: 'name' | 'size' | 'createdAt' | 'updatedAt';
    order: 'asc' | 'desc';
  };
  pagination?: {
    offset?: number;
    limit?: number;
  };
}

export interface ListResult {
  files: FileEntry[];
  folders: FolderEntry[];
  totalCount: number;
  hasMore: boolean;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface PathValidationResult {
  isValid: boolean;
  sanitizedPath?: string;
  error?: string;
}

export interface UploadValidationOptions {
  maxFileSize?: FileSize;
  allowedMimeTypes?: MimeType[];
  allowedExtensions?: string[];
  requireChecksum?: boolean;
  virusScan?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export type FileResult<T> = Result<T, FileError>;
export type FileListResult = FileResult<ListResult>;
export type FileStatsResult = FileResult<StorageStats>;

// ============================================================================
// ERROR CODES
// ============================================================================

export enum FileErrorCode {
  // General errors
  UNKNOWN = 'UNKNOWN',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Path errors
  INVALID_PATH = 'INVALID_PATH',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  PATH_TOO_LONG = 'PATH_TOO_LONG',
  
  // File errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_TOO_SMALL = 'FILE_TOO_SMALL',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
  
  // Permission errors
  ACCESS_DENIED = 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Storage errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_FULL = 'STORAGE_FULL',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  
  // Upload/Download errors
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  UPLOAD_INTERRUPTED = 'UPLOAD_INTERRUPTED',
  DOWNLOAD_INTERRUPTED = 'DOWNLOAD_INTERRUPTED',
  
  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  
  // Folder errors
  FOLDER_NOT_FOUND = 'FOLDER_NOT_FOUND',
  FOLDER_NOT_EMPTY = 'FOLDER_NOT_EMPTY',
  FOLDER_DEPTH_EXCEEDED = 'FOLDER_DEPTH_EXCEEDED',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
}

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

export const isNode = typeof process !== 'undefined' && process.versions?.node != null;
export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
export const isWebWorker = typeof self === 'object' && typeof importScripts === 'function';

// ============================================================================
// UTILITIES
// ============================================================================

export type ProgressCallback = (progress: UploadProgress | DownloadProgress) => void;

export interface FileOperationContext {
  userId?: UUID;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface FileOperationOptions {
  context?: FileOperationContext;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}
