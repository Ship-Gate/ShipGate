// ============================================================================
// ISL Standard Library - Idempotency Types
// @stdlib/idempotency/types
// ============================================================================

// ============================================================================
// BRANDED TYPES
// ============================================================================

declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;
export type RequestHash = Brand<string, 'RequestHash'>;
export type LockToken = Brand<string, 'LockToken'>;

// ============================================================================
// ENUMS
// ============================================================================

export enum RecordStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum IdempotencyErrorCode {
  KEY_TOO_LONG = 'KEY_TOO_LONG',
  INVALID_KEY_FORMAT = 'INVALID_KEY_FORMAT',
  REQUEST_MISMATCH = 'REQUEST_MISMATCH',
  LOCK_ACQUISITION_FAILED = 'LOCK_ACQUISITION_FAILED',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  STORAGE_ERROR = 'STORAGE_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  TTL_EXCEEDED = 'TTL_EXCEEDED',
  CONCURRENT_REQUEST = 'CONCURRENT_REQUEST',
  LOCK_EXPIRED = 'LOCK_EXPIRED',
  RESPONSE_TOO_LARGE = 'RESPONSE_TOO_LARGE',
}

// ============================================================================
// ENTITY
// ============================================================================

export interface IdempotencyRecord {
  key: IdempotencyKey;
  requestHash: RequestHash;
  response?: string;
  status: RecordStatus;

  // HTTP metadata
  httpStatusCode?: number;
  contentType?: string;

  // Error information
  errorCode?: string;
  errorMessage?: string;

  // Timing
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  completedAt?: Date;

  // Context
  clientId?: string;
  endpoint?: string;
  method?: string;

  // Locking
  lockToken?: LockToken;
  lockExpiresAt?: Date;
}

// ============================================================================
// CHECK TYPES
// ============================================================================

export interface CheckInput {
  key: string;
  requestHash: string;
  endpoint?: string;
  method?: string;
  clientId?: string;
}

export interface CheckResult {
  found: boolean;
  status?: RecordStatus;
  response?: string;
  httpStatusCode?: number;
  contentType?: string;
  requestMismatch: boolean;
  createdAt?: Date;
  completedAt?: Date;
}

// ============================================================================
// RECORD TYPES
// ============================================================================

export interface RecordInput {
  key: string;
  requestHash: string;
  response: string;
  httpStatusCode?: number;
  contentType?: string;
  ttl?: number; // milliseconds
  lockToken?: string;
  errorCode?: string;
  errorMessage?: string;
  markAsFailed?: boolean;
}

export interface StartProcessingInput {
  key: string;
  requestHash: string;
  endpoint?: string;
  method?: string;
  clientId?: string;
  lockTimeout?: number; // milliseconds
}

export interface LockResult {
  acquired: boolean;
  lockToken?: LockToken;
  existingStatus?: RecordStatus;
  existingResponse?: string;
  existingHttpStatusCode?: number;
  lockExpiresAt?: Date;
  requestMismatch?: boolean;
}

// ============================================================================
// CLEANUP TYPES
// ============================================================================

export interface CleanupInput {
  batchSize?: number;
  maxRecords?: number;
  keyPrefix?: string;
  clientId?: string;
  forceBefore?: Date;
  dryRun?: boolean;
}

export interface CleanupResult {
  deletedCount: number;
  batchesProcessed: number;
  oldestRemaining?: Date;
  nextExpiration?: Date;
  durationMs: number;
}

export interface ReleaseLockInput {
  key: string;
  lockToken: string;
  markFailed?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface ReleaseResult {
  released: boolean;
  recordDeleted: boolean;
  recordMarkedFailed: boolean;
}

export interface ExtendLockInput {
  key: string;
  lockToken: string;
  extension: number; // milliseconds
}

export interface ExtendResult {
  extended: boolean;
  newExpiresAt: Date;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface IdempotencyError {
  code: IdempotencyErrorCode;
  message: string;
  retriable: boolean;
  retryAfterMs?: number;
  details?: Record<string, unknown>;
}

export class IdempotencyException extends Error {
  constructor(
    public readonly code: IdempotencyErrorCode,
    message: string,
    public readonly retriable: boolean = false,
    public readonly retryAfterMs?: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IdempotencyException';
  }

  toError(): IdempotencyError {
    return {
      code: this.code,
      message: this.message,
      retriable: this.retriable,
      retryAfterMs: this.retryAfterMs,
      details: this.details,
    };
  }
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export type CheckResultType =
  | { success: true; data: CheckResult }
  | { success: false; error: IdempotencyError };

export type RecordResultType =
  | { success: true; data: IdempotencyRecord }
  | { success: false; error: IdempotencyError };

export type LockResultType =
  | { success: true; data: LockResult }
  | { success: false; error: IdempotencyError };

export type CleanupResultType =
  | { success: true; data: CleanupResult }
  | { success: false; error: IdempotencyError };

export type ReleaseResultType =
  | { success: true; data: ReleaseResult }
  | { success: false; error: IdempotencyError };

export type ExtendResultType =
  | { success: true; data: ExtendResult }
  | { success: false; error: IdempotencyError };

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface IdempotencyConfig {
  /** Default TTL for records in milliseconds (default: 24 hours) */
  defaultTtl?: number;
  
  /** Lock timeout in milliseconds (default: 30 seconds) */
  lockTimeout?: number;
  
  /** Maximum response size in bytes (default: 1MB) */
  maxResponseSize?: number;
  
  /** Maximum key length (default: 256) */
  maxKeyLength?: number;
  
  /** Key prefix for namespacing */
  keyPrefix?: string;
  
  /** Headers to include in request fingerprint */
  fingerprintHeaders?: string[];
  
  /** Whether to throw on errors (default: false, returns result objects) */
  throwOnError?: boolean;
}

export const DEFAULT_CONFIG: Required<Omit<IdempotencyConfig, 'keyPrefix' | 'fingerprintHeaders' | 'throwOnError'>> = {
  defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
  lockTimeout: 30 * 1000, // 30 seconds
  maxResponseSize: 1024 * 1024, // 1MB
  maxKeyLength: 256,
};

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

export interface IdempotencyStore {
  /**
   * Check if a record exists and return its current state
   */
  check(input: CheckInput): Promise<CheckResult>;

  /**
   * Start processing - create record and acquire lock
   */
  startProcessing(input: StartProcessingInput): Promise<LockResult>;

  /**
   * Record completion - update record with response
   */
  record(input: RecordInput): Promise<IdempotencyRecord>;

  /**
   * Release lock without recording result
   */
  releaseLock(input: ReleaseLockInput): Promise<ReleaseResult>;

  /**
   * Extend lock timeout
   */
  extendLock(input: ExtendLockInput): Promise<ExtendResult>;

  /**
   * Clean up expired records
   */
  cleanup(input: CleanupInput): Promise<CleanupResult>;

  /**
   * Get a record by key (for debugging/admin)
   */
  get(key: string): Promise<IdempotencyRecord | null>;

  /**
   * Delete a specific record (for testing/admin)
   */
  delete(key: string): Promise<boolean>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Close connections
   */
  close(): Promise<void>;
}

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

export interface IdempotencyMiddlewareOptions {
  /** Store implementation */
  store: IdempotencyStore;
  
  /** Configuration */
  config?: IdempotencyConfig;
  
  /** Function to extract idempotency key from request */
  keyExtractor?: KeyExtractor;
  
  /** Function to compute request hash */
  hashFunction?: HashFunction;
  
  /** Function to serialize response */
  responseSerializer?: ResponseSerializer;
  
  /** Header name for idempotency key (default: 'Idempotency-Key') */
  keyHeader?: string;
  
  /** Paths to apply idempotency to (default: POST, PUT, PATCH) */
  methods?: string[];
  
  /** Path patterns to exclude */
  excludePaths?: (string | RegExp)[];
  
  /** Whether to require idempotency key (default: false) */
  requireKey?: boolean;
  
  /** Callback when returning cached response */
  onReplay?: (key: string, response: unknown) => void;
  
  /** Callback on errors */
  onError?: (error: IdempotencyError, key?: string) => void;
}

export type KeyExtractor = (req: unknown) => string | undefined;
export type HashFunction = (req: unknown) => string;
export type ResponseSerializer = (res: unknown) => string;

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface SerializedResponse {
  body: string;
  statusCode: number;
  contentType: string;
  headers?: Record<string, string>;
}
