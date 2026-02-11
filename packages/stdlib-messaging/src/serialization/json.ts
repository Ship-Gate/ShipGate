/**
 * JSON serializer implementation
 */

import { AbstractSerializer } from './serializer.js';
import { registerSerializer } from './serializer.js';
import { SerializationFormat } from './types.js';
import { SerializationError, DeserializationError } from '../errors.js';

// ============================================================================
// JSON SERIALIZER
// ============================================================================

@registerSerializer(SerializationFormat.JSON)
export class JsonSerializer extends AbstractSerializer {
  readonly name = 'json';
  
  protected doSerialize<T>(value: T, options?: { pretty?: boolean }): string {
    try {
      if (options?.pretty) {
        return JSON.stringify(value, null, 2);
      }
      return JSON.stringify(value);
    } catch (error) {
      throw new SerializationError(
        `JSON serialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  protected doDeserialize<T>(data: string, options?: { allowTrailingCommas?: boolean; allowComments?: boolean }): T {
    try {
      if (options?.allowTrailingCommas || options?.allowComments) {
        // Simple preprocessing for trailing commas and comments
        let processed = data;
        
        // Remove single-line comments
        if (options.allowComments) {
          processed = processed.replace(/\/\/.*$/gm, '');
        }
        
        // Remove trailing commas (simple regex approach)
        if (options.allowTrailingCommas) {
          processed = processed.replace(/,(\s*[}\]])/g, '$1');
        }
        
        return JSON.parse(processed);
      }
      
      return JSON.parse(data);
    } catch (error) {
      throw new DeserializationError(
        `JSON deserialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  getContentType(): string {
    return SerializationFormat.JSON;
  }
}

// ============================================================================
// SAFE JSON SERIALIZER
// ============================================================================

/**
 * JSON serializer that handles circular references and BigInt
 */
export class SafeJsonSerializer extends AbstractSerializer {
  readonly name = 'safe-json';
  
  protected doSerialize<T>(value: T, options?: { pretty?: boolean }): string {
    try {
      const replacer = (key: string, val: any): any => {
        // Handle BigInt
        if (typeof val === 'bigint') {
          return { __type: 'bigint', value: val.toString() };
        }
        
        // Handle Date
        if (val instanceof Date) {
          return { __type: 'date', value: val.toISOString() };
        }
        
        // Handle RegExp
        if (val instanceof RegExp) {
          return { __type: 'regexp', value: val.source, flags: val.flags };
        }
        
        // Handle Error
        if (val instanceof Error) {
          return {
            __type: 'error',
            name: val.name,
            message: val.message,
            stack: val.stack,
          };
        }
        
        // Handle circular references
        if (typeof val === 'object' && val !== null) {
          if (this.seen.has(val)) {
            return '[Circular]';
          }
          this.seen.add(val);
        }
        
        return val;
      };
      
      // Reset seen set for each serialization
      this.seen = new WeakSet();
      
      if (options?.pretty) {
        return JSON.stringify(value, replacer, 2);
      }
      return JSON.stringify(value, replacer);
    } catch (error) {
      throw new SerializationError(
        `Safe JSON serialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  protected doDeserialize<T>(data: string): T {
    try {
      const reviver = (key: string, val: any): any => {
        if (val && typeof val === 'object' && val.__type) {
          switch (val.__type) {
            case 'bigint':
              return BigInt(val.value);
            case 'date':
              return new Date(val.value);
            case 'regexp':
              return new RegExp(val.value, val.flags);
            case 'error':
              const error = new Error(val.message);
              error.name = val.name;
              error.stack = val.stack;
              return error;
          }
        }
        return val;
      };
      
      return JSON.parse(data, reviver);
    } catch (error) {
      throw new DeserializationError(
        `Safe JSON deserialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  getContentType(): string {
    return SerializationFormat.JSON;
  }
  
  private seen = new WeakSet();
}

// ============================================================================
// STREAMING JSON SERIALIZER
// ============================================================================

/**
 * JSON serializer for streaming large data sets
 */
export class StreamingJsonSerializer extends AbstractSerializer {
  readonly name = 'streaming-json';
  
  /**
   * Serialize an iterable of items as a JSON array stream
   */
  serializeStream<T>(items: Iterable<T>): AsyncIterable<string> {
    const encoder = new TextEncoder();
    
    return {
      [Symbol.asyncIterator]() {
        let iterator = items[Symbol.iterator]();
        let isFirst = true;
        
        return {
          async next(): Promise<IteratorResult<string>> {
            if (isFirst) {
              isFirst = false;
              return { value: '[', done: false };
            }
            
            const result = iterator.next();
            if (result.done) {
              return { value: ']', done: false };
            }
            
            const json = JSON.stringify(result.value);
            return { value: ',' + json, done: false };
          },
        };
      },
    };
  }
  
  /**
   * Deserialize a JSON stream
   */
  async *deserializeStream<T>(chunks: AsyncIterable<string>): AsyncIterable<T> {
    let buffer = '';
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;
    
    for await (const chunk of chunks) {
      buffer += chunk;
      
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (inString) continue;
        
        if (char === '{' || char === '[') {
          bracketCount++;
        } else if (char === '}' || char === ']') {
          bracketCount--;
          
          if (bracketCount === 0) {
            const jsonStr = buffer.slice(start, i + 1);
            try {
              const parsed = JSON.parse(jsonStr);
              yield parsed;
            } catch (error) {
              throw new DeserializationError(
                `Failed to parse JSON chunk: ${error instanceof Error ? error.message : String(error)}`
              );
            }
            
            start = i + 1;
          }
        }
      }
      
      if (start > 0) {
        buffer = buffer.slice(start);
      }
    }
  }
  
  protected doSerialize<T>(value: T): string {
    return JSON.stringify(value);
  }
  
  protected doDeserialize<T>(data: string): T {
    return JSON.parse(data);
  }
  
  getContentType(): string {
    return SerializationFormat.JSON;
  }
}
