// ============================================================================
// ISL Standard Library - Idempotency Utilities
// @stdlib/idempotency/utils
// ============================================================================

import { createHash, randomUUID } from 'crypto';
import {
  IdempotencyKey,
  RequestHash,
  LockToken,
  IdempotencyErrorCode,
  IdempotencyException,
  DEFAULT_CONFIG,
} from './types';

// ============================================================================
// KEY VALIDATION
// ============================================================================

const KEY_PATTERN = /^[a-zA-Z0-9_\-:.]+$/;

/**
 * Validate an idempotency key
 */
export function validateKey(
  key: string,
  maxLength: number = DEFAULT_CONFIG.maxKeyLength
): IdempotencyKey {
  if (!key || key.length === 0) {
    throw new IdempotencyException(
      IdempotencyErrorCode.INVALID_KEY_FORMAT,
      'Idempotency key cannot be empty'
    );
  }

  if (key.length > maxLength) {
    throw new IdempotencyException(
      IdempotencyErrorCode.KEY_TOO_LONG,
      `Idempotency key exceeds maximum length of ${maxLength}`,
      false,
      undefined,
      { keyLength: key.length, maxLength }
    );
  }

  if (!KEY_PATTERN.test(key)) {
    throw new IdempotencyException(
      IdempotencyErrorCode.INVALID_KEY_FORMAT,
      'Idempotency key contains invalid characters. Allowed: alphanumeric, underscore, hyphen, colon, period',
      false,
      undefined,
      { key }
    );
  }

  return key as IdempotencyKey;
}

/**
 * Apply prefix to key
 */
export function prefixKey(key: string, prefix?: string): string {
  return prefix ? `${prefix}:${key}` : key;
}

/**
 * Remove prefix from key
 */
export function unprefixKey(key: string, prefix?: string): string {
  if (!prefix) return key;
  const prefixWithColon = `${prefix}:`;
  return key.startsWith(prefixWithColon)
    ? key.slice(prefixWithColon.length)
    : key;
}

// ============================================================================
// HASHING
// ============================================================================

/**
 * Compute SHA-256 hash of request data
 */
export function computeRequestHash(data: unknown): RequestHash {
  const canonical = canonicalize(data) ?? '';
  const hash = createHash('sha256').update(canonical).digest('hex');
  return hash as RequestHash;
}

/**
 * Compute hash from HTTP request components
 */
export function computeHttpRequestHash(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
  fingerprintHeaders?: string[]
): RequestHash {
  const components: unknown[] = [method.toUpperCase(), path];

  // Include specified headers in fingerprint
  if (headers && fingerprintHeaders) {
    const headerValues: Record<string, string> = {};
    for (const header of fingerprintHeaders) {
      const value = headers[header.toLowerCase()];
      if (value !== undefined) {
        headerValues[header.toLowerCase()] = value;
      }
    }
    if (Object.keys(headerValues).length > 0) {
      components.push(headerValues);
    }
  }

  // Include body
  if (body !== undefined && body !== null) {
    components.push(body);
  }

  return computeRequestHash(components);
}

/**
 * Canonicalize data for hashing (deterministic JSON)
 */
export function canonicalize(data: unknown): string {
  return JSON.stringify(sortKeys(data));
}

/**
 * Recursively sort object keys for deterministic serialization
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return obj;
}

// ============================================================================
// LOCK TOKENS
// ============================================================================

/**
 * Generate a unique lock token
 */
export function generateLockToken(): LockToken {
  return `lock_${randomUUID().replace(/-/g, '')}` as LockToken;
}

/**
 * Validate a lock token format
 */
export function isValidLockToken(token: string): token is LockToken {
  return token.startsWith('lock_') && token.length === 37;
}

// ============================================================================
// TTL UTILITIES
// ============================================================================

/**
 * Calculate expiration timestamp
 */
export function calculateExpiration(ttlMs: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + ttlMs);
}

/**
 * Check if a timestamp is expired
 */
export function isExpired(expiresAt: Date | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

/**
 * Calculate remaining TTL in milliseconds
 */
export function remainingTtl(expiresAt: Date, now: Date = new Date()): number {
  return Math.max(0, expiresAt.getTime() - now.getTime());
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize a response for storage
 */
export function serializeResponse(
  body: unknown,
  statusCode: number,
  contentType: string = 'application/json',
  headers?: Record<string, string>
): string {
  const serialized = {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    statusCode,
    contentType,
    headers,
  };
  return JSON.stringify(serialized);
}

/**
 * Deserialize a stored response
 */
export function deserializeResponse(serialized: string): {
  body: string;
  statusCode: number;
  contentType: string;
  headers?: Record<string, string>;
} {
  try {
    const parsed = JSON.parse(serialized);
    // Check if it's a properly serialized response (has body and statusCode)
    if (parsed && typeof parsed === 'object' && 'body' in parsed && 'statusCode' in parsed) {
      return parsed;
    }
    // Legacy format - parsed successfully but not a serialized response
    return {
      body: serialized,
      statusCode: 200,
      contentType: 'application/json',
    };
  } catch {
    // Legacy format - just the body
    return {
      body: serialized,
      statusCode: 200,
      contentType: 'application/json',
    };
  }
}

/**
 * Parse serialized body based on content type
 */
export function parseResponseBody(
  body: string,
  contentType: string
): unknown {
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

// ============================================================================
// SIZE UTILITIES
// ============================================================================

/**
 * Calculate byte size of a string
 */
export function byteSize(str: string): number {
  return Buffer.byteLength(str, 'utf8');
}

/**
 * Validate response size
 */
export function validateResponseSize(
  response: string,
  maxSize: number = DEFAULT_CONFIG.maxResponseSize
): void {
  const size = byteSize(response);
  if (size > maxSize) {
    throw new IdempotencyException(
      IdempotencyErrorCode.RESPONSE_TOO_LARGE,
      `Response size (${size} bytes) exceeds maximum allowed (${maxSize} bytes)`,
      false,
      undefined,
      { responseSize: size, maxSize }
    );
  }
}

// ============================================================================
// RETRY UTILITIES
// ============================================================================

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number = 100,
  maxDelayMs: number = 10000,
  jitter: boolean = true
): number {
  const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  
  if (jitter) {
    // Add random jitter between 0-50% of the delay
    const jitterFactor = 1 + Math.random() * 0.5;
    return Math.floor(exponentialDelay * jitterFactor);
  }
  
  return exponentialDelay;
}

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate an idempotency key from components
 */
export function generateIdempotencyKey(
  ...components: (string | number | undefined)[]
): IdempotencyKey {
  const filtered = components.filter((c) => c !== undefined);
  const key = filtered.join(':');
  return validateKey(key);
}

/**
 * Generate a deterministic key from request properties
 */
export function generateDeterministicKey(
  clientId: string,
  operation: string,
  resourceId?: string,
  timestamp?: Date
): IdempotencyKey {
  const components = [clientId, operation];
  
  if (resourceId) {
    components.push(resourceId);
  }
  
  if (timestamp) {
    // Round to nearest minute for collision
    const rounded = new Date(Math.floor(timestamp.getTime() / 60000) * 60000);
    components.push(rounded.toISOString().replace(/[:.]/g, '-'));
  }
  
  return validateKey(components.join(':'));
}

// ============================================================================
// ERROR HELPERS
// ============================================================================

/**
 * Wrap an error in IdempotencyException
 */
export function wrapError(
  error: unknown,
  code: IdempotencyErrorCode = IdempotencyErrorCode.STORAGE_ERROR
): IdempotencyException {
  if (error instanceof IdempotencyException) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new IdempotencyException(
    code,
    message,
    code === IdempotencyErrorCode.STORAGE_ERROR,
    undefined,
    { originalError: message }
  );
}

/**
 * Check if an error is retriable
 */
export function isRetriableError(error: unknown): boolean {
  if (error instanceof IdempotencyException) {
    return error.retriable;
  }
  
  // Network and timeout errors are typically retriable
  if (error instanceof Error) {
    const retriablePatterns = [
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /ECONNRESET/,
      /socket hang up/i,
      /timeout/i,
    ];
    return retriablePatterns.some((pattern) => pattern.test(error.message));
  }
  
  return false;
}
