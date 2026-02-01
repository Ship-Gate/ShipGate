# ISL stdlib-cache

Standard library module for caching with ISL verification. Supports Redis, Memcached, and in-memory caching with automatic contract verification.

## Features

- **Multiple Backends**: Redis, Memcached, In-Memory (LRU)
- **ISL Verified**: Pre/postcondition checking on all operations
- **Type-Safe**: Full TypeScript support with generics
- **TTL Support**: Time-to-live for cache entries
- **Namespacing**: Prefix-based key namespacing
- **Serialization**: JSON, MessagePack, custom serializers
- **Cache-Aside Pattern**: Built-in cache-aside helpers
- **Distributed Locking**: Redis-based distributed locks

## Installation

```bash
npm install @isl/stdlib-cache
```

## Quick Start

### In-Memory Cache

```typescript
import { createInMemoryCache } from '@isl/stdlib-cache';

const cache = createInMemoryCache<User>({
  maxSize: 1000,
  ttl: 60 * 1000, // 1 minute
});

// Set value
await cache.set('user:123', user);

// Get value
const result = await cache.get('user:123');
if (result.ok) {
  console.log(result.data);
}

// Cache-aside pattern
const user = await cache.getOrSet('user:123', async () => {
  return await fetchUserFromDatabase('123');
});
```

### Redis Cache

```typescript
import { createRedisCache } from '@isl/stdlib-cache';

const cache = createRedisCache<User>({
  host: 'localhost',
  port: 6379,
  password: 'secret',
  keyPrefix: 'myapp:',
});

await cache.set('user:123', user, { ttl: 3600 });
const user = await cache.get('user:123');
```

### Multi-Level Cache

```typescript
import { createMultiLevelCache } from '@isl/stdlib-cache';

const cache = createMultiLevelCache<User>({
  levels: [
    { type: 'memory', maxSize: 100, ttl: 60000 },
    { type: 'redis', host: 'localhost', ttl: 3600000 },
  ],
});

// Reads from L1 first, then L2, populates up
const user = await cache.get('user:123');
```

## ISL Intent Definition

```isl
domain Cache {
  type CacheKey = String
  type TTL = Duration
  
  entity CacheEntry<T> {
    key: CacheKey
    value: T
    createdAt: Timestamp
    expiresAt: Timestamp?
    metadata: Map<String, String>?
  }
  
  behavior Get<T> {
    input { key: CacheKey }
    output {
      | Hit { entry: CacheEntry<T> }
      | Miss
      | Error { message: String }
    }
    
    postcondition {
      result is Hit implies result.entry.key == input.key
    }
  }
  
  behavior Set<T> {
    input {
      key: CacheKey
      value: T
      ttl: TTL?
    }
    output {
      | Success
      | Error { message: String }
    }
    
    postcondition {
      result is Success implies Get(key) is Hit
    }
  }
  
  behavior Delete {
    input { key: CacheKey }
    output {
      | Deleted
      | NotFound
      | Error { message: String }
    }
    
    postcondition {
      result is Deleted implies Get(key) is Miss
    }
  }
  
  behavior GetOrSet<T> {
    input {
      key: CacheKey
      factory: () -> T
      ttl: TTL?
    }
    output {
      | Success { value: T, fromCache: Boolean }
      | Error { message: String }
    }
    
    postcondition {
      result is Success implies Get(key) is Hit
    }
  }
}
```

## API Reference

### Cache Interface

```typescript
interface Cache<T> {
  get(key: string): Promise<CacheResult<T>>;
  set(key: string, value: T, options?: SetOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getOrSet(key: string, factory: () => Promise<T>, options?: SetOptions): Promise<T>;
  mget(keys: string[]): Promise<Map<string, T>>;
  mset(entries: Map<string, T>, options?: SetOptions): Promise<void>;
}
```

### Options

```typescript
interface SetOptions {
  ttl?: number;           // Time-to-live in milliseconds
  tags?: string[];        // Tags for bulk invalidation
  metadata?: Record<string, string>;
}

interface CacheConfig {
  keyPrefix?: string;     // Prefix for all keys
  serializer?: Serializer; // Custom serializer
  defaultTtl?: number;    // Default TTL
}
```

## License

MIT License
