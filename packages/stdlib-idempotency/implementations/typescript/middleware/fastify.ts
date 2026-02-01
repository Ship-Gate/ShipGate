// ============================================================================
// ISL Standard Library - Fastify Idempotency Plugin
// @stdlib/idempotency/middleware/fastify
// ============================================================================

import {
  IdempotencyStore,
  IdempotencyMiddlewareOptions,
  RecordStatus,
  IdempotencyErrorCode,
  IdempotencyException,
  LockToken,
} from '../types';
import {
  computeHttpRequestHash,
  serializeResponse,
  deserializeResponse,
} from '../utils';

// Fastify types
export interface FastifyRequest {
  method: string;
  url: string;
  routeOptions?: { url?: string };
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  id: string;
}

export interface FastifyReply {
  statusCode: number;
  code(statusCode: number): FastifyReply;
  header(name: string, value: string): FastifyReply;
  headers(headers: Record<string, string>): FastifyReply;
  getHeader(name: string): string | undefined;
  send(payload?: unknown): FastifyReply;
  sent: boolean;
}

export interface FastifyInstance {
  addHook(
    name: 'onRequest' | 'preHandler' | 'onSend' | 'onResponse' | 'onError',
    hook: (
      request: FastifyRequest,
      reply: FastifyReply,
      payload?: unknown
    ) => Promise<void | unknown>
  ): void;
  decorateRequest(name: string, value: unknown): void;
  decorateReply(name: string, value: unknown): void;
}

export interface FastifyPluginOptions extends IdempotencyMiddlewareOptions {
  /** Header name for idempotency key (default: 'idempotency-key') */
  keyHeader?: string;
  
  /** Header to indicate replayed response */
  replayHeader?: string;
  
  /** HTTP methods to apply idempotency (default: ['POST', 'PUT', 'PATCH']) */
  methods?: string[];
  
  /** Route prefixes to exclude */
  excludePaths?: (string | RegExp)[];
  
  /** Require idempotency key */
  requireKey?: boolean;
  
  /** Custom key extractor */
  keyExtractor?: (request: FastifyRequest) => string | undefined;
  
  /** Custom hash function */
  hashFunction?: (request: FastifyRequest) => string;
  
  /** Handle concurrent requests */
  concurrentRequestHandling?: 'wait' | 'reject';
  
  /** Max wait time for concurrent requests */
  maxWaitTime?: number;
  
  /** Retry interval for waiting */
  retryInterval?: number;
}

// Extend FastifyRequest with our properties
declare module 'fastify' {
  interface FastifyRequest {
    idempotencyKey?: string;
    idempotencyLockToken?: LockToken;
    idempotencyRequestHash?: string;
    idempotencyReplayed?: boolean;
  }
}

interface IdempotencyContext {
  key: string;
  lockToken: LockToken;
  requestHash: string;
}

const DEFAULT_OPTIONS = {
  keyHeader: 'idempotency-key',
  replayHeader: 'idempotency-replayed',
  methods: ['POST', 'PUT', 'PATCH'],
  requireKey: false,
  concurrentRequestHandling: 'reject' as const,
  maxWaitTime: 30000,
  retryInterval: 100,
};

/**
 * Fastify plugin for idempotent request handling
 * 
 * Usage:
 * ```typescript
 * import Fastify from 'fastify';
 * import { idempotencyPlugin } from '@intentos/stdlib-idempotency/middleware/fastify';
 * import { createMemoryStore } from '@intentos/stdlib-idempotency/store/memory';
 * 
 * const fastify = Fastify();
 * const store = createMemoryStore();
 * 
 * fastify.register(idempotencyPlugin, { store });
 * 
 * fastify.post('/payments', async (request, reply) => {
 *   const payment = await processPayment(request.body);
 *   return reply.code(201).send(payment);
 * });
 * ```
 */
export async function idempotencyPlugin(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  const store = options.store;
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
    excludePaths: options.excludePaths ?? [],
    fingerprintHeaders: options.config?.fingerprintHeaders ?? [],
  };

  // Store for tracking request context
  const requestContexts = new Map<string, IdempotencyContext>();

  // Decorate request
  fastify.decorateRequest('idempotencyKey', null);
  fastify.decorateRequest('idempotencyLockToken', null);
  fastify.decorateRequest('idempotencyRequestHash', null);
  fastify.decorateRequest('idempotencyReplayed', false);

  // Pre-handler hook - check idempotency before processing
  fastify.addHook('preHandler', async (request, reply) => {
    // Check if this request should be processed
    if (!shouldProcessRequest(request, config)) {
      return;
    }

    // Extract idempotency key
    const key = extractKey(request, config);

    if (!key) {
      if (config.requireKey) {
        reply.code(400).send({
          error: 'MISSING_IDEMPOTENCY_KEY',
          message: `${config.keyHeader} header is required for ${request.method} requests`,
        });
        return;
      }
      return;
    }

    // Compute request hash
    const requestHash = config.hashFunction
      ? config.hashFunction(request)
      : computeHttpRequestHash(
          request.method,
          request.url,
          request.body,
          normalizeHeaders(request.headers),
          config.fingerprintHeaders
        );

    try {
      // Try to acquire lock
      const lockResult = await store.startProcessing({
        key,
        requestHash,
        endpoint: request.routeOptions?.url ?? request.url,
        method: request.method,
        clientId: request.ip,
        lockTimeout: options.config?.lockTimeout,
      });

      if (!lockResult.acquired) {
        // Handle request mismatch
        if (lockResult.requestMismatch) {
          reply.code(422).send({
            error: IdempotencyErrorCode.REQUEST_MISMATCH,
            message: 'Idempotency key was already used with a different request payload',
          });
          return;
        }

        // Handle completed request (replay)
        if (lockResult.existingStatus === RecordStatus.COMPLETED && lockResult.existingResponse) {
          await replayResponse(reply, lockResult.existingResponse, config);
          (request as FastifyRequest).idempotencyReplayed = true;
          
          if (options.onReplay) {
            options.onReplay(key, lockResult.existingResponse);
          }
          return;
        }

        // Handle concurrent request
        if (lockResult.existingStatus === RecordStatus.PROCESSING) {
          if (config.concurrentRequestHandling === 'wait') {
            const result = await waitForCompletion(store, key, requestHash, config);
            if (result) {
              await replayResponse(reply, result, config);
              (request as FastifyRequest).idempotencyReplayed = true;
              return;
            }
          }

          reply
            .code(409)
            .header('Retry-After', Math.ceil(config.retryInterval / 1000).toString())
            .send({
              error: IdempotencyErrorCode.CONCURRENT_REQUEST,
              message: 'Request is currently being processed',
            });
          return;
        }
      }

      // Store context for response recording
      (request as FastifyRequest).idempotencyKey = key;
      (request as FastifyRequest).idempotencyLockToken = lockResult.lockToken;
      (request as FastifyRequest).idempotencyRequestHash = requestHash;

      requestContexts.set(request.id, {
        key,
        lockToken: lockResult.lockToken!,
        requestHash,
      });
    } catch (error) {
      // Log error but don't fail the request
      if (options.onError) {
        const idempotencyError =
          error instanceof IdempotencyException
            ? error.toError()
            : {
                code: IdempotencyErrorCode.STORAGE_ERROR,
                message: error instanceof Error ? error.message : 'Unknown error',
                retriable: true,
              };
        options.onError(idempotencyError, key);
      }
      // Continue without idempotency
    }
  });

  // onSend hook - record response
  fastify.addHook('onSend', async (request, reply, payload) => {
    const context = requestContexts.get(request.id);
    
    if (!context || (request as FastifyRequest).idempotencyReplayed) {
      return payload;
    }

    try {
      const contentType = reply.getHeader('Content-Type') || 'application/json';
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const serialized = serializeResponse(body, reply.statusCode, contentType);

      const isServerError = reply.statusCode >= 500;

      await store.record({
        key: context.key,
        requestHash: context.requestHash,
        response: serialized,
        httpStatusCode: reply.statusCode,
        contentType,
        lockToken: context.lockToken,
        markAsFailed: isServerError,
        ttl: options.config?.defaultTtl,
      });
    } catch (error) {
      // Try to release lock on error
      try {
        await store.releaseLock({
          key: context.key,
          lockToken: context.lockToken,
          markFailed: true,
          errorCode: 'RECORD_FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      } catch {
        // Ignore release errors
      }

      if (options.onError) {
        options.onError(
          {
            code: IdempotencyErrorCode.STORAGE_ERROR,
            message: error instanceof Error ? error.message : 'Failed to record response',
            retriable: true,
          },
          context.key
        );
      }
    } finally {
      requestContexts.delete(request.id);
    }

    return payload;
  });

  // onError hook - release lock on errors
  fastify.addHook('onError', async (request, _reply, error) => {
    const context = requestContexts.get(request.id);
    
    if (!context) {
      return;
    }

    try {
      await store.releaseLock({
        key: context.key,
        lockToken: context.lockToken,
        markFailed: true,
        errorCode: error.name || 'HANDLER_ERROR',
        errorMessage: error.message,
      });
    } catch {
      // Ignore release errors
    } finally {
      requestContexts.delete(request.id);
    }
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function shouldProcessRequest(
  request: FastifyRequest,
  config: typeof DEFAULT_OPTIONS & { excludePaths: (string | RegExp)[] }
): boolean {
  // Check method
  if (!config.methods.includes(request.method.toUpperCase())) {
    return false;
  }

  // Check excluded paths
  const path = request.routeOptions?.url ?? request.url;
  for (const pattern of config.excludePaths) {
    if (typeof pattern === 'string') {
      if (path === pattern || path.startsWith(pattern)) {
        return false;
      }
    } else if (pattern.test(path)) {
      return false;
    }
  }

  return true;
}

function extractKey(
  request: FastifyRequest,
  config: FastifyPluginOptions & typeof DEFAULT_OPTIONS
): string | undefined {
  if (config.keyExtractor) {
    return config.keyExtractor(request);
  }

  const headerValue = request.headers[config.keyHeader.toLowerCase()];
  if (typeof headerValue === 'string') {
    return headerValue;
  }
  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }
  return undefined;
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalized[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.join(', ');
    }
  }
  return normalized;
}

async function replayResponse(
  reply: FastifyReply,
  serialized: string,
  config: typeof DEFAULT_OPTIONS
): Promise<void> {
  const { body, statusCode, contentType, headers } = deserializeResponse(serialized);

  reply.header(config.replayHeader, 'true');

  if (headers) {
    reply.headers(headers);
  }

  reply.code(statusCode);
  reply.header('Content-Type', contentType);

  if (contentType.includes('application/json')) {
    try {
      reply.send(JSON.parse(body));
    } catch {
      reply.send(body);
    }
  } else {
    reply.send(body);
  }
}

async function waitForCompletion(
  store: IdempotencyStore,
  key: string,
  requestHash: string,
  config: typeof DEFAULT_OPTIONS
): Promise<string | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < config.maxWaitTime) {
    await sleep(config.retryInterval);

    const checkResult = await store.check({ key, requestHash });

    if (checkResult.found && checkResult.status === RecordStatus.COMPLETED) {
      return checkResult.response ?? null;
    }

    if (!checkResult.found || checkResult.status === RecordStatus.FAILED) {
      return null;
    }
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export plugin with fastify-plugin compatibility
export default idempotencyPlugin;

/**
 * Create a route-specific idempotency handler
 * 
 * Usage:
 * ```typescript
 * fastify.post('/payments', {
 *   preHandler: createIdempotencyHandler({ store }),
 * }, handler);
 * ```
 */
export function createIdempotencyHandler(options: FastifyPluginOptions) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const store = options.store;
    const config = {
      ...DEFAULT_OPTIONS,
      ...options,
      fingerprintHeaders: options.config?.fingerprintHeaders ?? [],
    };

    const key = extractKey(request, config);

    if (!key) {
      if (config.requireKey) {
        reply.code(400).send({
          error: 'MISSING_IDEMPOTENCY_KEY',
          message: `${config.keyHeader} header is required`,
        });
      }
      return;
    }

    const requestHash = config.hashFunction
      ? config.hashFunction(request)
      : computeHttpRequestHash(
          request.method,
          request.url,
          request.body,
          normalizeHeaders(request.headers),
          config.fingerprintHeaders
        );

    const lockResult = await store.startProcessing({
      key,
      requestHash,
      endpoint: request.url,
      method: request.method,
      lockTimeout: options.config?.lockTimeout,
    });

    if (!lockResult.acquired) {
      if (lockResult.requestMismatch) {
        reply.code(422).send({
          error: IdempotencyErrorCode.REQUEST_MISMATCH,
          message: 'Idempotency key was already used with a different request payload',
        });
        return;
      }

      if (lockResult.existingStatus === RecordStatus.COMPLETED && lockResult.existingResponse) {
        await replayResponse(reply, lockResult.existingResponse, config);
        return;
      }

      if (lockResult.existingStatus === RecordStatus.PROCESSING) {
        reply.code(409).send({
          error: IdempotencyErrorCode.CONCURRENT_REQUEST,
          message: 'Request is currently being processed',
        });
        return;
      }
    }

    (request as FastifyRequest).idempotencyKey = key;
    (request as FastifyRequest).idempotencyLockToken = lockResult.lockToken;
    (request as FastifyRequest).idempotencyRequestHash = requestHash;
  };
}
