/**
 * Filesystem Guard Types
 *
 * Type definitions for the filesystem guard module that prevents
 * unsafe file paths and risky write operations.
 */

/**
 * Error codes for path validation failures
 */
export type PathErrorCode =
  | 'PATH_TRAVERSAL'      // Contains .. segments
  | 'ABSOLUTE_PATH'       // Path is absolute instead of relative
  | 'UNC_PATH'            // Windows UNC path (\\server\share)
  | 'NULL_BYTE'           // Contains null bytes
  | 'EMPTY_PATH'          // Path is empty or whitespace
  | 'INVALID_CHARS'       // Contains invalid characters
  | 'OUTSIDE_ROOT'        // Resolved path escapes root
  | 'DISALLOWED_DIR'      // Write to directory not in allowlist
  | 'SENSITIVE_FILE'      // Attempting to write sensitive file
  | 'SYMLINK_ESCAPE';     // Symlink points outside allowed area

/**
 * Result of path validation
 */
export interface PathValidationResult {
  /** Whether the path is valid */
  valid: boolean;

  /** Error code if invalid */
  errorCode?: PathErrorCode;

  /** Human-readable error message */
  errorMessage?: string;

  /** The sanitized/resolved path (only if valid) */
  resolvedPath?: string;

  /** Original input path */
  originalPath: string;
}

/**
 * Configuration for safe path operations
 */
export interface SafePathConfig {
  /** The root directory that paths must stay within */
  root: string;

  /** Allow symlinks (default: false for security) */
  allowSymlinks?: boolean;

  /** Additional patterns to reject (regex) */
  rejectPatterns?: RegExp[];

  /** Case-sensitive path matching (default: true on Unix, false on Windows) */
  caseSensitive?: boolean;

  /** Maximum path length (default: 260 for Windows compat) */
  maxPathLength?: number;
}

/**
 * Configuration for write guard
 */
export interface WriteGuardConfig {
  /** Root directory for all operations */
  root: string;

  /** Allowed directories for writes (relative to root) */
  allowedDirs: string[];

  /** File extensions allowed for writing */
  allowedExtensions?: string[];

  /** Patterns for sensitive files that should never be written */
  sensitivePatterns?: RegExp[];

  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number;

  /** Allow overwriting existing files (default: true) */
  allowOverwrite?: boolean;

  /** Dry run mode - validate but don't write (default: false) */
  dryRun?: boolean;
}

/**
 * Default allowed directories for write operations
 */
export const DEFAULT_ALLOWED_DIRS = [
  'src/',
  'app/',
  'packages/',
  'lib/',
  'components/',
  'generated/',
  '.vibecheck/',
] as const;

/**
 * Default sensitive file patterns that should not be written
 */
export const DEFAULT_SENSITIVE_PATTERNS = [
  /\.env(\..+)?$/i,           // Environment files
  /\.pem$/i,                   // PEM certificates
  /\.key$/i,                   // Private keys
  /id_rsa/i,                   // SSH keys
  /\.p12$/i,                   // PKCS12 files
  /credentials\.json$/i,       // Credential files
  /secrets?\.(json|ya?ml)$/i,  // Secret files
  /\.htpasswd$/i,              // Apache password files
  /shadow$/,                   // Unix shadow file
  /passwd$/,                   // Unix passwd file
] as const;

/**
 * Default disallowed file extensions
 */
export const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.bash',
] as const;

/**
 * Characters that are invalid in paths on various platforms
 */
export const INVALID_PATH_CHARS = /[<>:"|?*\x00-\x1f]/;

/**
 * Pattern to detect UNC paths (Windows network paths)
 */
export const UNC_PATH_PATTERN = /^[\\/]{2}[^\\/]+[\\/]+[^\\/]+/;

/**
 * Pattern to detect path traversal attempts
 */
export const PATH_TRAVERSAL_PATTERN = /(^|[\\/])\.\.($|[\\/])/;

/**
 * Result of a write guard check
 */
export interface WriteGuardResult {
  /** Whether the write is allowed */
  allowed: boolean;

  /** Error code if not allowed */
  errorCode?: PathErrorCode;

  /** Human-readable reason */
  reason?: string;

  /** The validated absolute path */
  validatedPath?: string;

  /** Warnings (non-blocking issues) */
  warnings?: string[];
}

/**
 * Options for individual write operations
 */
export interface WriteOptions {
  /** Override allowOverwrite config for this operation */
  overwrite?: boolean;

  /** Create parent directories if they don't exist */
  createDirs?: boolean;

  /** Expected file size (for pre-validation) */
  expectedSize?: number;

  /** Skip sensitive file check (use with caution) */
  skipSensitiveCheck?: boolean;
}

/**
 * Statistics tracked by the write guard
 */
export interface WriteGuardStats {
  /** Total write attempts */
  totalAttempts: number;

  /** Successful writes */
  successfulWrites: number;

  /** Blocked writes */
  blockedWrites: number;

  /** Blocks by error code */
  blocksByCode: Record<PathErrorCode, number>;

  /** Last blocked path (for debugging) */
  lastBlockedPath?: string;

  /** Last block reason */
  lastBlockReason?: string;
}
