import { createHash } from 'crypto';
import { IdempotencyRecord, RecordStatus, FingerprintOptions } from '../types';
import { KeyValidatorOptions } from './types';
import { createIdempotencyError, IdempotencyErrorCode } from '../errors';

export class KeyEntry {
  constructor(private validatorOptions: KeyValidatorOptions = {}) {}

  /**
   * Validate an idempotency key format
   */
  validate(key: string): void {
    const maxLength = this.validatorOptions.maxLength || 256;
    const minLength = this.validatorOptions.minLength || 1;
    const pattern = this.validatorOptions.pattern || /^[a-zA-Z0-9_\-:.]+$/;

    if (key.length > maxLength) {
      throw createIdempotencyError(
        IdempotencyErrorCode.KEY_TOO_LONG,
        `Key length ${key.length} exceeds maximum ${maxLength}`
      );
    }

    if (key.length < minLength) {
      throw createIdempotencyError(
        IdempotencyErrorCode.INVALID_KEY_FORMAT,
        `Key length ${key.length} below minimum ${minLength}`
      );
    }

    if (!pattern.test(key)) {
      throw createIdempotencyError(
        IdempotencyErrorCode.INVALID_KEY_FORMAT,
        'Key contains invalid characters'
      );
    }
  }

  /**
   * Create a request hash from fingerprint data
   */
  createRequestHash(options: FingerprintOptions): string {
    const { method = '', url = '', headers = {}, body = '' } = options;
    
    // Create canonical representation
    const canonical = [
      method.toUpperCase(),
      url,
      this.canonicalizeHeaders(headers),
      body
    ].join('\n');

    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Canonicalize headers (sort keys, trim values)
   */
  private canonicalizeHeaders(headers: Record<string, string>): string {
    const sorted = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n');
    
    return sorted;
  }

  /**
   * Check if request matches stored record
   */
  requestMatches(record: IdempotencyRecord, requestHash: string): boolean {
    return record.requestHash === requestHash;
  }

  /**
   * Create a new idempotency record
   */
  createRecord(
    key: string,
    requestHash: string,
    ttl: number,
    now: Date,
    metadata?: {
      clientId?: string;
      endpoint?: string;
      method?: string;
    }
  ): IdempotencyRecord {
    const expiresAt = new Date(now.getTime() + ttl);
    
    return {
      key,
      requestHash,
      status: RecordStatus.PROCESSING,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      ...metadata
    };
  }

  /**
   * Mark record as completed
   */
  markCompleted(
    record: IdempotencyRecord,
    response: string,
    httpStatusCode?: number,
    contentType?: string,
    completedAt?: Date
  ): IdempotencyRecord {
    return {
      ...record,
      status: RecordStatus.COMPLETED,
      response,
      httpStatusCode,
      contentType,
      completedAt: completedAt || new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Mark record as failed
   */
  markFailed(
    record: IdempotencyRecord,
    errorCode: string,
    errorMessage: string,
    completedAt?: Date
  ): IdempotencyRecord {
    return {
      ...record,
      status: RecordStatus.FAILED,
      errorCode,
      errorMessage,
      completedAt: completedAt || new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Check if a record can be retried
   */
  canRetry(record: IdempotencyRecord): boolean {
    return record.status === RecordStatus.FAILED || 
           (record.status === RecordStatus.PROCESSING && 
            record.lockExpiresAt && 
            new Date() > record.lockExpiresAt);
  }
}
