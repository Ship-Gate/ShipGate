import { Random } from '../types';
import { KeyGeneratorOptions } from './types';
import { createIdempotencyError, IdempotencyErrorCode } from '../errors';

export class KeyGenerator {
  constructor(
    private random: Random,
    private options: KeyGeneratorOptions = {}
  ) {}

  /**
   * Generate a UUID v4 idempotency key
   */
  uuid(): string {
    const key = this.random.uuid();
    return this.options.prefix ? `${this.options.prefix}${key}` : key;
  }

  /**
   * Generate a random string key
   */
  random(length?: number): string {
    const len = length || this.options.length || 32;
    const bytes = this.random.bytes(len);
    const encoding = this.options.encoding || 'hex';
    
    let key: string;
    switch (encoding) {
      case 'hex':
        key = Buffer.from(bytes).toString('hex').substring(0, len);
        break;
      case 'base64':
        key = Buffer.from(bytes).toString('base64url').substring(0, len);
        break;
      case 'base64url':
        key = Buffer.from(bytes).toString('base64url').substring(0, len);
        break;
      default:
        throw createIdempotencyError(
          IdempotencyErrorCode.INVALID_KEY_FORMAT,
          `Unsupported encoding: ${encoding}`
        );
    }

    return this.options.prefix ? `${this.options.prefix}${key}` : key;
  }

  /**
   * Generate a deterministic key from request data
   */
  deterministic(data: string): string {
    // Simple hash-based deterministic key
    // In production, use a proper hash function
    let hash = 5381;
    for (let i = 0; i < data.length; i++) {
      hash = (hash * 33) ^ data.charCodeAt(i);
    }
    const key = Math.abs(hash).toString(16);
    return this.options.prefix ? `${this.options.prefix}${key}` : key;
  }

  /**
   * Generate a timestamp-based key
   */
  timestamp(): string {
    const now = Date.now();
    const random = this.random.bytes(8);
    const randomStr = Buffer.from(random).toString('hex').substring(0, 8);
    const key = `${now}-${randomStr}`;
    return this.options.prefix ? `${this.options.prefix}${key}` : key;
  }
}
