/**
 * Write Guard
 *
 * Enforces allowlist-based directory restrictions for file write operations.
 * Prevents writes to directories outside the configured allowlist and
 * blocks writes to sensitive files.
 */

import { resolve, normalize, dirname, extname, basename, sep } from 'path';
import { stat, mkdir, writeFile as fsWriteFile, access, constants } from 'fs/promises';
import type {
  WriteGuardConfig,
  WriteGuardResult,
  WriteOptions,
  WriteGuardStats,
  PathErrorCode,
} from './guardTypes.js';
import {
  DEFAULT_ALLOWED_DIRS,
  DEFAULT_SENSITIVE_PATTERNS,
  DANGEROUS_EXTENSIONS,
} from './guardTypes.js';
import { safeJoin, isPathWithin, normalizePath } from './safePath.js';

/**
 * Default configuration for write guard
 */
const DEFAULT_WRITE_GUARD_CONFIG: Partial<WriteGuardConfig> = {
  allowedDirs: [...DEFAULT_ALLOWED_DIRS],
  allowedExtensions: undefined, // Allow all by default
  sensitivePatterns: [...DEFAULT_SENSITIVE_PATTERNS],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowOverwrite: true,
  dryRun: false,
};

/**
 * Write Guard class for enforcing directory allowlists
 */
export class WriteGuard {
  private config: Required<WriteGuardConfig>;
  private stats: WriteGuardStats;
  private normalizedAllowedDirs: string[];

  constructor(config: WriteGuardConfig) {
    this.config = {
      root: config.root,
      allowedDirs: config.allowedDirs ?? [...DEFAULT_ALLOWED_DIRS],
      allowedExtensions: config.allowedExtensions ?? [],
      sensitivePatterns: config.sensitivePatterns ?? [...DEFAULT_SENSITIVE_PATTERNS],
      maxFileSize: config.maxFileSize ?? 10 * 1024 * 1024,
      allowOverwrite: config.allowOverwrite ?? true,
      dryRun: config.dryRun ?? false,
    };

    // Pre-normalize allowed directories for faster comparison
    this.normalizedAllowedDirs = this.config.allowedDirs.map((dir) => 
      normalizePath(dir.replace(/\/$/, '')) // Remove trailing slash
    );

    this.stats = {
      totalAttempts: 0,
      successfulWrites: 0,
      blockedWrites: 0,
      blocksByCode: {} as Record<PathErrorCode, number>,
    };
  }

  /**
   * Check if a path is within one of the allowed directories
   */
  private isInAllowedDir(relPath: string): boolean {
    const normalizedPath = normalizePath(relPath);
    
    for (const allowedDir of this.normalizedAllowedDirs) {
      // Check if path starts with allowed directory
      if (normalizedPath === allowedDir || 
          normalizedPath.startsWith(allowedDir + sep) ||
          normalizedPath.startsWith(allowedDir + '/')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if a filename matches sensitive patterns
   */
  private isSensitiveFile(filename: string): boolean {
    const name = basename(filename);
    
    for (const pattern of this.config.sensitivePatterns) {
      if (pattern.test(name) || pattern.test(filename)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if the file extension is allowed
   */
  private isExtensionAllowed(filename: string): boolean {
    // If no restrictions, allow all
    if (!this.config.allowedExtensions || this.config.allowedExtensions.length === 0) {
      return true;
    }

    const ext = extname(filename).toLowerCase();
    
    // Always block dangerous extensions
    if (DANGEROUS_EXTENSIONS.includes(ext as typeof DANGEROUS_EXTENSIONS[number])) {
      return false;
    }

    return this.config.allowedExtensions.includes(ext);
  }

  /**
   * Record a blocked write attempt
   */
  private recordBlock(code: PathErrorCode, path: string, reason: string): void {
    this.stats.blockedWrites++;
    this.stats.blocksByCode[code] = (this.stats.blocksByCode[code] ?? 0) + 1;
    this.stats.lastBlockedPath = path;
    this.stats.lastBlockReason = reason;
  }

  /**
   * Validate a write operation without performing it
   *
   * @param relPath - Relative path within root
   * @param options - Write options
   * @returns Validation result
   */
  validate(relPath: string, options?: WriteOptions): WriteGuardResult {
    this.stats.totalAttempts++;

    const result: WriteGuardResult = {
      allowed: false,
      warnings: [],
    };

    // First, use safeJoin to validate the path
    const pathResult = safeJoin(this.config.root, relPath);
    
    if (!pathResult.valid) {
      this.recordBlock(
        pathResult.errorCode!,
        relPath,
        pathResult.errorMessage!
      );
      return {
        allowed: false,
        errorCode: pathResult.errorCode,
        reason: pathResult.errorMessage,
      };
    }

    // Check if in allowed directory
    if (!this.isInAllowedDir(relPath)) {
      const reason = `Path '${relPath}' is not in an allowed directory. Allowed: ${this.config.allowedDirs.join(', ')}`;
      this.recordBlock('DISALLOWED_DIR', relPath, reason);
      return {
        allowed: false,
        errorCode: 'DISALLOWED_DIR',
        reason,
      };
    }

    // Check for sensitive files
    if (!options?.skipSensitiveCheck && this.isSensitiveFile(relPath)) {
      const reason = `Cannot write to sensitive file: ${basename(relPath)}`;
      this.recordBlock('SENSITIVE_FILE', relPath, reason);
      return {
        allowed: false,
        errorCode: 'SENSITIVE_FILE',
        reason,
      };
    }

    // Check file extension
    if (!this.isExtensionAllowed(relPath)) {
      const ext = extname(relPath);
      const reason = `File extension '${ext}' is not allowed`;
      this.recordBlock('INVALID_CHARS', relPath, reason);
      return {
        allowed: false,
        errorCode: 'INVALID_CHARS',
        reason,
      };
    }

    // Check file size if provided
    if (options?.expectedSize && options.expectedSize > this.config.maxFileSize) {
      result.warnings!.push(
        `File size (${options.expectedSize} bytes) exceeds recommended maximum (${this.config.maxFileSize} bytes)`
      );
    }

    result.allowed = true;
    result.validatedPath = pathResult.resolvedPath;
    return result;
  }

  /**
   * Check if a file can be overwritten
   */
  async canOverwrite(absPath: string, options?: WriteOptions): Promise<boolean> {
    const overwrite = options?.overwrite ?? this.config.allowOverwrite;
    
    if (overwrite) {
      return true;
    }

    try {
      await access(absPath, constants.F_OK);
      // File exists and overwrite is disabled
      return false;
    } catch {
      // File doesn't exist, can "overwrite"
      return true;
    }
  }

  /**
   * Write a file with guard protections
   *
   * @param relPath - Relative path within root
   * @param content - Content to write
   * @param options - Write options
   * @returns Result of the operation
   */
  async write(
    relPath: string,
    content: string | Buffer,
    options?: WriteOptions
  ): Promise<WriteGuardResult> {
    // Validate first
    const validation = this.validate(relPath, {
      ...options,
      expectedSize: typeof content === 'string' ? Buffer.byteLength(content) : content.length,
    });

    if (!validation.allowed) {
      return validation;
    }

    const absPath = validation.validatedPath!;

    // Check overwrite permission
    const canWrite = await this.canOverwrite(absPath, options);
    if (!canWrite) {
      const reason = `File already exists and overwrite is disabled: ${relPath}`;
      this.recordBlock('INVALID_CHARS', relPath, reason);
      return {
        allowed: false,
        errorCode: 'INVALID_CHARS',
        reason,
      };
    }

    // Dry run mode - don't actually write
    if (this.config.dryRun) {
      this.stats.successfulWrites++;
      return {
        ...validation,
        warnings: [...(validation.warnings ?? []), 'Dry run mode - file not written'],
      };
    }

    // Create parent directories if needed
    if (options?.createDirs) {
      const parentDir = dirname(absPath);
      await mkdir(parentDir, { recursive: true });
    }

    // Perform the write
    try {
      await fsWriteFile(absPath, content, 'utf-8');
      this.stats.successfulWrites++;
      return validation;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        allowed: false,
        errorCode: 'INVALID_CHARS',
        reason: `Write failed: ${message}`,
        warnings: validation.warnings,
      };
    }
  }

  /**
   * Validate multiple paths at once
   *
   * @param paths - Array of relative paths
   * @returns Map of path to validation result
   */
  validateBatch(paths: string[]): Map<string, WriteGuardResult> {
    const results = new Map<string, WriteGuardResult>();
    
    for (const path of paths) {
      results.set(path, this.validate(path));
    }
    
    return results;
  }

  /**
   * Get current statistics
   */
  getStats(): WriteGuardStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulWrites: 0,
      blockedWrites: 0,
      blocksByCode: {} as Record<PathErrorCode, number>,
    };
  }

  /**
   * Get the current configuration (read-only copy)
   */
  getConfig(): Readonly<WriteGuardConfig> {
    return { ...this.config };
  }

  /**
   * Check if a directory is in the allowlist
   */
  isDirectoryAllowed(dir: string): boolean {
    return this.isInAllowedDir(dir);
  }

  /**
   * Add a directory to the allowlist
   */
  addAllowedDir(dir: string): void {
    const normalized = normalizePath(dir.replace(/\/$/, ''));
    if (!this.normalizedAllowedDirs.includes(normalized)) {
      this.config.allowedDirs.push(dir);
      this.normalizedAllowedDirs.push(normalized);
    }
  }

  /**
   * Remove a directory from the allowlist
   */
  removeAllowedDir(dir: string): void {
    const normalized = normalizePath(dir.replace(/\/$/, ''));
    const index = this.normalizedAllowedDirs.indexOf(normalized);
    if (index !== -1) {
      this.normalizedAllowedDirs.splice(index, 1);
      this.config.allowedDirs.splice(index, 1);
    }
  }
}

/**
 * Create a write guard with default configuration
 *
 * @param root - Root directory for all operations
 * @param allowedDirs - Allowed directories (defaults to src/, app/, packages/)
 * @returns Configured WriteGuard instance
 *
 * @example
 * ```typescript
 * const guard = createWriteGuard('/app/workspace');
 *
 * // Validate before writing
 * const result = guard.validate('src/index.ts');
 * if (result.allowed) {
 *   await guard.write('src/index.ts', 'export default {};');
 * }
 *
 * // Blocked paths
 * guard.validate('../../../etc/passwd'); // { allowed: false, errorCode: 'PATH_TRAVERSAL' }
 * guard.validate('node_modules/foo.js'); // { allowed: false, errorCode: 'DISALLOWED_DIR' }
 * guard.validate('src/.env');            // { allowed: false, errorCode: 'SENSITIVE_FILE' }
 * ```
 */
export function createWriteGuard(
  root: string,
  allowedDirs?: string[]
): WriteGuard {
  return new WriteGuard({
    root,
    allowedDirs: allowedDirs ?? [...DEFAULT_ALLOWED_DIRS],
  });
}

/**
 * Quick validation helper - validates path without creating a full guard
 *
 * @param root - Root directory
 * @param relPath - Relative path to validate
 * @param allowedDirs - Allowed directories
 * @returns Whether the write would be allowed
 */
export function canWriteTo(
  root: string,
  relPath: string,
  allowedDirs: string[] = [...DEFAULT_ALLOWED_DIRS]
): boolean {
  const guard = new WriteGuard({ root, allowedDirs });
  return guard.validate(relPath).allowed;
}
