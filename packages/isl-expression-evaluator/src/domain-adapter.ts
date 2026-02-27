// ============================================================================
// ISL Expression Evaluator - Domain Adapter Interface
// ============================================================================
// 
// Provides a safe adapter interface for evaluating domain-specific expressions
// like User.exists(id) or User.lookup(email) without network calls.
//
// Adapters can be backed by:
// - In-memory fixtures (for unit testing)
// - Trace events from proof bundles (for verification)
// ============================================================================

import type { TriState } from './types.js';

/**
 * Value returned by adapter methods
 * Can be a concrete value, null/undefined, or 'unknown' for tri-state evaluation
 */
export type AdapterValue = unknown | 'unknown';

/**
 * Result of a function resolution
 */
export interface FunctionResolution {
  /** The resolved value, or 'unknown' if cannot be determined */
  value: AdapterValue;
  /** Whether the function was found/handled by this adapter */
  handled: boolean;
  /** Optional diagnostic information */
  diagnostic?: string;
}

/**
 * Result of a property resolution  
 */
export interface PropertyResolution {
  /** The resolved value, or 'unknown' if cannot be determined */
  value: AdapterValue;
  /** Whether the property was found/handled by this adapter */
  handled: boolean;
  /** Optional diagnostic information */
  diagnostic?: string;
}

/**
 * Domain adapter interface for resolving domain-specific functions and properties
 * 
 * This interface allows expressions like `User.exists(id)` or `User.lookup(email)`
 * to be evaluated offline using injected fixtures or trace data.
 */
export interface DomainAdapter {
  /**
   * The domain name this adapter handles (e.g., 'auth', 'payments')
   */
  readonly domain: string;

  /**
   * Resolve a function call
   * 
   * @param entity - The entity type (e.g., 'User', 'Session')
   * @param method - The method name (e.g., 'exists', 'lookup')
   * @param args - The function arguments
   * @returns Resolution result with value and handled flag
   * 
   * @example
   * // For expression: User.exists(id)
   * adapter.resolveFunction('User', 'exists', [{ id: 'user-123' }])
   * // Returns: { value: true, handled: true }
   */
  resolveFunction(
    entity: string,
    method: string,
    args: unknown[]
  ): FunctionResolution;

  /**
   * Resolve a property access
   * 
   * @param path - Property path as array (e.g., ['User', 'current', 'email'])
   * @returns Resolution result with value and handled flag
   * 
   * @example
   * // For expression: User.current.email
   * adapter.resolveProperty(['User', 'current', 'email'])
   * // Returns: { value: 'test@example.com', handled: true }
   */
  resolveProperty(path: string[]): PropertyResolution;

  /**
   * Check if this adapter can handle a given entity
   * 
   * @param entity - The entity type name
   * @returns true if this adapter handles the entity
   */
  canHandle(entity: string): boolean;
}

/**
 * Options for creating a composite adapter
 */
export interface CompositeAdapterOptions {
  /** List of domain adapters to combine */
  adapters: DomainAdapter[];
  /** If true, first matching adapter wins (default: true) */
  firstMatchWins?: boolean;
}

/**
 * Composite adapter that delegates to multiple domain adapters
 * 
 * Allows combining adapters for different domains (auth, payments, etc.)
 */
export class CompositeAdapter implements DomainAdapter {
  readonly domain = 'composite';
  private readonly adapters: DomainAdapter[];
  private readonly firstMatchWins: boolean;

  constructor(options: CompositeAdapterOptions) {
    this.adapters = options.adapters;
    this.firstMatchWins = options.firstMatchWins ?? true;
  }

  resolveFunction(entity: string, method: string, args: unknown[]): FunctionResolution {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(entity)) {
        const result = adapter.resolveFunction(entity, method, args);
        if (result.handled || this.firstMatchWins) {
          return result;
        }
      }
    }
    return { value: 'unknown', handled: false };
  }

  resolveProperty(path: string[]): PropertyResolution {
    const entity = path[0];
    for (const adapter of this.adapters) {
      if (adapter.canHandle(entity)) {
        const result = adapter.resolveProperty(path);
        if (result.handled || this.firstMatchWins) {
          return result;
        }
      }
    }
    return { value: 'unknown', handled: false };
  }

  canHandle(entity: string): boolean {
    return this.adapters.some(a => a.canHandle(entity));
  }

  /**
   * Add an adapter to the composite
   */
  addAdapter(adapter: DomainAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Get all registered adapters
   */
  getAdapters(): readonly DomainAdapter[] {
    return this.adapters;
  }
}

/**
 * Base class for domain adapters with common utility methods
 */
export abstract class BaseDomainAdapter implements DomainAdapter {
  abstract readonly domain: string;
  protected abstract readonly entities: Set<string>;

  canHandle(entity: string): boolean {
    return this.entities.has(entity);
  }

  abstract resolveFunction(
    entity: string,
    method: string,
    args: unknown[]
  ): FunctionResolution;

  abstract resolveProperty(path: string[]): PropertyResolution;

  /**
   * Helper to create a resolved result
   */
  protected resolved(value: AdapterValue, diagnostic?: string): FunctionResolution {
    return { value, handled: true, diagnostic };
  }

  /**
   * Helper to create a resolved property result
   */
  protected resolvedProperty(value: AdapterValue, diagnostic?: string): PropertyResolution {
    return { value, handled: true, diagnostic };
  }

  /**
   * Helper to create an unhandled result
   */
  protected unhandled(diagnostic?: string): FunctionResolution {
    return { value: 'unknown', handled: false, diagnostic };
  }

  /**
   * Helper to convert adapter value to tri-state
   */
  protected toTriState(value: AdapterValue): TriState {
    if (value === 'unknown') return 'unknown';
    if (value === null || value === undefined) return 'false';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return 'true';
  }
}

/**
 * Bridge adapter that connects DomainAdapter to the existing ExpressionAdapter interface
 * 
 * This allows using the new domain adapters with the existing evaluator
 */
export function createDomainAdapterBridge(domainAdapter: DomainAdapter) {
  return {
    is_valid(value: unknown): TriState {
      if (value === null || value === undefined) return 'false';
      if (typeof value === 'string') return value.length > 0 ? 'true' : 'false';
      if (Array.isArray(value)) return value.length > 0 ? 'true' : 'false';
      return 'true';
    },

    length(value: unknown): number | 'unknown' {
      if (typeof value === 'string') return value.length;
      if (Array.isArray(value)) return value.length;
      return 'unknown';
    },

    exists(entityName: string, criteria?: Record<string, unknown>): TriState {
      const args = criteria ? [criteria] : [];
      const result = domainAdapter.resolveFunction(entityName, 'exists', args);
      if (!result.handled) return 'unknown';
      if (result.value === 'unknown') return 'unknown';
      if (typeof result.value === 'boolean') return result.value ? 'true' : 'false';
      return result.value ? 'true' : 'false';
    },

    lookup(entityName: string, criteria?: Record<string, unknown>): unknown | 'unknown' {
      const args = criteria ? [criteria] : [];
      const result = domainAdapter.resolveFunction(entityName, 'lookup', args);
      return result.handled ? result.value : 'unknown';
    },

    getProperty(object: unknown, property: string): unknown | 'unknown' {
      // Check if object is an entity name (string) for domain property access
      if (typeof object === 'string' && domainAdapter.canHandle(object)) {
        const result = domainAdapter.resolveProperty([object, property]);
        if (result.handled) return result.value;
      }
      
      // Fall back to direct property access
      if (object === null || object === undefined) return 'unknown';
      if (typeof object === 'object') {
        const value = (object as Record<string, unknown>)[property];
        return value !== undefined ? value : 'unknown';
      }
      return 'unknown';
    },
  };
}
