/**
 * Cache Key Builder - Utilities for building cache keys.
 */

/**
 * Cache key builder for constructing consistent cache keys
 */
export class CacheKeyBuilder {
  private parts: string[] = [];
  private readonly separator: string;

  constructor(separator = ':') {
    this.separator = separator;
  }

  /**
   * Add a namespace/prefix
   */
  namespace(ns: string): this {
    this.parts.push(ns);
    return this;
  }

  /**
   * Add an entity type
   */
  entity(type: string): this {
    this.parts.push(type);
    return this;
  }

  /**
   * Add an ID
   */
  id(id: string | number): this {
    this.parts.push(String(id));
    return this;
  }

  /**
   * Add a field/property
   */
  field(name: string): this {
    this.parts.push(name);
    return this;
  }

  /**
   * Add a version
   */
  version(v: string | number): this {
    this.parts.push(`v${v}`);
    return this;
  }

  /**
   * Add a hash of parameters
   */
  hash(params: Record<string, unknown>): this {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
      const char = sorted.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    this.parts.push(Math.abs(hash).toString(16));
    return this;
  }

  /**
   * Build the cache key
   */
  build(): string {
    return this.parts.join(this.separator);
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.parts = [];
    return this;
  }
}

/**
 * Build a cache key from parts
 */
export function buildCacheKey(...parts: (string | number)[]): string {
  return parts.map(String).join(':');
}

/**
 * Build a cache key for an entity
 */
export function entityKey(type: string, id: string | number): string {
  return buildCacheKey(type, id);
}

/**
 * Build a cache key for a list/collection
 */
export function listKey(
  type: string,
  params?: Record<string, unknown>
): string {
  const builder = new CacheKeyBuilder().entity(type).field('list');
  
  if (params && Object.keys(params).length > 0) {
    builder.hash(params);
  }
  
  return builder.build();
}

/**
 * Build a cache key for a query
 */
export function queryKey(
  type: string,
  query: string,
  params?: Record<string, unknown>
): string {
  const builder = new CacheKeyBuilder()
    .entity(type)
    .field('query')
    .id(query);
  
  if (params && Object.keys(params).length > 0) {
    builder.hash(params);
  }
  
  return builder.build();
}
