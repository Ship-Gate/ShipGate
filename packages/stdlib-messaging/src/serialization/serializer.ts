/**
 * Serializer interface and base implementation
 */

import type { Serializer } from '../types.js';
import type { EncodingOptions, DecodingOptions } from './types.js';
import { SerializationError, DeserializationError } from '../errors.js';

// ============================================================================
// ABSTRACT SERIALIZER
// ============================================================================

export abstract class AbstractSerializer implements Serializer {
  abstract readonly name: string;
  
  /**
   * Serialize with options
   */
  serializeWithOptions<T>(value: T, options?: EncodingOptions): string {
    try {
      const serialized = this.doSerialize(value, options);
      
      // Apply compression if specified
      if (options?.compression && options.compression !== 'none') {
        return this.compress(serialized, options.compression);
      }
      
      return serialized;
    } catch (error) {
      throw new SerializationError(
        `Failed to serialize: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Deserialize with options
   */
  deserializeWithOptions<T>(data: string, options?: DecodingOptions): T {
    try {
      let decompressed = data;
      
      // Try to decompress if needed
      if (this.isCompressed(data)) {
        decompressed = this.decompress(data);
      }
      
      return this.doDeserialize<T>(decompressed, options);
    } catch (error) {
      throw new DeserializationError(
        `Failed to deserialize: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Get content type
   */
  abstract getContentType(): string;
  
  /**
   * Internal serialize implementation
   */
  protected abstract doSerialize<T>(value: T, options?: EncodingOptions): string;
  
  /**
   * Internal deserialize implementation
   */
  protected abstract doDeserialize<T>(data: string, options?: DecodingOptions): T;
  
  /**
   * Serialize a value (without options)
   */
  serialize<T>(value: T): string {
    return this.serializeWithOptions(value);
  }
  
  /**
   * Deserialize a value (without options)
   */
  deserialize<T>(data: string): T {
    return this.deserializeWithOptions<T>(data);
  }
  
  /**
   * Check if data is compressed
   */
  protected isCompressed(data: string): boolean {
    // Check for magic bytes
    return data.startsWith('\x1f\x8b') || // Gzip
           data.startsWith('\x42\x5a') ||  // Brotli (approximate)
           data.startsWith('\x04"M\x18');  // LZ4
  }
  
  /**
   * Compress data
   */
  protected compress(data: string, type: string): string {
    // In a real implementation, use appropriate compression library
    // For now, just add a marker
    return `compressed:${type}:${data}`;
  }
  
  /**
   * Decompress data
   */
  protected decompress(data: string): string {
    if (data.startsWith('compressed:')) {
      const parts = data.split(':', 3);
      if (parts.length === 3) {
        // In a real implementation, decompress using the specified type
        return parts[2];
      }
    }
    return data;
  }
}

// ============================================================================
// SERIALIZER REGISTRY IMPLEMENTATION
// ============================================================================

export class DefaultSerializerRegistry {
  private serializers = new Map<string, Serializer>();
  
  register(contentType: string, serializer: Serializer): void {
    this.serializers.set(contentType, serializer);
  }
  
  get(contentType: string): Serializer | undefined {
    return this.serializers.get(contentType);
  }
  
  getContentTypes(): string[] {
    return Array.from(this.serializers.keys());
  }
  
  /**
   * Get serializer or throw
   */
  getOrThrow(contentType: string): Serializer {
    const serializer = this.get(contentType);
    if (!serializer) {
      throw new SerializationError(`No serializer registered for content type: ${contentType}`);
    }
    return serializer;
  }
}

// ============================================================================
// GLOBAL SERIALIZER REGISTRY
// ============================================================================

export const serializerRegistry = new DefaultSerializerRegistry();

// ============================================================================
// SERIALIZER DECORATOR
// ============================================================================

/**
 * Decorator to register a serializer
 */
export function registerSerializer(contentType: string) {
  return function (target: new () => Serializer) {
    const instance = new target();
    serializerRegistry.register(contentType, instance);
  };
}

// ============================================================================
// VALIDATING SERIALIZER
// ============================================================================

/**
 * Serializer that validates data before serialization/deserialization
 */
export class ValidatingSerializer implements Serializer {
  readonly name: string;
  
  constructor(
    private readonly baseSerializer: Serializer,
    private readonly validator?: (data: any) => boolean
  ) {
    this.name = `validating-${baseSerializer.name}`;
  }
  
  serialize<T>(value: T): string {
    if (this.validator && !this.validator(value)) {
      throw new SerializationError('Data validation failed before serialization');
    }
    return this.baseSerializer.serialize(value);
  }
  
  deserialize<T>(data: string): T {
    const result = this.baseSerializer.deserialize<T>(data);
    if (this.validator && !this.validator(result)) {
      throw new DeserializationError('Data validation failed after deserialization');
    }
    return result;
  }
  
  getContentType(): string {
    return this.baseSerializer.getContentType();
  }
}

// ============================================================================
// CACHING SERIALIZER
// ============================================================================

/**
 * Serializer that caches serialized/deserialized data
 */
export class CachingSerializer implements Serializer {
  readonly name: string;
  private serializeCache = new Map<any, string>();
  private deserializeCache = new Map<string, any>();
  private readonly maxCacheSize: number;
  
  constructor(
    private readonly baseSerializer: Serializer,
    maxCacheSize: number = 1000
  ) {
    this.name = `caching-${baseSerializer.name}`;
    this.maxCacheSize = maxCacheSize;
  }
  
  serialize<T>(value: T): string {
    const cacheKey = JSON.stringify(value);
    
    if (this.serializeCache.has(cacheKey)) {
      return this.serializeCache.get(cacheKey)!;
    }
    
    const result = this.baseSerializer.serialize(value);
    
    // Manage cache size
    if (this.serializeCache.size >= this.maxCacheSize) {
      const firstKey = this.serializeCache.keys().next().value;
      this.serializeCache.delete(firstKey);
    }
    
    this.serializeCache.set(cacheKey, result);
    return result;
  }
  
  deserialize<T>(data: string): T {
    if (this.deserializeCache.has(data)) {
      return this.deserializeCache.get(data);
    }
    
    const result = this.baseSerializer.deserialize<T>(data);
    
    // Manage cache size
    if (this.deserializeCache.size >= this.maxCacheSize) {
      const firstKey = this.deserializeCache.keys().next().value;
      this.deserializeCache.delete(firstKey);
    }
    
    this.deserializeCache.set(data, result);
    return result;
  }
  
  getContentType(): string {
    return this.baseSerializer.getContentType();
  }
  
  /**
   * Clear caches
   */
  clearCache(): void {
    this.serializeCache.clear();
    this.deserializeCache.clear();
  }
}
