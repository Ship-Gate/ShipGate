import { StorageAdapter, Clock, IdempotencyConfig } from '../types';
import { KeyEntry } from '../key/entry';
import { IdempotencyGuard } from './guard';
import { RequestContext, ResponseContext, GuardOptions } from './types';
import { createIdempotencyError, IdempotencyErrorCode } from '../errors';

export class HttpIdempotencyMiddleware {
  private guard: IdempotencyGuard;

  constructor(
    storage: StorageAdapter,
    clock: Clock,
    config: IdempotencyConfig,
    options: GuardOptions = {}
  ) {
    const keyEntry = new KeyEntry({
      maxLength: 256,
      minLength: 1,
      pattern: /^[a-zA-Z0-9_\-:.]+$/
    });

    this.guard = new IdempotencyGuard(storage, clock, keyEntry, {
      headerName: 'Idempotency-Key',
      queryParam: 'idempotency_key',
      keySource: 'header',
      required: true,
      safeMethods: ['GET', 'HEAD', 'OPTIONS'],
      ...options
    });
  }

  /**
   * Create Express middleware
   */
  express() {
    return async (req: any, res: any, next: any) => {
      try {
        const request: RequestContext = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body ? JSON.stringify(req.body) : undefined,
          clientId: req.headers['x-client-id']
        };

        const result = await this.guard.process(request);

        // If not continuing, send response
        if (!result.continue && result.response) {
          res.status(result.response.statusCode);
          
          // Set headers
          for (const [key, value] of Object.entries(result.response.headers)) {
            res.set(key, value);
          }
          
          // Send body
          if (result.response.body) {
            res.send(result.response.body);
          } else {
            res.end();
          }
          return;
        }

        // Store idempotency context on request
        req.idempotency = result.idempotency;

        // Intercept response
        const originalSend = res.send;
        const originalJson = res.json;
        const originalStatus = res.status;

        let statusCode = 200;
        let responseBody: any;

        res.status = function(code: number) {
          statusCode = code;
          return originalStatus.call(this, code);
        };

        res.json = function(obj: any) {
          responseBody = JSON.stringify(obj);
          return originalJson.call(this, obj);
        };

        res.send = function(body: any) {
          responseBody = body;
          return originalSend.call(this, body);
        };

        // Handle response finish
        res.on('finish', async () => {
          if (req.idempotency?.key && !req.idempotency.isReplay) {
            await this.recordCompletion(
              req.idempotency.key,
              responseBody || '',
              statusCode,
              res.get('Content-Type') || 'application/json',
              req.idempotency.lockToken
            );
          }
        });

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Create Fastify plugin
   */
  fastify() {
    return async (fastify: any, options: any) => {
      fastify.addHook('preHandler', async (request: any, reply: any) => {
        const req: RequestContext = {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body ? JSON.stringify(request.body) : undefined,
          clientId: request.headers['x-client-id']
        };

        const result = await this.guard.process(req);

        // Store idempotency context
        request.idempotency = result.idempotency;

        if (!result.continue && result.response) {
          reply.status(result.response.statusCode);
          
          for (const [key, value] of Object.entries(result.response.headers)) {
            reply.header(key, value);
          }
          
          if (result.response.body) {
            reply.send(result.response.body);
          } else {
            reply.send();
          }
          return reply;
        }
      });

      fastify.addHook('onSend', async (request: any, reply: any, payload: any) => {
        if (request.idempotency?.key && !request.idempotency.isReplay) {
          await this.recordCompletion(
            request.idempotency.key,
            typeof payload === 'string' ? payload : JSON.stringify(payload || ''),
            reply.statusCode,
            reply.getHeader('content-type') || 'application/json',
            request.idempotency.lockToken
          );
        }
        
        return payload;
      });
    };
  }

  /**
   * Record successful completion
   */
  private async recordCompletion(
    key: string,
    response: string,
    statusCode: number,
    contentType: string,
    lockToken?: string
  ): Promise<void> {
    try {
      const record = await this.guard['storage'].get(key);
      if (!record) return;

      const updated = this.guard['keyEntry'].markCompleted(
        record,
        response,
        statusCode,
        contentType
      );

      await this.guard['storage'].update(key, updated);

      if (lockToken) {
        await this.guard['storage'].releaseLock(key, lockToken);
      }
    } catch (error) {
      // Log error but don't fail the request
      console.error('Failed to record idempotency completion:', error);
    }
  }

  /**
   * Record error completion
   */
  async recordError(
    key: string,
    error: Error,
    lockToken?: string
  ): Promise<void> {
    try {
      const record = await this.guard['storage'].get(key);
      if (!record) return;

      const updated = this.guard['keyEntry'].markFailed(
        record,
        error.constructor.name,
        error.message
      );

      await this.guard['storage'].update(key, updated);

      if (lockToken) {
        await this.guard['storage'].releaseLock(key, lockToken);
      }
    } catch (err) {
      console.error('Failed to record idempotency error:', err);
    }
  }
}
