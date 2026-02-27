/**
 * Errors for idempotency operations
 */

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
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  KEY_REQUIRED = 'KEY_REQUIRED'
}

export class IdempotencyError extends Error {
  constructor(
    public code: IdempotencyErrorCode,
    message: string,
    public retriable: boolean = false,
    public retryAfterMs?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'IdempotencyError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retriable: this.retriable,
      retryAfterMs: this.retryAfterMs,
      details: this.details
    };
  }
}

export function createIdempotencyError(
  code: IdempotencyErrorCode,
  message?: string,
  details?: Record<string, any>
): IdempotencyError {
  const messages: Record<IdempotencyErrorCode, string> = {
    [IdempotencyErrorCode.KEY_TOO_LONG]: 'Idempotency key exceeds maximum length',
    [IdempotencyErrorCode.INVALID_KEY_FORMAT]: 'Idempotency key has invalid format',
    [IdempotencyErrorCode.REQUEST_MISMATCH]: 'Request hash does not match stored record',
    [IdempotencyErrorCode.LOCK_ACQUISITION_FAILED]: 'Failed to acquire lock for processing',
    [IdempotencyErrorCode.RECORD_NOT_FOUND]: 'Idempotency record not found',
    [IdempotencyErrorCode.STORAGE_ERROR]: 'Storage operation failed',
    [IdempotencyErrorCode.SERIALIZATION_ERROR]: 'Failed to serialize/deserialize data',
    [IdempotencyErrorCode.TTL_EXCEEDED]: 'Record TTL exceeded',
    [IdempotencyErrorCode.CONCURRENT_REQUEST]: 'Request already being processed',
    [IdempotencyErrorCode.INVALID_RESPONSE]: 'Invalid response format',
    [IdempotencyErrorCode.KEY_REQUIRED]: 'Idempotency key is required'
  };

  const retriableCodes = new Set([
    IdempotencyErrorCode.LOCK_ACQUISITION_FAILED,
    IdempotencyErrorCode.STORAGE_ERROR,
    IdempotencyErrorCode.CONCURRENT_REQUEST
  ]);

  return new IdempotencyError(
    code,
    message || messages[code],
    retriableCodes.has(code),
    undefined,
    details
  );
}
