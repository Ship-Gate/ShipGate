/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/errors
 */

import type { FileErrorCode } from './types';

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class FileError extends Error {
  public readonly code: FileErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: FileErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'FileError';
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}

// ============================================================================
// SPECIFIC ERROR CLASSES
// ============================================================================

export class PathTraversalError extends FileError {
  constructor(path: string) {
    super(FileErrorCode.PATH_TRAVERSAL, `Path traversal detected: ${path}`, { path });
    this.name = 'PathTraversalError';
  }
}

export class InvalidPathError extends FileError {
  constructor(path: string, reason?: string) {
    super(
      FileErrorCode.INVALID_PATH,
      reason ? `Invalid path: ${path} - ${reason}` : `Invalid path: ${path}`,
      { path, reason }
    );
    this.name = 'InvalidPathError';
  }
}

export class FileNotFoundError extends FileError {
  constructor(path: string) {
    super(FileErrorCode.FILE_NOT_FOUND, `File not found: ${path}`, { path });
    this.name = 'FileNotFoundError';
  }
}

export class FileAlreadyExistsError extends FileError {
  constructor(path: string) {
    super(FileErrorCode.FILE_ALREADY_EXISTS, `File already exists: ${path}`, { path });
    this.name = 'FileAlreadyExistsError';
  }
}

export class FileTooLargeError extends FileError {
  constructor(path: string, size: number, maxSize: number) {
    super(
      FileErrorCode.FILE_TOO_LARGE,
      `File too large: ${path} (${size} bytes, max: ${maxSize} bytes)`,
      { path, size, maxSize }
    );
    this.name = 'FileTooLargeError';
  }
}

export class InvalidFileTypeError extends FileError {
  constructor(path: string, mimeType: string, allowedTypes?: string[]) {
    super(
      FileErrorCode.INVALID_FILE_TYPE,
      allowedTypes
        ? `Invalid file type: ${path} (${mimeType}, allowed: ${allowedTypes.join(', ')})`
        : `Invalid file type: ${path} (${mimeType})`,
      { path, mimeType, allowedTypes }
    );
    this.name = 'InvalidFileTypeError';
  }
}

export class AccessDeniedError extends FileError {
  constructor(path: string, reason?: string) {
    super(
      FileErrorCode.ACCESS_DENIED,
      reason ? `Access denied: ${path} - ${reason}` : `Access denied: ${path}`,
      { path, reason }
    );
    this.name = 'AccessDeniedError';
  }
}

export class StorageQuotaExceededError extends FileError {
  constructor(current: number, quota: number) {
    super(
      FileErrorCode.STORAGE_QUOTA_EXCEEDED,
      `Storage quota exceeded: ${current} bytes used, quota: ${quota} bytes`,
      { current, quota }
    );
    this.name = 'StorageQuotaExceededError';
  }
}

export class UploadFailedError extends FileError {
  constructor(path: string, reason?: string) {
    super(
      FileErrorCode.UPLOAD_FAILED,
      reason ? `Upload failed: ${path} - ${reason}` : `Upload failed: ${path}`,
      { path, reason }
    );
    this.name = 'UploadFailedError';
  }
}

export class DownloadFailedError extends FileError {
  constructor(path: string, reason?: string) {
    super(
      FileErrorCode.DOWNLOAD_FAILED,
      reason ? `Download failed: ${path} - ${reason}` : `Download failed: ${path}`,
      { path, reason }
    );
    this.name = 'DownloadFailedError';
  }
}

export class ChecksumMismatchError extends FileError {
  constructor(path: string, expected: string, actual: string) {
    super(
      FileErrorCode.CHECKSUM_MISMATCH,
      `Checksum mismatch: ${path} (expected: ${expected}, actual: ${actual})`,
      { path, expected, actual }
    );
    this.name = 'ChecksumMismatchError';
  }
}

export class FolderNotFoundError extends FileError {
  constructor(path: string) {
    super(FileErrorCode.FOLDER_NOT_FOUND, `Folder not found: ${path}`, { path });
    this.name = 'FolderNotFoundError';
  }
}

export class FolderNotEmptyError extends FileError {
  constructor(path: string) {
    super(FileErrorCode.FOLDER_NOT_EMPTY, `Folder not empty: ${path}`, { path });
    this.name = 'FolderNotEmptyError';
  }
}

export class ValidationError extends FileError {
  constructor(message: string, errors?: string[]) {
    super(FileErrorCode.VALIDATION_FAILED, message, { errors });
    this.name = 'ValidationError';
  }
}

// ============================================================================
// ERROR FACTORY
// ============================================================================

export class FileErrorFactory {
  static fromError(error: unknown, defaultCode: FileErrorCode = FileErrorCode.UNKNOWN): FileError {
    if (error instanceof FileError) {
      return error;
    }

    if (error instanceof Error) {
      // Try to infer error type from message
      const message = error.message.toLowerCase();
      
      if (message.includes('not found')) {
        return new FileNotFoundError(error.message);
      }
      
      if (message.includes('access denied') || message.includes('permission')) {
        return new AccessDeniedError(error.message);
      }
      
      if (message.includes('too large')) {
        return new FileTooLargeError(error.message, 0, 0);
      }
      
      if (message.includes('network') || message.includes('connection')) {
        return new FileError(FileErrorCode.NETWORK_ERROR, error.message);
      }
      
      if (message.includes('timeout')) {
        return new FileError(FileErrorCode.TIMEOUT, error.message);
      }

      // Default to generic error with original message
      return new FileError(defaultCode, error.message, { originalError: error });
    }

    // Handle non-Error objects
    const message = String(error);
    return new FileError(defaultCode, message || 'Unknown error', { originalValue: error });
  }

  static isFileError(error: unknown): error is FileError {
    return error instanceof FileError;
  }

  static hasErrorCode(error: unknown, code: FileErrorCode): boolean {
    return this.isFileError(error) && error.code === code;
  }
}

// ============================================================================
// ERROR UTILITIES
// ============================================================================

export function createFileError(
  code: FileErrorCode,
  message: string,
  details?: Record<string, unknown>
): FileError {
  return new FileError(code, message, details);
}

export function isRetryableError(error: FileError): boolean {
  const retryableCodes = [
    FileErrorCode.NETWORK_ERROR,
    FileErrorCode.TIMEOUT,
    FileErrorCode.CONNECTION_FAILED,
    FileErrorCode.UPLOAD_INTERRUPTED,
    FileErrorCode.DOWNLOAD_INTERRUPTED,
    FileErrorCode.STORAGE_ERROR,
  ];

  return retryableCodes.includes(error.code);
}

export function isUserError(error: FileError): boolean {
  const userErrorCodes = [
    FileErrorCode.INVALID_INPUT,
    FileErrorCode.INVALID_PATH,
    FileErrorCode.PATH_TRAVERSAL,
    FileErrorCode.FILE_TOO_LARGE,
    FileErrorCode.INVALID_FILE_TYPE,
    FileErrorCode.ACCESS_DENIED,
    FileErrorCode.VALIDATION_FAILED,
  ];

  return userErrorCodes.includes(error.code);
}

export function isSystemError(error: FileError): boolean {
  const systemErrorCodes = [
    FileErrorCode.STORAGE_ERROR,
    FileErrorCode.STORAGE_FULL,
    FileErrorCode.NETWORK_ERROR,
    FileErrorCode.TIMEOUT,
    FileErrorCode.CONNECTION_FAILED,
  ];

  return systemErrorCodes.includes(error.code);
}

// ============================================================================
// ERROR AGGREGATE
// ============================================================================

export class FileErrorAggregate extends Error {
  public readonly errors: FileError[];

  constructor(errors: FileError[]) {
    const message = `Multiple errors occurred:\n${errors.map(e => `- ${e.message}`).join('\n')}`;
    super(message);
    this.name = 'FileErrorAggregate';
    this.errors = errors;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileErrorAggregate);
    }
  }

  hasErrorCode(code: FileErrorCode): boolean {
    return this.errors.some(e => e.code === code);
  }

  getErrorsByCode(code: FileErrorCode): FileError[] {
    return this.errors.filter(e => e.code === code);
  }
}
