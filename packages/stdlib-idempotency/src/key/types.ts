/**
 * Types for key management
 */

export interface KeyGeneratorOptions {
  /** Prefix to add to generated keys */
  prefix?: string;
  /** Length of random component (for non-UUID keys) */
  length?: number;
  /** Encoding for random bytes */
  encoding?: 'hex' | 'base64' | 'base64url';
}

export interface KeyValidatorOptions {
  /** Maximum key length */
  maxLength?: number;
  /** Minimum key length */
  minLength?: number;
  /** Regex pattern for validation */
  pattern?: RegExp;
}

export interface KeyEntry {
  key: string;
  hash: string;
  exists: boolean;
  record?: any;
}

export interface StoreOptions {
  /** Default TTL for records */
  defaultTtl: number;
  /** Cleanup interval for expired records */
  cleanupInterval?: number;
  /** Maximum number of records */
  maxRecords?: number;
}
