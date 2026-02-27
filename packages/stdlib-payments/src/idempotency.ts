/**
 * Idempotency manager for payment operations
 * @packageDocumentation
 */

import { IdempotencyError } from './errors';
import * as crypto from 'crypto';

// ============================================================================
// IDEMPOTENCY RECORD TYPES
// ============================================================================

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  response: string;
  paymentId?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IdempotencyOptions {
  ttl?: number; // Time to live in seconds (default: 24 hours)
  maxRecords?: number; // Maximum records to keep (default: 10000)
}

// ============================================================================
// IDEMPOTENCY MANAGER
// ============================================================================

export class IdempotencyManager {
  private records = new Map<string, IdempotencyRecord>();
  private options: Required<IdempotencyOptions>;

  constructor(options: IdempotencyOptions = {}) {
    this.options = {
      ttl: options.ttl || 24 * 60 * 60, // 24 hours
      maxRecords: options.maxRecords || 10000,
    };
  }

  /**
   * Check if an idempotency key exists and return the stored response
   */
  async check(key: string): Promise<IdempotencyRecord['response'] | null> {
    // Clean up expired records
    this.cleanup();

    const record = this.records.get(key);
    
    if (!record) {
      return null;
    }

    // Check if record has expired
    if (new Date() > record.expiresAt) {
      this.records.delete(key);
      return null;
    }

    return record.response;
  }

  /**
   * Store a response for an idempotency key
   */
  async store(
    key: string,
    data: {
      request: string;
      response: string;
      paymentId?: string;
    }
  ): Promise<void> {
    // Validate key format
    if (!this.isValidKey(key)) {
      throw IdempotencyError.keyInvalid(key);
    }

    // Check if key already exists
    if (this.records.has(key)) {
      throw IdempotencyError.keyAlreadyUsed(key);
    }

    // Clean up if we have too many records
    if (this.records.size >= this.options.maxRecords) {
      this.evictOldest();
    }

    // Create record
    const record: IdempotencyRecord = {
      key,
      requestHash: this.hash(data.request),
      response: data.response,
      paymentId: data.paymentId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.options.ttl * 1000),
    };

    this.records.set(key, record);
  }

  /**
   * Delete an idempotency record
   */
  async delete(key: string): Promise<void> {
    this.records.delete(key);
  }

  /**
   * Get all records (for debugging)
   */
  getAllRecords(): IdempotencyRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Clear all records
   */
  clear(): void {
    this.records.clear();
  }

  /**
   * Generate a new idempotency key
   */
  generateKey(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate idempotency key format
   */
  isValidKey(key: string): boolean {
    // Keys should be UUID v4 format or similar
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(key) || key.length >= 8 && key.length <= 255;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Hash request data for comparison
   */
  private hash(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Clean up expired records
   */
  private cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, record] of this.records.entries()) {
      if (now > record.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.records.delete(key);
    }
  }

  /**
   * Evict oldest records when limit is reached
   */
  private evictOldest(): void {
    const entries = Array.from(this.records.entries());
    
    // Sort by creation time
    entries.sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
    
    // Remove oldest 25% of records
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.records.delete(entries[i][0]);
    }
  }
}

// ============================================================================
// IDEMPOTENCY MIDDLEWARE
// ============================================================================

export interface IdempotencyMiddlewareOptions {
  getKeyFromRequest?: (request: any) => string | null;
  excludePaths?: string[];
  generateKeyIfMissing?: boolean;
}

export class IdempotencyMiddleware {
  constructor(
    private idempotency: IdempotencyManager,
    private options: IdempotencyMiddlewareOptions = {}
  ) {}

  /**
   * Express middleware for idempotency
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      try {
        // Skip if path is excluded
        if (this.options.excludePaths?.includes(req.path)) {
          return next();
        }

        // Get idempotency key
        let key = this.getIdempotencyKey(req);
        
        // Generate key if missing and option is enabled
        if (!key && this.options.generateKeyIfMissing) {
          key = this.idempotency.generateKey();
          res.setHeader('Idempotency-Key', key);
        }

        if (!key) {
          return next();
        }

        // Check for existing response
        const existing = await this.idempotency.check(key);
        
        if (existing) {
          const response = JSON.parse(existing);
          return res.status(response.status || 200).json(response.data);
        }

        // Store original res.json to intercept response
        const originalJson = res.json;
        const originalStatus = res.status;
        let responseData: any;
        let statusCode: number = 200;

        res.json = (data: any) => {
          responseData = data;
          return originalJson.call(res, data);
        };

        res.status = (code: number) => {
          statusCode = code;
          return originalStatus.call(res, code);
        };

        // Store response after it's sent
        res.on('finish', async () => {
          if (key && responseData) {
            try {
              await this.idempotency.store(key, {
                request: JSON.stringify({
                  method: req.method,
                  url: req.url,
                  headers: req.headers,
                  body: req.body,
                }),
                response: JSON.stringify({
                  status: statusCode,
                  data: responseData,
                }),
              });
            } catch (error) {
              // Log error but don't fail the request
              console.error('Failed to store idempotency record:', error);
            }
          }
        });

        next();

      } catch (error) {
        if (error instanceof IdempotencyError) {
          return res.status(400).json({
            error: error.message,
            code: error.code,
          });
        }
        next(error);
      }
    };
  }

  /**
   * Get idempotency key from request
   */
  private getIdempotencyKey(req: any): string | null {
    // Try custom getter first
    if (this.options.getKeyFromRequest) {
      const key = this.options.getKeyFromRequest(req);
      if (key) return key;
    }

    // Try standard headers
    const key = req.headers['idempotency-key'] || 
               req.headers['Idempotency-Key'] ||
               req.headers['x-idempotency-key'];
    
    return key || null;
  }
}

// ============================================================================
// DECORATOR FOR IDEMPOTENCY (TypeScript)
// ============================================================================

export function Idempotent(options: {
  keyGenerator?: (...args: any[]) => string;
  ttl?: number;
} = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const idempotency = new IdempotencyManager({ ttl: options.ttl });

    descriptor.value = async function (...args: any[]) {
      // Generate key
      const key = options.keyGenerator 
        ? options.keyGenerator(...args)
        : JSON.stringify({ propertyName, args });

      // Check existing
      const existing = await idempotency.check(key);
      if (existing) {
        return JSON.parse(existing);
      }

      // Execute method
      const result = await method.apply(this, args);

      // Store result
      await idempotency.store(key, {
        request: JSON.stringify({ propertyName, args }),
        response: JSON.stringify(result),
      });

      return result;
    };
  };
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createIdempotencyManager(options?: IdempotencyOptions): IdempotencyManager {
  return new IdempotencyManager(options);
}

export function createIdempotencyMiddleware(
  idempotency: IdempotencyManager,
  options?: IdempotencyMiddlewareOptions
): IdempotencyMiddleware {
  return new IdempotencyMiddleware(idempotency, options);
}
