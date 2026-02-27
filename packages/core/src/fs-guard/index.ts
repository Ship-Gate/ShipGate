/**
 * Filesystem Guard Module
 *
 * Provides secure filesystem operations that prevent directory traversal,
 * path injection attacks, and unauthorized writes.
 */

// Type exports
export type {
  PathErrorCode,
  PathValidationResult,
  SafePathConfig,
  WriteGuardConfig,
  WriteGuardResult,
  WriteOptions,
  WriteGuardStats,
} from './guardTypes.js';

export {
  DEFAULT_ALLOWED_DIRS,
  DEFAULT_SENSITIVE_PATTERNS,
  DANGEROUS_EXTENSIONS,
  INVALID_PATH_CHARS,
  UNC_PATH_PATTERN,
  PATH_TRAVERSAL_PATTERN,
} from './guardTypes.js';

// Safe path functions
export {
  safeJoin,
  safeJoinMultiple,
  validateRelativePath,
  isPathWithin,
  normalizePath,
  extractRelativePath,
  sanitizeFilename,
  createSafePathConfig,
} from './safePath.js';

// Write guard
export {
  WriteGuard,
  createWriteGuard,
  canWriteTo,
} from './writeGuard.js';
