/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/upload/validation
 */

import type { 
  UploadValidationResult,
  UploadOptions,
  MimeType,
  FileSize,
  FilePath
} from './types';
import { FileError, FileErrorCode } from '../errors';
import { createHash } from 'crypto';

// ============================================================================
// UPLOAD VALIDATOR
// ============================================================================

export class UploadValidator {
  private readonly forbiddenChars = /[<>:"|?*\x00-\x1f]/;
  private readonly reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  private readonly maxFilenameLength = 255;

  /**
   * Validate file before upload
   */
  async validate(
    filename: string,
    size: FileSize,
    contentType: MimeType,
    options?: UploadOptions
  ): Promise<UploadValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitizedFilename = filename;

    // Validate filename
    const filenameResult = this.validateFilename(filename);
    if (!filenameResult.valid) {
      errors.push(...filenameResult.errors);
      if (filenameResult.sanitized) {
        sanitizedFilename = filenameResult.sanitized;
      }
    }

    // Validate file size
    if (options?.maxSize && size > options.maxSize) {
      errors.push(
        `File too large: ${size} bytes (max: ${options.maxSize} bytes)`
      );
    }

    // Validate MIME type
    if (options?.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
      if (!options.allowedMimeTypes.includes(contentType)) {
        errors.push(
          `Invalid MIME type: ${contentType} (allowed: ${options.allowedMimeTypes.join(', ')})`
        );
      }
    }

    // Validate file extension
    if (options?.allowedExtensions && options.allowedExtensions.length > 0) {
      const ext = this.getExtension(filename);
      if (!ext || !options.allowedExtensions.includes(ext)) {
        errors.push(
          `Invalid file extension: ${ext || 'none'} (allowed: ${options.allowedExtensions.join(', ')})`
        );
      }
    }

    // Check for suspicious files
    const suspiciousCheck = this.checkSuspiciousFiles(filename, contentType);
    if (suspiciousCheck.isSuspicious) {
      errors.push(...suspiciousCheck.reasons);
    }

    // Additional warnings
    if (size > 50 * 1024 * 1024) { // 50MB
      warnings.push('Large file upload may take longer');
    }

    if (contentType.startsWith('application/') && !this.isSafeApplicationType(contentType)) {
      warnings.push('Uploading executable files requires additional verification');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedFilename: sanitizedFilename !== filename ? sanitizedFilename : undefined
    };
  }

  /**
   * Validate filename
   */
  private validateFilename(filename: string): {
    valid: boolean;
    errors: string[];
    sanitized?: string;
  } {
    const errors: string[] = [];
    let sanitized = filename;

    // Check for empty filename
    if (!filename || filename.trim().length === 0) {
      errors.push('Filename cannot be empty');
      return { valid: false, errors };
    }

    // Check length
    if (filename.length > this.maxFilenameLength) {
      errors.push(
        `Filename too long: ${filename.length} characters (max: ${this.maxFilenameLength})`
      );
    }

    // Check for forbidden characters
    if (this.forbiddenChars.test(filename)) {
      errors.push('Filename contains invalid characters');
      // Sanitize by replacing forbidden characters
      sanitized = filename.replace(this.forbiddenChars, '_');
    }

    // Check for reserved names (Windows)
    if (this.reservedNames.test(filename)) {
      errors.push(`Filename is reserved: ${filename}`);
      sanitized = `file_${filename}`;
    }

    // Check for path traversal
    if (filename.includes('../') || filename.includes('..\\')) {
      errors.push('Filename contains path traversal sequences');
      sanitized = filename.replace(/\.\./g, '_');
    }

    // Check for leading/trailing dots and spaces
    if (filename.startsWith('.') || filename.startsWith(' ') || 
        filename.endsWith('.') || filename.endsWith(' ')) {
      errors.push('Filename cannot start or end with dots or spaces');
      sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
    }

    // Ensure it's not just dots
    if (/^\.+$/.test(sanitized)) {
      errors.push('Filename cannot be only dots');
      sanitized = 'file';
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: sanitized !== filename ? sanitized : undefined
    };
  }

  /**
   * Check for suspicious files
   */
  private checkSuspiciousFiles(filename: string, contentType: MimeType): {
    isSuspicious: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    const ext = this.getExtension(filename);

    // Check for executable files
    const executableExtensions = ['exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar'];
    if (ext && executableExtensions.includes(ext)) {
      reasons.push('Executable file type detected');
    }

    // Check for script files
    const scriptExtensions = ['php', 'asp', 'aspx', 'jsp', 'py', 'rb', 'pl', 'sh'];
    if (ext && scriptExtensions.includes(ext)) {
      reasons.push('Script file type detected');
    }

    // Check for dangerous MIME types
    const dangerousMimeTypes = [
      'application/x-executable',
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/x-sh',
      'application/x-php',
      'application/x-python-code'
    ];

    if (dangerousMimeTypes.includes(contentType)) {
      reasons.push('Dangerous MIME type detected');
    }

    // Check for double extensions (often used to hide file type)
    const parts = filename.split('.');
    if (parts.length > 2) {
      const lastTwo = parts.slice(-2);
      if (lastTwo[1].toLowerCase() === 'exe' && 
          ['jpg', 'png', 'gif', 'pdf', 'doc'].includes(lastTwo[0].toLowerCase())) {
        reasons.push('Suspicious double extension detected');
      }
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons
    };
  }

  /**
   * Check if application MIME type is safe
   */
  private isSafeApplicationType(contentType: MimeType): boolean {
    const safeTypes = [
      'application/pdf',
      'application/json',
      'application/xml',
      'application/zip',
      'application/x-zip-compressed',
      'application/msword',
      'application/vnd.openxmlformats-officedocument',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint'
    ];

    return safeTypes.some(type => contentType.startsWith(type));
  }

  /**
   * Get file extension
   */
  private getExtension(filename: string): string | null {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : null;
  }

  /**
   * Validate file content against declared type
   */
  async validateContent(
    buffer: Buffer,
    declaredType: MimeType
  ): Promise<UploadValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get actual content type from file signature
    const actualType = this.detectContentTypeFromBuffer(buffer);

    // Check if declared type matches actual type
    if (actualType && !this.isCompatibleType(declaredType, actualType)) {
      errors.push(
        `Declared MIME type (${declaredType}) does not match actual content type (${actualType})`
      );
    }

    // Check for file signature mismatches
    const signatureCheck = this.validateFileSignature(buffer, declaredType);
    if (!signatureCheck.valid) {
      errors.push(...signatureCheck.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Detect content type from buffer
   */
  private detectContentTypeFromBuffer(buffer: Buffer): MimeType | null {
    // File signatures (magic numbers)
    const signatures: Array<{ pattern: Buffer; type: MimeType }> = [
      { pattern: Buffer.from([0xFF, 0xD8, 0xFF]), type: 'image/jpeg' },
      { pattern: Buffer.from([0x89, 0x50, 0x4E, 0x47]), type: 'image/png' },
      { pattern: Buffer.from([0x47, 0x49, 0x46]), type: 'image/gif' },
      { pattern: Buffer.from([0x25, 0x50, 0x44, 0x46]), type: 'application/pdf' },
      { pattern: Buffer.from([0x50, 0x4B, 0x03, 0x04]), type: 'application/zip' },
      { pattern: Buffer.from([0x50, 0x4B, 0x05, 0x06]), type: 'application/zip' },
      { pattern: Buffer.from([0x50, 0x4B, 0x07, 0x08]), type: 'application/zip' },
      { pattern: Buffer.from([0x4D, 0x5A]), type: 'application/x-msdownload' },
      { pattern: Buffer.from([0x7F, 0x45, 0x4C, 0x46]), type: 'application/x-executable' }
    ];

    for (const { pattern, type } of signatures) {
      if (buffer.length >= pattern.length && 
          buffer.subarray(0, pattern.length).equals(pattern)) {
        return type;
      }
    }

    return null;
  }

  /**
   * Check if two MIME types are compatible
   */
  private isCompatibleType(declared: MimeType, actual: MimeType): boolean {
    // Exact match
    if (declared === actual) {
      return true;
    }

    // Generic application/octet-stream should match anything
    if (declared === 'application/octet-stream') {
      return true;
    }

    // Check if they're in the same category
    const declaredCategory = declared.split('/')[0];
    const actualCategory = actual.split('/')[0];

    if (declaredCategory === actualCategory) {
      // Special cases for text files
      if (declaredCategory === 'text') {
        return true;
      }

      // Special cases for image types
      if (declaredCategory === 'image') {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate file signature
   */
  private validateFileSignature(buffer: Buffer, contentType: MimeType): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Empty file check
    if (buffer.length === 0) {
      errors.push('File is empty');
      return { valid: false, errors };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      { pattern: Buffer.from('MZ'), name: 'Windows executable' },
      { pattern: Buffer.from('\x7FELF'), name: 'Linux/Unix executable' },
      { pattern: Buffer.from('<?php'), name: 'PHP script' },
      { pattern: Buffer.from('<%'), name: 'ASP script' },
      { pattern: Buffer.from('#!/bin/sh'), name: 'Shell script' },
      { pattern: Buffer.from('#!/usr/bin/env'), name: 'Executable script' }
    ];

    for (const { pattern, name } of suspiciousPatterns) {
      if (buffer.length >= pattern.length) {
        const start = buffer.subarray(0, Math.min(pattern.length, 100));
        const end = buffer.subarray(Math.max(0, buffer.length - 100));
        
        if (start.includes(pattern) || end.includes(pattern)) {
          errors.push(`File contains ${name} signature`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate checksum
   */
  async validateChecksum(
    buffer: Buffer,
    expectedChecksum: string,
    algorithm: 'sha256' | 'md5' | 'sha1' = 'sha256'
  ): Promise<UploadValidationResult> {
    const errors: string[] = [];

    const actualChecksum = createHash(algorithm).update(buffer).digest('hex');

    if (actualChecksum !== expectedChecksum) {
      errors.push(
        `Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`
      );
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize file path
   */
  sanitizePath(path: FilePath): FilePath {
    // Normalize path separators
    path = path.replace(/\\/g, '/');
    
    // Remove duplicate slashes
    path = path.replace(/\/+/g, '/');
    
    // Remove leading slash (relative path)
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    
    // Encode unsafe characters
    path = encodeURIComponent(path).replace(/%2F/g, '/');
    
    return path;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export const uploadValidator = new UploadValidator();

export async function validateUpload(
  filename: string,
  size: FileSize,
  contentType: MimeType,
  options?: UploadOptions
): Promise<UploadValidationResult> {
  return uploadValidator.validate(filename, size, contentType, options);
}

export async function validateFileContent(
  buffer: Buffer,
  declaredType: MimeType
): Promise<UploadValidationResult> {
  return uploadValidator.validateContent(buffer, declaredType);
}

export async function validateFileChecksum(
  buffer: Buffer,
  expectedChecksum: string,
  algorithm?: 'sha256' | 'md5' | 'sha1'
): Promise<UploadValidationResult> {
  return uploadValidator.validateChecksum(buffer, expectedChecksum, algorithm);
}
