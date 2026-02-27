/**
 * Safe Path Utilities
 *
 * Provides secure path manipulation functions that prevent directory
 * traversal attacks, absolute path injections, and UNC path exploits.
 */

import { resolve, normalize, isAbsolute, relative, sep, posix, win32 } from 'path';
import type {
  PathValidationResult,
  SafePathConfig,
  PathErrorCode,
} from './guardTypes.js';
import {
  INVALID_PATH_CHARS,
  UNC_PATH_PATTERN,
  PATH_TRAVERSAL_PATTERN,
} from './guardTypes.js';

/**
 * Default configuration for safe path operations
 */
const DEFAULT_CONFIG: Partial<SafePathConfig> = {
  allowSymlinks: false,
  caseSensitive: process.platform !== 'win32',
  maxPathLength: 260, // Windows MAX_PATH
};

/**
 * Check if a path contains null bytes (poison null byte attack)
 */
function hasNullBytes(path: string): boolean {
  return path.includes('\0');
}

/**
 * Check if a path is a UNC path (Windows network path)
 */
function isUNCPath(path: string): boolean {
  return UNC_PATH_PATTERN.test(path);
}

/**
 * Check if a path contains traversal sequences
 */
function hasTraversal(path: string): boolean {
  // Normalize different separators to check uniformly
  const normalized = path.replace(/\\/g, '/');
  
  // Check for .. in various forms
  if (PATH_TRAVERSAL_PATTERN.test(path)) return true;
  if (PATH_TRAVERSAL_PATTERN.test(normalized)) return true;
  
  // Also check for encoded variants
  const decoded = decodeURIComponent(path);
  if (PATH_TRAVERSAL_PATTERN.test(decoded)) return true;
  
  // Check for double-encoded
  try {
    const doubleDecoded = decodeURIComponent(decoded);
    if (PATH_TRAVERSAL_PATTERN.test(doubleDecoded)) return true;
  } catch {
    // Ignore decode errors
  }
  
  return false;
}

/**
 * Check if path contains invalid characters
 */
function hasInvalidChars(path: string): boolean {
  return INVALID_PATH_CHARS.test(path);
}

/**
 * Validate a relative path without joining
 *
 * @param relPath - The relative path to validate
 * @returns Validation result
 */
export function validateRelativePath(relPath: string): PathValidationResult {
  const result: PathValidationResult = {
    valid: false,
    originalPath: relPath,
  };

  // Check for empty path
  if (!relPath || relPath.trim() === '') {
    result.errorCode = 'EMPTY_PATH';
    result.errorMessage = 'Path cannot be empty';
    return result;
  }

  // Check for null bytes
  if (hasNullBytes(relPath)) {
    result.errorCode = 'NULL_BYTE';
    result.errorMessage = 'Path contains null bytes';
    return result;
  }

  // Check for UNC paths
  if (isUNCPath(relPath)) {
    result.errorCode = 'UNC_PATH';
    result.errorMessage = 'UNC network paths are not allowed';
    return result;
  }

  // Check for absolute paths (both Unix and Windows styles)
  if (isAbsolute(relPath) || /^[a-zA-Z]:/.test(relPath)) {
    result.errorCode = 'ABSOLUTE_PATH';
    result.errorMessage = 'Absolute paths are not allowed; use relative paths only';
    return result;
  }

  // Check for path traversal
  if (hasTraversal(relPath)) {
    result.errorCode = 'PATH_TRAVERSAL';
    result.errorMessage = 'Path traversal (.. segments) is not allowed';
    return result;
  }

  // Check for invalid characters
  if (hasInvalidChars(relPath)) {
    result.errorCode = 'INVALID_CHARS';
    result.errorMessage = 'Path contains invalid characters';
    return result;
  }

  result.valid = true;
  return result;
}

/**
 * Safely join a root path with a relative path
 *
 * This function ensures the resulting path stays within the root directory
 * and rejects any attempts to escape via traversal, absolute paths, or UNC paths.
 *
 * @param root - The root directory that all paths must stay within
 * @param relPath - The relative path to join with root
 * @param config - Optional configuration
 * @returns Validation result with resolved path if valid
 *
 * @example
 * ```typescript
 * const result = safeJoin('/app/workspace', 'src/index.ts');
 * // { valid: true, resolvedPath: '/app/workspace/src/index.ts', ... }
 *
 * const badResult = safeJoin('/app/workspace', '../../../etc/passwd');
 * // { valid: false, errorCode: 'PATH_TRAVERSAL', ... }
 * ```
 */
export function safeJoin(
  root: string,
  relPath: string,
  config?: Partial<SafePathConfig>
): PathValidationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const result: PathValidationResult = {
    valid: false,
    originalPath: relPath,
  };

  // Validate root is provided and absolute
  if (!root) {
    result.errorCode = 'EMPTY_PATH';
    result.errorMessage = 'Root path cannot be empty';
    return result;
  }

  // First validate the relative path itself
  const relValidation = validateRelativePath(relPath);
  if (!relValidation.valid) {
    return {
      ...relValidation,
      originalPath: relPath,
    };
  }

  // Check path length
  const tentativePath = resolve(root, relPath);
  if (cfg.maxPathLength && tentativePath.length > cfg.maxPathLength) {
    result.errorCode = 'INVALID_CHARS'; // Reusing for length issues
    result.errorMessage = `Path exceeds maximum length of ${cfg.maxPathLength} characters`;
    return result;
  }

  // Check against additional reject patterns
  if (cfg.rejectPatterns) {
    for (const pattern of cfg.rejectPatterns) {
      if (pattern.test(relPath) || pattern.test(tentativePath)) {
        result.errorCode = 'INVALID_CHARS';
        result.errorMessage = `Path matches rejected pattern: ${pattern}`;
        return result;
      }
    }
  }

  // Normalize and resolve the path
  const normalizedRoot = normalize(resolve(root));
  const resolvedPath = normalize(resolve(root, relPath));

  // Ensure the resolved path is within root
  // Use relative() to check - if it starts with .., it's outside
  const relativePath = relative(normalizedRoot, resolvedPath);
  
  // On Windows, also check for drive letter changes
  if (process.platform === 'win32') {
    const rootDrive = normalizedRoot.slice(0, 2).toUpperCase();
    const resolvedDrive = resolvedPath.slice(0, 2).toUpperCase();
    if (rootDrive !== resolvedDrive) {
      result.errorCode = 'OUTSIDE_ROOT';
      result.errorMessage = 'Path escapes root directory (different drive)';
      return result;
    }
  }

  // Check if relative path escapes root
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    result.errorCode = 'OUTSIDE_ROOT';
    result.errorMessage = 'Resolved path escapes root directory';
    return result;
  }

  // Additional check: ensure resolved starts with root
  const rootCheck = cfg.caseSensitive
    ? resolvedPath.startsWith(normalizedRoot)
    : resolvedPath.toLowerCase().startsWith(normalizedRoot.toLowerCase());
    
  if (!rootCheck) {
    result.errorCode = 'OUTSIDE_ROOT';
    result.errorMessage = 'Resolved path is outside root directory';
    return result;
  }

  result.valid = true;
  result.resolvedPath = resolvedPath;
  return result;
}

/**
 * Safely join multiple path segments
 *
 * @param root - The root directory
 * @param segments - Path segments to join
 * @param config - Optional configuration
 * @returns Validation result
 */
export function safeJoinMultiple(
  root: string,
  segments: string[],
  config?: Partial<SafePathConfig>
): PathValidationResult {
  // Join all segments with the platform separator
  const relPath = segments.join(sep);
  return safeJoin(root, relPath, config);
}

/**
 * Normalize a path for safe comparison
 *
 * Converts to lowercase on Windows, normalizes separators, removes trailing slashes.
 *
 * @param path - Path to normalize
 * @param caseSensitive - Whether to preserve case
 * @returns Normalized path
 */
export function normalizePath(path: string, caseSensitive = process.platform !== 'win32'): string {
  let normalized = normalize(path);
  
  // Normalize separators to platform standard
  normalized = normalized.replace(/[\\/]+/g, sep);
  
  // Remove trailing separator (except for root)
  if (normalized.length > 1 && normalized.endsWith(sep)) {
    normalized = normalized.slice(0, -1);
  }
  
  // Lowercase on case-insensitive systems
  if (!caseSensitive) {
    normalized = normalized.toLowerCase();
  }
  
  return normalized;
}

/**
 * Check if a path is safely contained within another
 *
 * @param parent - The containing directory
 * @param child - The path to check
 * @param caseSensitive - Whether to use case-sensitive comparison
 * @returns True if child is safely within parent
 */
export function isPathWithin(
  parent: string,
  child: string,
  caseSensitive = process.platform !== 'win32'
): boolean {
  const normalizedParent = normalizePath(resolve(parent), caseSensitive);
  const normalizedChild = normalizePath(resolve(child), caseSensitive);
  
  // Child must start with parent + separator (or be equal)
  if (normalizedChild === normalizedParent) {
    return true;
  }
  
  const parentWithSep = normalizedParent + sep;
  return normalizedChild.startsWith(parentWithSep);
}

/**
 * Extract the relative path from a full path given a root
 *
 * @param root - The root directory
 * @param fullPath - The full path
 * @returns The relative portion, or null if not within root
 */
export function extractRelativePath(root: string, fullPath: string): string | null {
  if (!isPathWithin(root, fullPath)) {
    return null;
  }
  
  const rel = relative(resolve(root), resolve(fullPath));
  
  // Validate the extracted relative path doesn't have traversal
  if (hasTraversal(rel)) {
    return null;
  }
  
  return rel;
}

/**
 * Sanitize a filename by removing dangerous characters
 *
 * @param filename - The filename to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove null bytes
  let sanitized = filename.replace(/\0/g, '');
  
  // Remove path separators
  sanitized = sanitized.replace(/[\\/]/g, '_');
  
  // Remove invalid characters (use global flag to replace all)
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '_');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  
  // Collapse multiple underscores
  sanitized = sanitized.replace(/_+/g, '_');
  
  // Ensure not empty
  if (!sanitized) {
    sanitized = 'unnamed';
  }
  
  return sanitized;
}

/**
 * Create a safe path configuration builder
 */
export function createSafePathConfig(root: string): SafePathConfig & {
  withSymlinks: (allow: boolean) => SafePathConfig;
  withMaxLength: (length: number) => SafePathConfig;
  withRejectPatterns: (patterns: RegExp[]) => SafePathConfig;
} {
  const config: SafePathConfig = {
    root,
    allowSymlinks: false,
    caseSensitive: process.platform !== 'win32',
    maxPathLength: 260,
    rejectPatterns: [],
  };

  return {
    ...config,
    withSymlinks(allow: boolean) {
      return { ...config, allowSymlinks: allow };
    },
    withMaxLength(length: number) {
      return { ...config, maxPathLength: length };
    },
    withRejectPatterns(patterns: RegExp[]) {
      return { ...config, rejectPatterns: patterns };
    },
  };
}
