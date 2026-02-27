/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/storage/types
 */

import type { 
  FileEntry, 
  FolderEntry, 
  FileResult, 
  FileListResult,
  StorageConfig,
  StorageProvider,
  ReadOptions,
  WriteOptions,
  CopyOptions,
  DeleteOptions,
  ListOptions,
  FileMetadata,
  UploadResult,
  DownloadResult,
  ProgressCallback,
  FileOperationOptions,
  ReadableStream,
  WritableStream
} from '../types';

// ============================================================================
// STORAGE ADAPTER INTERFACE
// ============================================================================

export interface StorageAdapter {
  /**
   * Initialize the storage adapter with configuration
   */
  initialize(config: StorageConfig): Promise<void>;

  /**
   * Check if the storage adapter is ready for operations
   */
  isReady(): Promise<boolean>;

  /**
   * Get the storage provider type
   */
  getProvider(): StorageProvider;

  /**
   * Clean up resources
   */
  dispose(): Promise<void>;

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  /**
   * Read a file's content or metadata
   */
  readFile(path: string, options?: ReadOptions & FileOperationOptions): Promise<FileResult<Buffer | string | ReadableStream>>;

  /**
   * Write content to a file
   */
  writeFile(
    path: string,
    content: Buffer | string | ReadableStream,
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>>;

  /**
   * Copy a file to a new location
   */
  copyFile(
    sourcePath: string,
    destinationPath: string,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>>;

  /**
   * Move/rename a file
   */
  moveFile(
    sourcePath: string,
    destinationPath: string,
    options?: FileOperationOptions
  ): Promise<FileResult<FileMetadata>>;

  /**
   * Delete a file
   */
  deleteFile(
    path: string,
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<void>>;

  /**
   * Check if a file exists
   */
  fileExists(path: string): Promise<boolean>;

  /**
   * Get file metadata without reading content
   */
  getFileMetadata(path: string): Promise<FileResult<FileMetadata>>;

  /**
   * Update file metadata
   */
  updateFileMetadata(
    path: string,
    metadata: Partial<FileMetadata>
  ): Promise<FileResult<FileMetadata>>;

  // ============================================================================
  // DIRECTORY OPERATIONS
  // ============================================================================

  /**
   * Create a directory
   */
  createDirectory(
    path: string,
    options?: { recursive?: boolean } & FileOperationOptions
  ): Promise<FileResult<void>>;

  /**
   * List directory contents
   */
  listDirectory(
    path: string,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileListResult>;

  /**
   * Delete a directory
   */
  deleteDirectory(
    path: string,
    options?: { recursive?: boolean } & FileOperationOptions
  ): Promise<FileResult<void>>;

  /**
   * Check if a directory exists
   */
  directoryExists(path: string): Promise<boolean>;

  // ============================================================================
  // UPLOAD/DOWNLOAD OPERATIONS
  // ============================================================================

  /**
   * Generate a presigned upload URL
   */
  generateUploadUrl(
    path: string,
    options?: {
      expiresIn?: number; // seconds
      contentType?: string;
      maxSize?: number;
    } & FileOperationOptions
  ): Promise<FileResult<UploadResult>>;

  /**
   * Generate a presigned download URL
   */
  generateDownloadUrl(
    path: string,
    options?: {
      expiresIn?: number; // seconds
      contentType?: string;
    } & FileOperationOptions
  ): Promise<FileResult<DownloadResult>>;

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Delete multiple files
   */
  deleteFiles(
    paths: string[],
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ deleted: string[]; failed: { path: string; error: string }[] }>>;

  /**
   * Copy multiple files
   */
  copyFiles(
    sources: { source: string; destination: string }[],
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<{ copied: string[]; failed: { path: string; error: string }[] }>>;

  // ============================================================================
  // STORAGE STATISTICS
  // ============================================================================

  /**
   * Get storage usage statistics
   */
  getStorageStats(path?: string): Promise<FileResult<{
    fileCount: number;
    totalSize: number;
    lastModified: Date;
  }>>;

  /**
   * Calculate directory size recursively
   */
  calculateDirectorySize(path: string): Promise<FileResult<number>>;
}

// ============================================================================
// STREAMING STORAGE INTERFACE
// ============================================================================

export interface StreamingStorageAdapter extends StorageAdapter {
  /**
   * Create a readable stream for a file
   */
  createReadStream(
    path: string,
    options?: ReadOptions & FileOperationOptions
  ): Promise<FileResult<ReadableStream>>;

  /**
   * Create a writable stream for a file
   */
  createWriteStream(
    path: string,
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<WritableStream>>;

  /**
   * Upload with progress tracking
   */
  uploadWithProgress(
    path: string,
    content: ReadableStream,
    options?: WriteOptions & { onProgress?: ProgressCallback } & FileOperationOptions
  ): Promise<FileResult<FileMetadata>>;

  /**
   * Download with progress tracking
   */
  downloadWithProgress(
    path: string,
    options?: ReadOptions & { onProgress?: ProgressCallback } & FileOperationOptions
  ): Promise<FileResult<ReadableStream>>;
}

// ============================================================================
// STORAGE ADAPTER FACTORY
// ============================================================================

export interface StorageAdapterFactory {
  create(config: StorageConfig): StorageAdapter;
  supports(provider: StorageProvider): boolean;
}

export interface StorageAdapterRegistry {
  register(factory: StorageAdapterFactory): void;
  create(config: StorageConfig): StorageAdapter;
  getSupportedProviders(): StorageProvider[];
}

// ============================================================================
// STORAGE EVENTS
// ============================================================================

export interface StorageEvent {
  type: 'file-created' | 'file-updated' | 'file-deleted' | 'directory-created' | 'directory-deleted';
  path: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface StorageEventListener {
  (event: StorageEvent): void;
}

export interface EventEmitter {
  on(event: string, listener: StorageEventListener): void;
  off(event: string, listener: StorageEventListener): void;
  emit(event: string, data: StorageEvent): void;
}

// ============================================================================
// CACHE INTERFACE
// ============================================================================

export interface StorageCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

// ============================================================================
// SECURITY INTERFACE
// ============================================================================

export interface PathSanitizer {
  sanitize(path: string): string;
  validate(path: string): { isValid: boolean; error?: string };
  isSafe(path: string): boolean;
}

export interface AccessController {
  canRead(userId: string, path: string): Promise<boolean>;
  canWrite(userId: string, path: string): Promise<boolean>;
  canDelete(userId: string, path: string): Promise<boolean>;
  canList(userId: string, path: string): Promise<boolean>;
}
