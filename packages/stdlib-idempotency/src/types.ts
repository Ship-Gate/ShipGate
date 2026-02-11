/**
 * Core types for idempotency key management
 */

export interface IdempotencyConfig {
  /** Default TTL for idempotency records */
  defaultTtl: number;
  /** Lock timeout to prevent concurrent processing */
  lockTimeout: number;
  /** Maximum request hash size */
  maxRequestHashSize: number;
  /** Headers to include in request fingerprinting */
  fingerprintHeaders?: string[];
  /** Optional key prefix */
  keyPrefix?: string;
}

export enum RecordStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  response?: string;
  status: RecordStatus;
  httpStatusCode?: number;
  contentType?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  clientId?: string;
  endpoint?: string;
  method?: string;
  lockToken?: string;
  lockExpiresAt?: Date;
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

export interface LockResult {
  acquired: boolean;
  lockToken?: string;
  existingStatus?: RecordStatus;
  existingResponse?: string;
  lockExpiresAt?: Date;
}

export interface Clock {
  now(): Date;
}

export interface Random {
  uuid(): string;
  bytes(length: number): Uint8Array;
}

export interface StorageAdapter {
  get(key: string): Promise<IdempotencyRecord | null>;
  create(record: IdempotencyRecord): Promise<void>;
  update(key: string, updates: Partial<IdempotencyRecord>): Promise<void>;
  delete(key: string): Promise<void>;
  acquireLock(key: string, lockToken: string, expiresAt: Date): Promise<boolean>;
  releaseLock(key: string, lockToken: string): Promise<boolean>;
}

export interface FingerprintOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface MiddlewareOptions {
  /** Header name to read idempotency key from */
  headerName?: string;
  /** Source of key: 'header', 'query', or 'both' */
  keySource?: 'header' | 'query' | 'both';
  /** Query parameter name for idempotency key */
  queryParam?: string;
  /** Whether to require idempotency key */
  required?: boolean;
  /** Custom key generator if none provided */
  generateKey?: () => string;
}
