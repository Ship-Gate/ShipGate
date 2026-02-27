/**
 * @Precondition Decorator
 * 
 * Adds a precondition check to a method.
 */

import type { ExecutionContext, Violation } from '../types.js';
import { getBehaviorMetadata } from './behavior.js';

// Augment Reflect with metadata methods (polyfilled at runtime)
declare global {
  namespace Reflect {
    function getMetadata(metadataKey: unknown, target: object, propertyKey?: string | symbol): unknown;
    function defineMetadata(metadataKey: unknown, metadataValue: unknown, target: object, propertyKey?: string | symbol): void;
  }
}

// Symbol to store preconditions
export const PRECONDITIONS_METADATA = Symbol('isl:preconditions');

export type PreconditionFn<TInput = unknown> = (
  input: TInput,
  ctx: ExecutionContext
) => boolean | Promise<boolean>;

export interface PreconditionMetadata {
  fn: PreconditionFn;
  description?: string;
}

/**
 * Add a precondition to a method
 * 
 * @example
 * ```typescript
 * @Precondition((input) => input.email.includes('@'))
 * @Precondition(async (input, ctx) => {
 *   const exists = await ctx.db.users.findByEmail(input.email);
 *   return !exists;
 * })
 * async createUser(input: CreateUserInput): Promise<User> {
 *   // Implementation
 * }
 * ```
 */
export function Precondition<TInput = unknown>(
  fn: PreconditionFn<TInput>,
  description?: string
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    // Get existing preconditions
    const existing: PreconditionMetadata[] = 
      (Reflect.getMetadata(PRECONDITIONS_METADATA, target, propertyKey) as PreconditionMetadata[] | undefined) ?? [];
    
    // Add new precondition
    existing.push({ fn: fn as PreconditionFn, description });
    Reflect.defineMetadata(PRECONDITIONS_METADATA, existing, target, propertyKey);

    // Wrap the original method
    const originalMethod = descriptor.value as Function;
    
    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const preconditions: PreconditionMetadata[] = 
        (Reflect.getMetadata(PRECONDITIONS_METADATA, target, propertyKey) as PreconditionMetadata[] | undefined) ?? [];
      
      const input = args[0];
      const ctx: ExecutionContext = (args[1] as ExecutionContext) ?? {};
      const behaviorMeta = getBehaviorMetadata(this);
      const behaviorName = behaviorMeta?.name ?? String(propertyKey);

      // Check all preconditions
      for (let i = 0; i < preconditions.length; i++) {
        const pre = preconditions[i]!;
        try {
          const result = await pre.fn(input, ctx);
          if (!result) {
            const violation: Violation = {
              type: 'precondition',
              domain: behaviorMeta?.domain ?? 'unknown',
              behavior: behaviorName,
              condition: pre.description ?? `precondition[${i}]`,
              message: `Precondition failed: ${pre.description ?? i}`,
              input,
              timestamp: new Date(),
            };
            
            // If there's a violation handler in context, use it
            if (ctx.metadata?.onViolation) {
              await (ctx.metadata.onViolation as (v: Violation) => Promise<void>)(violation);
            }
            
            throw new PreconditionError(violation);
          }
        } catch (error) {
          if (error instanceof PreconditionError) throw error;
          
          const violation: Violation = {
            type: 'precondition',
            domain: behaviorMeta?.domain ?? 'unknown',
            behavior: behaviorName,
            condition: pre.description ?? `precondition[${i}]`,
            message: `Precondition threw error: ${error}`,
            input,
            timestamp: new Date(),
          };
          throw new PreconditionError(violation);
        }
      }

      // Call original method
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Error thrown when a precondition fails
 */
export class PreconditionError extends Error {
  constructor(public violation: Violation) {
    super(violation.message);
    this.name = 'PreconditionError';
  }
}

/**
 * Get preconditions for a method
 */
export function getPreconditions(
  target: object,
  propertyKey: string | symbol
): PreconditionMetadata[] {
  return (Reflect.getMetadata(PRECONDITIONS_METADATA, target, propertyKey) as PreconditionMetadata[] | undefined) ?? [];
}

// Extend Reflect polyfill for property keys
if (typeof Reflect !== 'undefined' && !(Reflect as unknown as Record<string, unknown>).getMetadata) {
  const metadataMap = new WeakMap<object, Map<string | symbol, Map<string | symbol, unknown>>>();

  (Reflect as unknown as Record<string, Function>).defineMetadata = function (
    metaKey: string | symbol,
    value: unknown,
    target: object,
    propertyKey?: string | symbol
  ): void {
    let targetMap = metadataMap.get(target);
    if (!targetMap) {
      targetMap = new Map();
      metadataMap.set(target, targetMap);
    }
    
    const key = propertyKey ?? Symbol.for('class');
    let propMap = targetMap.get(key);
    if (!propMap) {
      propMap = new Map();
      targetMap.set(key, propMap);
    }
    
    propMap.set(metaKey, value);
  };

  (Reflect as unknown as Record<string, Function>).getMetadata = function (
    metaKey: string | symbol,
    target: object,
    propertyKey?: string | symbol
  ): unknown {
    const targetMap = metadataMap.get(target);
    if (!targetMap) return undefined;
    
    const key = propertyKey ?? Symbol.for('class');
    const propMap = targetMap.get(key);
    return propMap?.get(metaKey);
  };
}
