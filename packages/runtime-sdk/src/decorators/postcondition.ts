/**
 * @Postcondition Decorator
 * 
 * Adds a postcondition check to a method.
 */

import type { ExecutionContext, Violation } from '../types.js';
import { getBehaviorMetadata } from './behavior.js';

// Symbol to store postconditions
export const POSTCONDITIONS_METADATA = Symbol('isl:postconditions');

export type PostconditionFn<TResult = unknown, TInput = unknown> = (
  result: TResult,
  input: TInput,
  ctx: ExecutionContext
) => boolean | Promise<boolean>;

export interface PostconditionMetadata {
  fn: PostconditionFn;
  description?: string;
}

/**
 * Add a postcondition to a method
 * 
 * @example
 * ```typescript
 * @Postcondition((result, input) => result.email === input.email)
 * @Postcondition((result) => result.status === 'PENDING')
 * async createUser(input: CreateUserInput): Promise<User> {
 *   // Implementation
 * }
 * ```
 */
export function Postcondition<TResult = unknown, TInput = unknown>(
  fn: PostconditionFn<TResult, TInput>,
  description?: string
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    // Get existing postconditions
    const existing: PostconditionMetadata[] = 
      Reflect.getMetadata(POSTCONDITIONS_METADATA, target, propertyKey) ?? [];
    
    // Add new postcondition
    existing.push({ fn: fn as PostconditionFn, description });
    Reflect.defineMetadata(POSTCONDITIONS_METADATA, existing, target, propertyKey);

    // Wrap the original method
    const originalMethod = descriptor.value as Function;
    
    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const postconditions: PostconditionMetadata[] = 
        Reflect.getMetadata(POSTCONDITIONS_METADATA, target, propertyKey) ?? [];
      
      const input = args[0];
      const ctx: ExecutionContext = (args[1] as ExecutionContext) ?? {};
      const behaviorMeta = getBehaviorMetadata(this);
      const behaviorName = behaviorMeta?.name ?? String(propertyKey);

      const startTime = performance.now();

      // Call original method
      const result = await originalMethod.apply(this, args);

      const duration = performance.now() - startTime;

      // Check all postconditions
      for (let i = 0; i < postconditions.length; i++) {
        const post = postconditions[i]!;
        try {
          const passed = await post.fn(result, input, ctx);
          if (!passed) {
            const violation: Violation = {
              type: 'postcondition',
              domain: behaviorMeta?.domain ?? 'unknown',
              behavior: behaviorName,
              condition: post.description ?? `postcondition[${i}]`,
              message: `Postcondition failed: ${post.description ?? i}`,
              input,
              output: result,
              timestamp: new Date(),
              duration,
            };
            
            // If there's a violation handler in context, use it
            if (ctx.metadata?.onViolation) {
              await (ctx.metadata.onViolation as (v: Violation) => Promise<void>)(violation);
            }
            
            throw new PostconditionError(violation);
          }
        } catch (error) {
          if (error instanceof PostconditionError) throw error;
          
          const violation: Violation = {
            type: 'postcondition',
            domain: behaviorMeta?.domain ?? 'unknown',
            behavior: behaviorName,
            condition: post.description ?? `postcondition[${i}]`,
            message: `Postcondition threw error: ${error}`,
            input,
            output: result,
            timestamp: new Date(),
            duration,
          };
          throw new PostconditionError(violation);
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Error thrown when a postcondition fails
 */
export class PostconditionError extends Error {
  constructor(public violation: Violation) {
    super(violation.message);
    this.name = 'PostconditionError';
  }
}

/**
 * Get postconditions for a method
 */
export function getPostconditions(
  target: object,
  propertyKey: string | symbol
): PostconditionMetadata[] {
  return Reflect.getMetadata(POSTCONDITIONS_METADATA, target, propertyKey) ?? [];
}
