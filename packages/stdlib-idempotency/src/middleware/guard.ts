import { Clock, StorageAdapter, CheckResult, LockResult } from '../types';
import { KeyEntry } from '../key/entry';
import { RequestContext, GuardOptions, MiddlewareResult, IdempotencyContext } from './types';
import { createIdempotencyError, IdempotencyErrorCode } from '../errors';

export class IdempotencyGuard {
  constructor(
    private storage: StorageAdapter,
    private clock: Clock,
    private keyEntry: KeyEntry,
    private options: GuardOptions = {}
  ) {}

  /**
   * Process a request for idempotency
   */
  async process(request: RequestContext): Promise<MiddlewareResult> {
    const headerName = this.options.headerName || 'Idempotency-Key';
    const queryParam = this.options.queryParam || 'idempotency_key';
    const keySource = this.options.keySource || 'header';
    const required = this.options.required ?? true;
    const safeMethods = this.options.safeMethods || ['GET', 'HEAD', 'OPTIONS'];

    // Skip idempotency for safe methods
    if (safeMethods.includes(request.method.toUpperCase())) {
      return {
        continue: true,
        idempotency: {
          key: '',
          isReplay: false
        }
      };
    }

    // Extract idempotency key
    let key: string | undefined;
    
    if (keySource === 'header' || keySource === 'both') {
      key = request.headers[headerName.toLowerCase()] || 
            request.headers[headerName];
    }
    
    if (!key && (keySource === 'query' || keySource === 'both')) {
      const url = new URL(request.url, 'http://localhost');
      key = url.searchParams.get(queryParam) || undefined;
    }

    // Generate key if missing and generator provided
    if (!key && this.options.generateKey) {
      key = this.options.generateKey();
    }

    // Check if key is required
    if (!key && required) {
      return {
        continue: false,
        response: {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error: 'Idempotency-Key header is required'
          })
        },
        idempotency: {
          key: '',
          isReplay: false
        }
      };
    }

    // If no key and not required, continue without idempotency
    if (!key) {
      return {
        continue: true,
        idempotency: {
          key: '',
          isReplay: false
        }
      };
    }

    // Validate key
    try {
      this.keyEntry.validate(key);
    } catch (error) {
      return {
        continue: false,
        response: {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error: error instanceof Error ? error.message : 'Invalid idempotency key'
          })
        },
        idempotency: {
          key,
          isReplay: false
        }
      };
    }

    // Check existing record
    const checkResult = await this.checkKey(key, request);
    
    if (checkResult.found) {
      // Handle replay
      if (checkResult.status === 'PROCESSING') {
        return {
          continue: false,
          response: {
            statusCode: 409,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '5'
            },
            body: JSON.stringify({
              error: 'Request already being processed'
            })
          },
          idempotency: {
            key,
            isReplay: true
          }
        };
      }

      if (checkResult.status === 'COMPLETED' && checkResult.response) {
        return {
          continue: false,
          response: {
            statusCode: checkResult.httpStatusCode || 200,
            headers: {
              'Content-Type': checkResult.contentType || 'application/json',
              'X-Idempotency-Replayed': 'true'
            },
            body: checkResult.response
          },
          idempotency: {
            key,
            isReplay: true,
            record: checkResult
          }
        };
      }
    }

    // Try to acquire lock
    const lockResult = await this.acquireLock(key);
    
    if (!lockResult.acquired) {
      return {
        continue: false,
        response: {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '1'
          },
          body: JSON.stringify({
            error: 'Concurrent request in progress'
          })
        },
        idempotency: {
          key,
          isReplay: false
        }
      };
    }

    // Continue with processing
    return {
      continue: true,
      idempotency: {
        key,
        isReplay: false,
        lockToken: lockResult.lockToken
      }
    };
  }

  /**
   * Check if key exists and return result
   */
  private async checkKey(key: string, request: RequestContext): Promise<CheckResult> {
    const record = await this.storage.get(key);
    
    if (!record) {
      return {
        found: false,
        requestMismatch: false
      };
    }

    const requestHash = this.keyEntry.createRequestHash({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body
    });

    const requestMismatch = !this.keyEntry.requestMatches(record, requestHash);

    return {
      found: true,
      status: record.status,
      response: record.response,
      httpStatusCode: record.httpStatusCode,
      contentType: record.contentType,
      requestMismatch,
      createdAt: record.createdAt,
      completedAt: record.completedAt
    };
  }

  /**
   * Acquire lock for processing
   */
  private async acquireLock(key: string): Promise<LockResult> {
    const lockToken = this.generateLockToken();
    const lockExpiresAt = new Date(this.clock.now().getTime() + 30000); // 30 seconds

    const acquired = await this.storage.acquireLock(key, lockToken, lockExpiresAt);

    if (acquired) {
      return {
        acquired: true,
        lockToken,
        lockExpiresAt
      };
    }

    // Check existing status
    const record = await this.storage.get(key);
    
    return {
      acquired: false,
      existingStatus: record?.status,
      existingResponse: record?.response
    };
  }

  /**
   * Generate a lock token
   */
  private generateLockToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
