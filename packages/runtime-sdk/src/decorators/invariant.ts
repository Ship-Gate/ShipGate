/**
 * @Invariant Decorator
 * 
 * Adds an invariant check that runs before and after method execution.
 */

import type { ExecutionContext, Violation } from '../types.js';
import { getBehaviorMetadata } from './behavior.js';

// Symbol to store invariants
export const INVARIANTS_METADATA = Symbol('isl:invariants');

export type InvariantFn<TThis = unknown> = (
  instance: TThis,
  ctx: ExecutionContext
) => boolean | Promise<boolean>;

export interface InvariantMetadata {
  fn: InvariantFn;
  description?: string;
}

/**
 * Add an invariant to a method
 * 
 * Invariants are checked both before and after method execution.
 * 
 * @example
 * ```typescript
 * @Invariant(function(this: UserService) { return this.users.length >= 0; })
 * async deleteUser(id: string): Promise<void> {
 *   // Implementation
 * }
 * ```
 */
export function Invariant<TThis = unknown>(
  fn: InvariantFn<TThis>,
  description?: string
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    // Get existing invariants
    const existing: InvariantMetadata[] = 
      Reflect.getMetadata(INVARIANTS_METADATA, target, propertyKey) ?? [];
    
    // Add new invariant
    existing.push({ fn: fn as InvariantFn, description });
    Reflect.defineMetadata(INVARIANTS_METADATA, existing, target, propertyKey);

    // Wrap the original method
    const originalMethod = descriptor.value as Function;
    
    descriptor.value = async function (this: TThis, ...args: unknown[]) {
      const invariants: InvariantMetadata[] = 
        Reflect.getMetadata(INVARIANTS_METADATA, target, propertyKey) ?? [];
      
      const ctx: ExecutionContext = (args[1] as ExecutionContext) ?? {};
      const behaviorMeta = getBehaviorMetadata(this);
      const behaviorName = behaviorMeta?.name ?? String(propertyKey);

      // Check invariants BEFORE
      for (let i = 0; i < invariants.length; i++) {
        const inv = invariants[i]!;
        try {
          const passed = await inv.fn(this, ctx);
          if (!passed) {
            const violation: Violation = {
              type: 'invariant',
              domain: behaviorMeta?.domain ?? 'unknown',
              behavior: behaviorName,
              condition: inv.description ?? `invariant[${i}]`,
              message: `Invariant violated (pre): ${inv.description ?? i}`,
              timestamp: new Date(),
            };
            throw new InvariantError(violation);
          }
        } catch (error) {
          if (error instanceof InvariantError) throw error;
          
          const violation: Violation = {
            type: 'invariant',
            domain: behaviorMeta?.domain ?? 'unknown',
            behavior: behaviorName,
            condition: inv.description ?? `invariant[${i}]`,
            message: `Invariant threw error (pre): ${error}`,
            timestamp: new Date(),
          };
          throw new InvariantError(violation);
        }
      }

      // Call original method
      const result = await originalMethod.apply(this, args);

      // Check invariants AFTER
      for (let i = 0; i < invariants.length; i++) {
        const inv = invariants[i]!;
        try {
          const passed = await inv.fn(this, ctx);
          if (!passed) {
            const violation: Violation = {
              type: 'invariant',
              domain: behaviorMeta?.domain ?? 'unknown',
              behavior: behaviorName,
              condition: inv.description ?? `invariant[${i}]`,
              message: `Invariant violated (post): ${inv.description ?? i}`,
              output: result,
              timestamp: new Date(),
            };
            throw new InvariantError(violation);
          }
        } catch (error) {
          if (error instanceof InvariantError) throw error;
          
          const violation: Violation = {
            type: 'invariant',
            domain: behaviorMeta?.domain ?? 'unknown',
            behavior: behaviorName,
            condition: inv.description ?? `invariant[${i}]`,
            message: `Invariant threw error (post): ${error}`,
            output: result,
            timestamp: new Date(),
          };
          throw new InvariantError(violation);
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Error thrown when an invariant is violated
 */
export class InvariantError extends Error {
  constructor(public violation: Violation) {
    super(violation.message);
    this.name = 'InvariantError';
  }
}

/**
 * Get invariants for a method
 */
export function getInvariants(
  target: object,
  propertyKey: string | symbol
): InvariantMetadata[] {
  return Reflect.getMetadata(INVARIANTS_METADATA, target, propertyKey) ?? [];
}
