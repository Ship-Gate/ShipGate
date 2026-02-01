// ============================================================================
// ISL Standard Library - Express Idempotency Middleware
// @stdlib/idempotency/middleware/express
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
  parseResponseBody,
} from '../utils';

// Express types (compatible with express@4 and @5)
export interface Request {
  method: string;
  path: string;
  originalUrl: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  get(name: string): string | undefined;
  ip?: string;
}

export interface Response {
  statusCode: number;
  status(code: number): Response;
  set(name: string, value: string): Response;
  setHeader(name: string, value: string): Response;
  json(body: unknown): void;
  send(body: unknown): void;
  end(chunk?: unknown): void;
  getHeader(name: string): string | number | string[] | undefined;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
  headersSent: boolean;
  locals: Record<string, unknown>;
}

export interface NextFunction {
  (err?: unknown): void;
}

export type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export interface ExpressIdempotencyOptions extends IdempotencyMiddlewareOptions {
  /** Header name for idempotency key (default: 'Idempotency-Key') */
  keyHeader?: string;
  
  /** Header to indicate replayed response */
  replayHeader?: string;
  
  /** HTTP methods to apply idempotency (default: ['POST', 'PUT', 'PATCH']) */
  methods?: string[];
  
  /** Paths to exclude from idempotency */
  excludePaths?: (string | RegExp)[];
  
  /** Require idempotency key for applicable requests */
  requireKey?: boolean;
  
  /** Custom key extractor */
  keyExtractor?: (req: Request) => string | undefined;
  
  /** Custom hash function */
  hashFunction?: (req: Request) => string;
  
  /** Handle concurrent requests (wait/reject) */
  concurrentRequestHandling?: 'wait' | 'reject';
  
  /** Max wait time for concurrent requests in ms */
  maxWaitTime?: number;
  
  /** Retry interval for waiting on concurrent requests */
  retryInterval?: number;
}

const DEFAULT_OPTIONS: Required<
  Pick<
    ExpressIdempotencyOptions,
    | 'keyHeader'
    | 'replayHeader'
    | 'methods'
    | 'requireKey'
    | 'concurrentRequestHandling'
    | 'maxWaitTime'
    | 'retryInterval'
  >
> = {
  keyHeader: 'Idempotency-Key',
  replayHeader: 'Idempotency-Replayed',
  methods: ['POST', 'PUT', 'PATCH'],
  requireKey: false,
  concurrentRequestHandling: 'reject',
  maxWaitTime: 30000,
  retryInterval: 100,
};

/**
 * Express middleware for idempotent request handling
 * 
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { createIdempotencyMiddleware } from '@isl-lang/stdlib-idempotency/middleware/express';
 * import { createMemoryStore } from '@isl-lang/stdlib-idempotency/store/memory';
 * 
 * const app = express();
 * const store = createMemoryStore();
 * 
 * app.use(express.json());
 * app.use(createIdempotencyMiddleware({ store }));
 * 
 * app.post('/payments', async (req, res) => {
 *   const payment = await processPayment(req.body);
 *   res.status(201).json(payment);
 * });
 * ```
 */
export function createIdempotencyMiddleware(
  options: ExpressIdempotencyOptions
): ExpressMiddleware {
  const store = options.store;
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
    excludePaths: options.excludePaths ?? [],
    fingerprintHeaders: options.config?.fingerprintHeaders ?? [],
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if this request should be processed
    if (!shouldProcessRequest(req, config)) {
      return next();
    }

    // Extract idempotency key
    const key = extractKey(req, config);

    if (!key) {
      if (config.requireKey) {
        return sendError(res, 400, {
          code: 'MISSING_IDEMPOTENCY_KEY',
          message: `${config.keyHeader} header is required for ${req.method} requests`,
        });
      }
      return next();
    }

    // Compute request hash
    const requestHash = config.hashFunction
      ? config.hashFunction(req)
      : computeHttpRequestHash(
          req.method,
          req.path,
          req.body,
          normalizeHeaders(req.headers),
          config.fingerprintHeaders
        );

    try {
      // Try to acquire lock
      const lockResult = await store.startProcessing({
        key,
        requestHash,
        endpoint: req.path,
        method: req.method,
        clientId: req.ip,
        lockTimeout: options.config?.lockTimeout,
      });

      if (!lockResult.acquired) {
        // Handle request mismatch
        if (lockResult.requestMismatch) {
          return sendError(res, 422, {
            code: IdempotencyErrorCode.REQUEST_MISMATCH,
            message: 'Idempotency key was already used with a different request payload',
          });
        }

        // Handle completed request (replay)
        if (lockResult.existingStatus === RecordStatus.COMPLETED && lockResult.existingResponse) {
          return replayResponse(res, lockResult.existingResponse, config);
        }

        // Handle concurrent request
        if (lockResult.existingStatus === RecordStatus.PROCESSING) {
          if (config.concurrentRequestHandling === 'wait') {
            return await waitAndReplay(store, key, requestHash, res, config);
          }
          
          return sendError(res, 409, {
            code: IdempotencyErrorCode.CONCURRENT_REQUEST,
            message: 'Request is currently being processed',
            retryAfter: Math.ceil(config.retryInterval / 1000),
          });
        }

        // Failed status - allow retry
        // Fall through to process the request
      }

      // Store lock token for cleanup
      res.locals.idempotencyKey = key;
      res.locals.idempotencyLockToken = lockResult.lockToken;
      res.locals.idempotencyRequestHash = requestHash;

      // Intercept response
      interceptResponse(req, res, next, store, key, requestHash, lockResult.lockToken!, config);
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
      return next();
    }
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function shouldProcessRequest(
  req: Request,
  config: typeof DEFAULT_OPTIONS & { excludePaths: (string | RegExp)[] }
): boolean {
  // Check method
  if (!config.methods.includes(req.method.toUpperCase())) {
    return false;
  }

  // Check excluded paths
  for (const pattern of config.excludePaths) {
    if (typeof pattern === 'string') {
      if (req.path === pattern || req.path.startsWith(pattern)) {
        return false;
      }
    } else if (pattern.test(req.path)) {
      return false;
    }
  }

  return true;
}

function extractKey(
  req: Request,
  config: ExpressIdempotencyOptions & typeof DEFAULT_OPTIONS
): string | undefined {
  if (config.keyExtractor) {
    return config.keyExtractor(req);
  }

  const headerValue = req.get(config.keyHeader) || req.headers[config.keyHeader.toLowerCase()];
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

function sendError(
  res: Response,
  status: number,
  error: { code: string; message: string; retryAfter?: number }
): void {
  if (error.retryAfter) {
    res.setHeader('Retry-After', error.retryAfter.toString());
  }
  res.status(status).json({
    error: error.code,
    message: error.message,
  });
}

function replayResponse(
  res: Response,
  serialized: string,
  config: typeof DEFAULT_OPTIONS
): void {
  const { body, statusCode, contentType, headers } = deserializeResponse(serialized);

  res.setHeader(config.replayHeader, 'true');

  if (headers) {
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
  }

  res.status(statusCode);
  res.setHeader('Content-Type', contentType);

  if (contentType.includes('application/json')) {
    try {
      res.json(JSON.parse(body));
    } catch {
      res.send(body);
    }
  } else {
    res.send(body);
  }
}

async function waitAndReplay(
  store: IdempotencyStore,
  key: string,
  requestHash: string,
  res: Response,
  config: typeof DEFAULT_OPTIONS
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < config.maxWaitTime) {
    await sleep(config.retryInterval);

    const checkResult = await store.check({ key, requestHash });

    if (checkResult.found && checkResult.status === RecordStatus.COMPLETED) {
      if (checkResult.response) {
        return replayResponse(res, checkResult.response, config);
      }
    }

    if (!checkResult.found || checkResult.status === RecordStatus.FAILED) {
      // Request failed or was released, let client retry
      return sendError(res, 409, {
        code: IdempotencyErrorCode.CONCURRENT_REQUEST,
        message: 'Concurrent request failed, please retry',
      });
    }
  }

  // Timeout waiting
  return sendError(res, 408, {
    code: 'TIMEOUT',
    message: 'Timeout waiting for concurrent request to complete',
  });
}

function interceptResponse(
  _req: Request,
  res: Response,
  next: NextFunction,
  store: IdempotencyStore,
  key: string,
  requestHash: string,
  lockToken: LockToken,
  config: ExpressIdempotencyOptions
): void {
  // Store original methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalEnd = res.end.bind(res);

  let responseRecorded = false;
  let responseBody: unknown;

  const recordResponse = async (body: unknown) => {
    if (responseRecorded) return;
    responseRecorded = true;

    try {
      const contentType =
        (res.getHeader('Content-Type') as string) || 'application/json';
      const serialized = serializeResponse(body, res.statusCode, contentType);

      const isError = res.statusCode >= 400;
      
      await store.record({
        key,
        requestHash,
        response: serialized,
        httpStatusCode: res.statusCode,
        contentType,
        lockToken,
        markAsFailed: isError && res.statusCode >= 500,
        ttl: config.config?.defaultTtl,
      });

      if (config.onReplay) {
        // Not a replay, but notify for tracking
      }
    } catch (error) {
      // Try to release lock on error
      try {
        await store.releaseLock({
          key,
          lockToken,
          markFailed: true,
          errorCode: 'RECORD_FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      } catch {
        // Ignore release errors
      }

      if (config.onError) {
        config.onError(
          {
            code: IdempotencyErrorCode.STORAGE_ERROR,
            message: error instanceof Error ? error.message : 'Failed to record response',
            retriable: true,
          },
          key
        );
      }
    }
  };

  // Override json
  res.json = function (body: unknown) {
    responseBody = body;
    recordResponse(body);
    return originalJson(body);
  };

  // Override send
  res.send = function (body: unknown) {
    if (!responseRecorded) {
      responseBody = body;
      recordResponse(body);
    }
    return originalSend(body);
  };

  // Override end
  res.end = function (chunk?: unknown) {
    if (!responseRecorded && (chunk || responseBody)) {
      recordResponse(chunk || responseBody);
    }
    return originalEnd(chunk);
  };

  // Handle response errors
  const cleanup = async () => {
    if (!responseRecorded) {
      try {
        await store.releaseLock({
          key,
          lockToken,
          markFailed: true,
          errorCode: 'REQUEST_ABORTED',
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  };

  res.on('close', () => {
    if (!res.headersSent) {
      cleanup();
    }
  });

  res.on('error', cleanup);

  next();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Utility to skip idempotency for specific routes
 */
export function skipIdempotency(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.locals.skipIdempotency = true;
  next();
}
