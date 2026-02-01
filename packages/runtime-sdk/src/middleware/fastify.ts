/**
 * Fastify Plugin
 * 
 * ISL verification plugin for Fastify applications.
 */

import type { Violation, VerificationMode, ExecutionContext } from '../types.js';
import { ISLClient } from '../client.js';
import { Sampler } from '../sampling/sampler.js';

// Fastify types (optional peer dependency)
interface FastifyInstance {
  addHook(name: string, fn: Function): void;
  decorate(name: string, value: unknown): void;
}

interface FastifyRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  routerPath?: string;
  user?: { id?: string };
  islContext?: ExecutionContext;
}

interface FastifyReply {
  statusCode: number;
  send(payload?: unknown): void;
}

export interface FastifyPluginOptions {
  /** Path to ISL spec file */
  spec: string;
  /** Verification mode */
  mode?: VerificationMode;
  /** Sampling rate (0-1) */
  sampling?: number;
  /** Callback on violation */
  onViolation?: (violation: Violation, request: FastifyRequest) => void | Promise<void>;
  /** Extract behavior name from request */
  getBehavior?: (request: FastifyRequest) => string | undefined;
  /** Build execution context from request */
  getContext?: (request: FastifyRequest) => ExecutionContext;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Fastify plugin for ISL verification
 * 
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { islPlugin } from '@intentos/runtime-sdk/fastify';
 * 
 * const fastify = Fastify();
 * 
 * await fastify.register(islPlugin, {
 *   spec: './domains/auth.isl',
 *   mode: 'monitor',
 *   sampling: 0.1,
 * });
 * ```
 */
export async function islPlugin(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
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
  
  const client = new ISLClient({
    spec,
    mode,
    sampling,
    onViolation,
    debug,
  });
  
  await client.init();

  // Decorate fastify with ISL client
  fastify.decorate('isl', client);

  // Pre-handler hook for precondition checking
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (mode === 'disabled' || !sampler.shouldSample()) {
      return;
    }

    const behaviorName = getBehavior(request);
    if (!behaviorName) return;

    const ctx = getContext(request);
    request.islContext = ctx;

    const behaviors = client.getBehaviors();
    const behavior = behaviors.get(behaviorName);

    if (behavior && behavior.preconditions.length > 0) {
      for (const pre of behavior.preconditions) {
        if (pre.compiled) {
          try {
            const passed = await pre.compiled(request.body, ctx);
            if (!passed) {
              const violation: Violation = {
                type: 'precondition',
                domain: 'fastify',
                behavior: behaviorName,
                condition: pre.expression,
                message: `Precondition failed: ${pre.expression}`,
                input: request.body,
                timestamp: new Date(),
              };

              await onViolation(violation, request);

              if (mode === 'enforce') {
                reply.statusCode = 400;
                reply.send({
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
  });

  // onSend hook for postcondition checking
  fastify.addHook('onSend', async (
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown
  ) => {
    if (mode === 'disabled' || !request.islContext) {
      return payload;
    }

    const behaviorName = getBehavior(request);
    if (!behaviorName) return payload;

    const behaviors = client.getBehaviors();
    const behavior = behaviors.get(behaviorName);

    if (behavior && behavior.postconditions.length > 0) {
      // Parse payload if it's a string
      let responseBody = payload;
      if (typeof payload === 'string') {
        try {
          responseBody = JSON.parse(payload);
        } catch {
          // Not JSON, skip postcondition check
          return payload;
        }
      }

      for (const post of behavior.postconditions) {
        if (post.compiled) {
          try {
            const passed = await post.compiled(responseBody, request.body, request.islContext);
            if (!passed) {
              const violation: Violation = {
                type: 'postcondition',
                domain: 'fastify',
                behavior: behaviorName,
                condition: post.expression,
                message: `Postcondition failed: ${post.expression}`,
                input: request.body,
                output: responseBody,
                timestamp: new Date(),
              };

              await onViolation(violation, request);

              if (mode === 'enforce') {
                reply.statusCode = 500;
                return JSON.stringify({
                  error: 'Postcondition failed',
                  violation,
                });
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

    return payload;
  });
}

/**
 * Default behavior name extraction
 */
function defaultGetBehavior(request: FastifyRequest): string | undefined {
  const path = request.routerPath ?? request.url;
  const method = request.method.toUpperCase();
  
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
 * Default context builder
 */
function defaultGetContext(request: FastifyRequest): ExecutionContext {
  return {
    requestId: request.headers['x-request-id'] as string | undefined,
    userId: request.user?.id,
    traceId: request.headers['x-trace-id'] as string | undefined,
    metadata: {
      method: request.method,
      path: request.url,
    },
  };
}
