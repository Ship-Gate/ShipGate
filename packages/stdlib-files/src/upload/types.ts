/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/upload/types
 */

import type { 
  FileResult,
  MimeType,
  FileSize,
  FilePath,
  ProgressCallback,
  FileOperationOptions,
  UploadResult
} from '../types';

// ============================================================================
// UPLOAD TYPES
// ============================================================================

export interface UploadOptions extends FileOperationOptions {
  /** Maximum file size allowed */
  maxSize?: FileSize;
  
  /** Allowed MIME types */
  allowedMimeTypes?: MimeType[];
  
  /** Allowed file extensions */
  allowedExtensions?: string[];
  
  /** Whether to calculate checksum */
  calculateChecksum?: boolean;
  
  /** Expected checksum for verification */
  expectedChecksum?: string;
  
  /** Directory to upload to */
  directory?: FilePath;
  
  /** Whether to overwrite existing files */
  overwrite?: boolean;
  
  /** Progress callback */
  onProgress?: ProgressCallback;
}

export interface MultipartFile {
  /** Field name in multipart form */
  field: string;
  
  /** Original filename */
  filename: string;
  
  /** MIME type */
  contentType: MimeType;
  
  /** File size */
  size: FileSize;
  
  /** File content as stream or buffer */
  content: Buffer | NodeJS.ReadableStream;
  
  /** Additional form fields */
  metadata?: Record<string, string>;
}

export interface MultipartUploadOptions extends UploadOptions {
  /** Maximum number of files allowed */
  maxFiles?: number;
  
  /** Total maximum size for all files */
  maxTotalSize?: FileSize;
  
  /** Whether to process files in parallel */
  parallel?: boolean;
  
  /** Maximum concurrent uploads */
  maxConcurrency?: number;
}

export interface UploadValidationResult {
  /** Whether the upload is valid */
  valid: boolean;
  
  /** Validation errors */
  errors: string[];
  
  /** Warnings */
  warnings: string[];
  
  /** Sanitized filename if changed */
  sanitizedFilename?: string;
}

export interface UploadedFile {
  /** Original filename */
  originalName: string;
  
  /** Final filename (may be sanitized) */
  filename: string;
  
  /** File path */
  path: FilePath;
  
  /** File size */
  size: FileSize;
  
  /** MIME type */
  contentType: MimeType;
  
  /** Checksum if calculated */
  checksum?: string;
  
  /** Upload timestamp */
  uploadedAt: Date;
  
  /** Additional metadata */
  metadata: Record<string, string>;
}

export interface MultipartUploadResult {
  /** Successfully uploaded files */
  files: UploadedFile[];
  
  /** Failed uploads */
  failed: Array<{
    filename: string;
    error: string;
  }>;
  
  /** Total size uploaded */
  totalSize: FileSize;
  
  /** Upload duration */
  duration: number;
  
  /** Number of files processed */
  processed: number;
}

// ============================================================================
// UPLOAD HANDLER INTERFACE
// ============================================================================

export interface UploadHandler {
  /**
   * Upload a single file
   */
  upload(
    file: Buffer | NodeJS.ReadableStream,
    filename: string,
    contentType: MimeType,
    options?: UploadOptions
  ): Promise<FileResult<UploadedFile>>;

  /**
   * Upload multiple files (multipart)
   */
  uploadMultipart(
    files: MultipartFile[],
    options?: MultipartUploadOptions
  ): Promise<FileResult<MultipartUploadResult>>;

  /**
   * Generate a unique filename to avoid conflicts
   */
  generateUniqueFilename(
    filename: string,
    directory?: FilePath
  ): Promise<string>;

  /**
   * Validate file before upload
   */
  validate(
    filename: string,
    size: FileSize,
    contentType: MimeType,
    options?: UploadOptions
  ): Promise<UploadValidationResult>;
}

// ============================================================================
// UPLOAD STRATEGY
// ============================================================================

export interface UploadStrategy {
  /** Strategy name */
  name: string;
  
  /** Handle file upload */
  handle(
    file: Buffer | NodeJS.ReadableStream,
    filename: string,
    contentType: MimeType,
    options?: UploadOptions
  ): Promise<FileResult<UploadedFile>>;
}

export interface UploadStrategyRegistry {
  /** Register a strategy */
  register(strategy: UploadStrategy): void;
  
  /** Get strategy by name */
  get(name: string): UploadStrategy | undefined;
  
  /** List all strategies */
  list(): string[];
}

// ============================================================================
// UPLOAD EVENTS
// ============================================================================

export interface UploadEvent {
  /** Event type */
  type: 'upload-started' | 'upload-progress' | 'upload-completed' | 'upload-failed';
  
  /** File information */
  file: {
    filename: string;
    size: FileSize;
    contentType: MimeType;
  };
  
  /** Progress information */
  progress?: {
    bytesUploaded: number;
    totalBytes: number;
    percentage: number;
  };
  
  /** Error information if failed */
  error?: string;
  
  /** Timestamp */
  timestamp: Date;
}

export type UploadEventListener = (event: UploadEvent) => void;

// ============================================================================
// UPLOAD CONFIGURATION
// ============================================================================

export interface UploadConfig {
  /** Default maximum file size */
  defaultMaxSize?: FileSize;
  
  /** Default allowed MIME types */
  defaultAllowedMimeTypes?: MimeType[];
  
  /** Default allowed extensions */
  defaultAllowedExtensions?: string[];
  
  /** Default upload directory */
  defaultDirectory?: FilePath;
  
  /** Whether to overwrite files by default */
  defaultOverwrite?: boolean;
  
  /** Whether to calculate checksums by default */
  defaultCalculateChecksum?: boolean;
  
  /** Virus scanning configuration */
  virusScan?: {
    enabled: boolean;
    scanner?: 'clamav' | 'virustotal' | 'custom';
    options?: Record<string, unknown>;
  };
  
  /** Image processing configuration */
  imageProcessing?: {
    enabled: boolean;
    resize?: Array<{ width: number; height: number; suffix?: string }>;
    thumbnail?: { width: number; height: number; quality?: number };
    compress?: { quality: number };
  };
  
  /** Storage configuration */
  storage?: {
    provider: 'local' | 's3' | 'gcs' | 'azure';
    options?: Record<string, unknown>;
  };
}

// ============================================================================
// TEMPORARY STORAGE
// ============================================================================

export interface TempStorage {
  /** Store file temporarily */
  store(
    content: Buffer | NodeJS.ReadableStream,
    filename: string
  ): Promise<string>; // Returns temp file path/key
  
  /** Retrieve temporary file */
  retrieve(key: string): Promise<Buffer | NodeJS.ReadableStream>;
  
  /** Delete temporary file */
  delete(key: string): Promise<void>;
  
  /** Clean up expired files */
  cleanup(): Promise<void>;
  
  /** Get temporary file info */
  getInfo(key: string): Promise<{
    filename: string;
    size: FileSize;
    createdAt: Date;
    expiresAt: Date;
  } | null>;
}
