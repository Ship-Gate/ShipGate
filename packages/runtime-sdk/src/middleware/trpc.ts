/**
 * tRPC Middleware
 * 
 * ISL verification middleware for tRPC procedures.
 */

import type { Violation, VerificationMode, ExecutionContext } from '../types.js';
import { ISLClient } from '../client.js';
import { Sampler } from '../sampling/sampler.js';

export interface TRPCMiddlewareOptions {
  /** Path to ISL spec file */
  spec: string;
  /** Verification mode */
  mode?: VerificationMode;
  /** Sampling rate (0-1) */
  sampling?: number;
  /** Callback on violation */
  onViolation?: (violation: Violation) => void | Promise<void>;
  /** Enable debug logging */
  debug?: boolean;
}

export interface TRPCContext {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Create tRPC middleware for ISL verification
 * 
 * @example
 * ```typescript
 * import { initTRPC } from '@trpc/server';
 * import { islMiddleware } from '@intentos/runtime-sdk/trpc';
 * 
 * const t = initTRPC.context<Context>().create();
 * 
 * const isl = islMiddleware({
 *   spec: './domains/auth.isl',
 *   mode: 'monitor',
 * });
 * 
 * const protectedProcedure = t.procedure.use(isl);
 * 
 * export const router = t.router({
 *   createUser: protectedProcedure
 *     .input(z.object({ email: z.string() }))
 *     .mutation(async ({ input }) => {
 *       // Implementation
 *     }),
 * });
 * ```
 */
export function islMiddleware(options: TRPCMiddlewareOptions) {
  const {
    spec,
    mode = 'monitor',
    sampling = 1.0,
    onViolation = () => {},
    debug = false,
  } = options;

  const sampler = new Sampler({ rate: sampling });
  let client: ISLClient | null = null;
  let initPromise: Promise<void> | null = null;

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

  // Return a middleware function compatible with tRPC
  return async function middleware<TCtx extends TRPCContext>(opts: {
    ctx: TCtx;
    input: unknown;
    path: string;
    type: 'query' | 'mutation' | 'subscription';
    next: (opts?: { ctx?: TCtx }) => Promise<{ ok: boolean; data?: unknown; error?: unknown }>;
  }) {
    const { ctx, input, path, type, next } = opts;

    // Skip if disabled or not sampled
    if (mode === 'disabled' || !sampler.shouldSample()) {
      return next();
    }

    try {
      const islClient = await ensureInit();
      
      // Convert path to behavior name
      // e.g., "user.create" -> "CreateUser"
      const behaviorName = pathToBehaviorName(path, type);
      
      const executionCtx: ExecutionContext = {
        requestId: ctx.requestId,
        userId: ctx.userId,
        metadata: { path, type },
      };

      const behaviors = islClient.getBehaviors();
      const behavior = behaviors.get(behaviorName);

      // Check preconditions
      if (behavior && behavior.preconditions.length > 0) {
        for (const pre of behavior.preconditions) {
          if (pre.compiled) {
            try {
              const passed = await pre.compiled(input, executionCtx);
              if (!passed) {
                const violation: Violation = {
                  type: 'precondition',
                  domain: 'trpc',
                  behavior: behaviorName,
                  condition: pre.expression,
                  message: `Precondition failed: ${pre.expression}`,
                  input,
                  timestamp: new Date(),
                };

                await onViolation(violation);

                if (mode === 'enforce') {
                  return {
                    ok: false,
                    error: {
                      code: 'BAD_REQUEST',
                      message: 'Precondition failed',
                      violation,
                    },
                  };
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

      // Execute the procedure
      const result = await next();

      // Check postconditions
      if (result.ok && behavior && behavior.postconditions.length > 0) {
        for (const post of behavior.postconditions) {
          if (post.compiled) {
            try {
              const passed = await post.compiled(result.data, input, executionCtx);
              if (!passed) {
                const violation: Violation = {
                  type: 'postcondition',
                  domain: 'trpc',
                  behavior: behaviorName,
                  condition: post.expression,
                  message: `Postcondition failed: ${post.expression}`,
                  input,
                  output: result.data,
                  timestamp: new Date(),
                };

                await onViolation(violation);

                if (mode === 'enforce') {
                  return {
                    ok: false,
                    error: {
                      code: 'INTERNAL_SERVER_ERROR',
                      message: 'Postcondition failed',
                      violation,
                    },
                  };
                }
              }
            } catch (error) {
              if (debug) {
                console.error('[ISL] Postcondition error:', error);
              }
            }
          }
        }
      }

      return result;
    } catch (error) {
      if (debug) {
        console.error('[ISL] Middleware error:', error);
      }
      return next();
    }
  };
}

/**
 * Convert tRPC path to behavior name
 */
function pathToBehaviorName(path: string, type: 'query' | 'mutation' | 'subscription'): string {
  // "user.create" -> ["user", "create"]
  const parts = path.split('.');
  const action = parts[parts.length - 1] ?? '';
  const resource = parts[parts.length - 2] ?? parts[0] ?? '';
  
  // Capitalize first letter
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  
  // Map common actions
  const actionMap: Record<string, string> = {
    create: 'Create',
    get: 'Get',
    list: 'List',
    update: 'Update',
    delete: 'Delete',
    remove: 'Delete',
  };

  const actionPrefix = actionMap[action.toLowerCase()] ?? capitalize(action);
  const resourceName = capitalize(resource);

  return `${actionPrefix}${resourceName}`;
}
