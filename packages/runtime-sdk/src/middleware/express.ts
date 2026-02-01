/**
 * Express Middleware
 * 
 * ISL verification middleware for Express applications.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Violation, VerificationMode, ExecutionContext } from '../types.js';
import { ISLClient } from '../client.js';
import { Sampler } from '../sampling/sampler.js';

export interface ExpressMiddlewareOptions {
  /** Path to ISL spec file */
  spec: string;
  /** Verification mode */
  mode?: VerificationMode;
  /** Sampling rate (0-1) */
  sampling?: number;
  /** Callback on violation */
  onViolation?: (violation: Violation, req: Request) => void | Promise<void>;
  /** Extract behavior name from request */
  getBehavior?: (req: Request) => string | undefined;
  /** Build execution context from request */
  getContext?: (req: Request) => ExecutionContext;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Express middleware for ISL verification
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { islMiddleware } from '@isl-lang/runtime-sdk/express';
 * 
 * const app = express();
 * 
 * app.use(islMiddleware({
 *   spec: './domains/auth.isl',
 *   mode: 'monitor',
 *   sampling: 0.1,
 *   onViolation: (violation) => {
 *     console.error('ISL violation:', violation);
 *   },
 * }));
 * ```
 */
export function islMiddleware(options: ExpressMiddlewareOptions): RequestHandler {
  const {
    spec,
    mode = 'monitor',
    sampling = 1.0,
    onViolation = () => {},
    getBehavior = defaultGetBehavior,
    getContext = defaultGetContext,
    debug = false,
  } = options;

  const sampler = new Sampler({ rate: sampling });
  let client: ISLClient | null = null;
  let initPromise: Promise<void> | null = null;

  // Lazy initialization
  const ensureInit = async (): Promise<ISLClient> => {
    if (client) return client;
    
    if (!initPromise) {
      client = new ISLClient({
        spec,
        mode,
        sampling,
        onViolation,
        debug,
      });
      initPromise = client.init();
    }
    
    await initPromise;
    return client!;
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if disabled or not sampled
    if (mode === 'disabled' || !sampler.shouldSample()) {
      next();
      return;
    }

    try {
      const islClient = await ensureInit();
      const behaviorName = getBehavior(req);
      
      if (!behaviorName) {
        next();
        return;
      }

      const ctx = getContext(req);

      // Attach ISL context to request for later use
      (req as Request & { islContext?: ExecutionContext }).islContext = ctx;

      // Store original json method to intercept response
      const originalJson = res.json.bind(res);
      
      res.json = function (body: unknown) {
        // Verify postconditions on response
        setImmediate(async () => {
          try {
            await islClient.verify(
              behaviorName,
              async () => body,
              req.body,
              ctx
            );
          } catch (error) {
            if (debug) {
              console.error('[ISL] Postcondition verification error:', error);
            }
          }
        });
        
        return originalJson(body);
      };

      // Verify preconditions before processing
      const behaviors = islClient.getBehaviors();
      const behavior = behaviors.get(behaviorName);
      
      if (behavior && behavior.preconditions.length > 0) {
        for (const pre of behavior.preconditions) {
          if (pre.compiled) {
            try {
              const passed = await pre.compiled(req.body, ctx);
              if (!passed) {
                const violation: Violation = {
                  type: 'precondition',
                  domain: 'express',
                  behavior: behaviorName,
                  condition: pre.expression,
                  message: `Precondition failed: ${pre.expression}`,
                  input: req.body,
                  timestamp: new Date(),
                };
                
                await onViolation(violation, req);
                
                if (mode === 'enforce') {
                  res.status(400).json({
                    error: 'Precondition failed',
                    violation,
                  });
                  return;
                }
              }
            } catch (error) {
              if (debug) {
                console.error('[ISL] Precondition error:', error);
              }
            }
          }
        }
      }

      next();
    } catch (error) {
      if (debug) {
        console.error('[ISL] Middleware error:', error);
      }
      next();
    }
  };
}

/**
 * Default behavior name extraction from request
 */
function defaultGetBehavior(req: Request): string | undefined {
  // Try to extract from route
  const path = req.route?.path ?? req.path;
  const method = req.method.toUpperCase();
  
  // Convert path to behavior name
  // e.g., POST /api/users -> CreateUser
  // e.g., GET /api/users/:id -> GetUser
  // e.g., PUT /api/users/:id -> UpdateUser
  // e.g., DELETE /api/users/:id -> DeleteUser
  
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1] ?? '';
  const resourceName = lastPart.startsWith(':') 
    ? parts[parts.length - 2] ?? 'resource'
    : lastPart;
  
  const singular = resourceName.replace(/s$/, '');
  const capitalized = singular.charAt(0).toUpperCase() + singular.slice(1);
  
  switch (method) {
    case 'POST': return `Create${capitalized}`;
    case 'GET': return lastPart.startsWith(':') ? `Get${capitalized}` : `List${capitalized}s`;
    case 'PUT':
    case 'PATCH': return `Update${capitalized}`;
    case 'DELETE': return `Delete${capitalized}`;
    default: return undefined;
  }
}

/**
 * Default context builder from request
 */
function defaultGetContext(req: Request): ExecutionContext {
  return {
    requestId: req.headers['x-request-id'] as string | undefined,
    userId: (req as Request & { user?: { id?: string } }).user?.id,
    traceId: req.headers['x-trace-id'] as string | undefined,
    metadata: {
      method: req.method,
      path: req.path,
      ip: req.ip,
    },
  };
}

/**
 * Type extension for Express Request
 */
declare global {
  namespace Express {
    interface Request {
      islContext?: ExecutionContext;
    }
  }
}
