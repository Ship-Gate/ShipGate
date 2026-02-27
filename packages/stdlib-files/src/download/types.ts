/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/download/types
 */

import type { 
  FileResult,
  FilePath,
  ProgressCallback,
  FileOperationOptions,
  DownloadResult
} from '../types';

// ============================================================================
// DOWNLOAD TYPES
// ============================================================================

export interface DownloadOptions extends FileOperationOptions {
  /** Range of bytes to download */
  range?: {
    start: number;
    end?: number;
  };
  
  /** Whether to stream the response */
  stream?: boolean;
  
  /** Content encoding */
  encoding?: BufferEncoding;
  
  /** Progress callback */
  onProgress?: ProgressCallback;
  
  /** Whether to verify checksum */
  verifyChecksum?: boolean;
  
  /** Expected checksum for verification */
  expectedChecksum?: string;
  
  /** Checksum algorithm */
  checksumAlgorithm?: 'sha256' | 'md5' | 'sha1';
}

export interface DownloadedFile {
  /** File path */
  path: FilePath;
  
  /** Original filename */
  filename: string;
  
  /** File size in bytes */
  size: number;
  
  /** MIME type */
  contentType: string;
  
  /** Checksum if calculated */
  checksum?: string;
  
  /** Download timestamp */
  downloadedAt: Date;
  
  /** Download duration in milliseconds */
  duration: number;
  
  /** Additional metadata */
  metadata: Record<string, string>;
}

export interface BatchDownloadOptions extends DownloadOptions {
  /** Maximum concurrent downloads */
  maxConcurrency?: number;
  
  /** Whether to continue on error */
  continueOnError?: boolean;
  
  /** Base directory for downloads */
  baseDirectory?: FilePath;
}

export interface BatchDownloadResult {
  /** Successfully downloaded files */
  files: DownloadedFile[];
  
  /** Failed downloads */
  failed: Array<{
    path: FilePath;
    error: string;
  }>;
  
  /** Total size downloaded */
  totalSize: number;
  
  /** Total download duration */
  duration: number;
  
  /** Number of files processed */
  processed: number;
}

// ============================================================================
// DOWNLOAD HANDLER INTERFACE
// ============================================================================

export interface DownloadHandler {
  /**
   * Download a file
   */
  download(
    path: FilePath,
    options?: DownloadOptions
  ): Promise<FileResult<Buffer | string | NodeJS.ReadableStream>>;

  /**
   * Download file to destination
   */
  downloadTo(
    sourcePath: FilePath,
    destinationPath: FilePath,
    options?: DownloadOptions
  ): Promise<FileResult<DownloadedFile>>;

  /**
   * Download multiple files
   */
  downloadBatch(
    paths: FilePath[],
    options?: BatchDownloadOptions
  ): Promise<FileResult<BatchDownloadResult>>;

  /**
   * Stream a file
   */
  stream(
    path: FilePath,
    options?: DownloadOptions
  ): Promise<FileResult<NodeJS.ReadableStream>>;

  /**
   * Get download URL if supported
   */
  getDownloadUrl(
    path: FilePath,
    expiresIn?: number
  ): Promise<FileResult<string>>;
}

// ============================================================================
// DOWNLOAD EVENTS
// ============================================================================

export interface DownloadEvent {
  /** Event type */
  type: 'download-started' | 'download-progress' | 'download-completed' | 'download-failed';
  
  /** File information */
  file: {
    path: FilePath;
    size?: number;
  };
  
  /** Progress information */
  progress?: {
    bytesDownloaded: number;
    totalBytes: number;
    percentage: number;
  };
  
  /** Error information if failed */
  error?: string;
  
  /** Timestamp */
  timestamp: Date;
}

export type DownloadEventListener = (event: DownloadEvent) => void;

// ============================================================================
// DOWNLOAD CONFIGURATION
// ============================================================================

export interface DownloadConfig {
  /** Default chunk size for streaming */
  defaultChunkSize?: number;
  
  /** Default timeout for downloads */
  defaultTimeout?: number;
  
  /** Whether to verify checksums by default */
  defaultVerifyChecksum?: boolean;
  
  /** Default checksum algorithm */
  defaultChecksumAlgorithm?: 'sha256' | 'md5' | 'sha1';
  
  /** Download cache configuration */
  cache?: {
    enabled: boolean;
    maxSize?: number;
    ttl?: number;
  };
  
  /** Rate limiting */
  rateLimit?: {
    enabled: boolean;
    maxBytesPerSecond?: number;
  };
}
