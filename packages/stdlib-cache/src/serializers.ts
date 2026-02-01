/**
 * Cache Serializers - Value serialization for caching.
 */

import type { Serializer } from './types';

/**
 * JSON serializer
 */
export class JsonSerializer implements Serializer {
  serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  deserialize<T>(data: string | Buffer): T {
    const str = typeof data === 'string' ? data : data.toString('utf-8');
    return JSON.parse(str);
  }
}

/**
 * Create a serializer
 */
export function createSerializer(type: 'json'): Serializer {
  switch (type) {
    case 'json':
      return new JsonSerializer();
    default:
      throw new Error(`Unknown serializer type: ${type}`);
  }
}
