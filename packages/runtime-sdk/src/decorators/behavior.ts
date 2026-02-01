/**
 * @Behavior Decorator
 * 
 * Marks a class as implementing an ISL behavior.
 */

import type { ExecutionContext } from '../types.js';

// Symbol to store behavior metadata
export const BEHAVIOR_METADATA = Symbol('isl:behavior');

export interface BehaviorMetadata {
  name: string;
  domain?: string;
}

/**
 * Mark a class as implementing an ISL behavior
 * 
 * @example
 * ```typescript
 * @Behavior('CreateUser')
 * class UserService {
 *   async createUser(input: CreateUserInput): Promise<User> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export function Behavior(name: string, domain?: string): ClassDecorator {
  return function (target: Function) {
    const metadata: BehaviorMetadata = { name, domain };
    Reflect.defineMetadata(BEHAVIOR_METADATA, metadata, target);
    
    // Also store on prototype for instance access
    (target.prototype as Record<symbol, BehaviorMetadata>)[BEHAVIOR_METADATA] = metadata;
  };
}

/**
 * Get behavior metadata from a class or instance
 */
export function getBehaviorMetadata(target: unknown): BehaviorMetadata | undefined {
  if (!target) return undefined;
  
  // Check prototype (instance)
  if (typeof target === 'object' && target !== null) {
    const proto = Object.getPrototypeOf(target) as Record<symbol, BehaviorMetadata> | null;
    if (proto && proto[BEHAVIOR_METADATA]) {
      return proto[BEHAVIOR_METADATA];
    }
  }
  
  // Check class directly
  if (typeof target === 'function') {
    return Reflect.getMetadata(BEHAVIOR_METADATA, target) as BehaviorMetadata | undefined;
  }
  
  return undefined;
}

// Polyfill Reflect.defineMetadata and Reflect.getMetadata if not available
if (typeof Reflect === 'undefined' || !Reflect.defineMetadata) {
  const metadataMap = new WeakMap<object, Map<string | symbol, unknown>>();

  (Reflect as unknown as Record<string, Function>).defineMetadata = function (
    key: string | symbol,
    value: unknown,
    target: object
  ): void {
    let targetMetadata = metadataMap.get(target);
    if (!targetMetadata) {
      targetMetadata = new Map();
      metadataMap.set(target, targetMetadata);
    }
    targetMetadata.set(key, value);
  };

  (Reflect as unknown as Record<string, Function>).getMetadata = function (
    key: string | symbol,
    target: object
  ): unknown {
    const targetMetadata = metadataMap.get(target);
    return targetMetadata?.get(key);
  };
}
