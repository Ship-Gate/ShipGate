import { Clock, Random } from '../types';
import { BloomFilter } from './bloom';
import { DeduplicatorOptions, DeduplicationResult, CacheEntry } from './types';
import { LRUCache } from 'lru-cache';

/**
 * Deduplicator using Bloom filter and time-based cache
 */
export class Deduplicator {
  private bloomFilter: BloomFilter;
  private cache: LRUCache<string, CacheEntry>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private clock: Clock,
    private random: Random,
    private options: DeduplicatorOptions = {}
  ) {
    // Initialize Bloom filter
    this.bloomFilter = new BloomFilter(
      {
        expectedItems: options.bloomFilter?.expectedItems || 10000,
        falsePositiveRate: options.bloomFilter?.falsePositiveRate || 0.01,
        seed: options.bloomFilter?.seed
      },
      random
    );

    // Initialize LRU cache
    this.cache = new LRUCache<string, CacheEntry>({
      max: options.maxCacheSize || 10000,
      ttl: options.timeWindow || 300000, // 5 minutes default
      updateAgeOnGet: true
    });

    // Setup cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Check if item is duplicate
   */
  check(item: string): DeduplicationResult {
    const now = this.clock.now();
    
    // First check Bloom filter
    if (!this.bloomFilter.mightContain(item)) {
      // Definitely not seen before
      this.bloomFilter.add(item);
      this.cache.set(item, {
        hash: item,
        firstSeen: now,
        lastSeen: now,
        count: 1
      });
      
      return {
        isDuplicate: false,
        firstSeen: now,
        count: 1
      };
    }

    // Might be duplicate, check cache
    const cached = this.cache.get(item);
    
    if (cached) {
      // Definitely duplicate
      const updated: CacheEntry = {
        ...cached,
        lastSeen: now,
        count: cached.count + 1
      };
      
      this.cache.set(item, updated);
      
      return {
        isDuplicate: true,
        firstSeen: cached.firstSeen,
        count: updated.count
      };
    }

    // False positive from Bloom filter
    this.cache.set(item, {
      hash: item,
      firstSeen: now,
      lastSeen: now,
      count: 1
    });
    
    return {
      isDuplicate: false,
      firstSeen: now,
      count: 1
    };
  }

  /**
   * Mark item as seen
   */
  add(item: string): void {
    const now = this.clock.now();
    
    // Add to Bloom filter
    this.bloomFilter.add(item);
    
    // Update cache
    const cached = this.cache.get(item);
    if (cached) {
      this.cache.set(item, {
        ...cached,
        lastSeen: now,
        count: cached.count + 1
      });
    } else {
      this.cache.set(item, {
        hash: item,
        firstSeen: now,
        lastSeen: now,
        count: 1
      });
    }
  }

  /**
   * Remove item from cache (not Bloom filter)
   */
  remove(item: string): boolean {
    return this.cache.delete(item);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.bloomFilter.clear();
    this.cache.clear();
  }

  /**
   * Get statistics
   */
  stats() {
    return {
      bloomFilter: this.bloomFilter.stats(),
      cache: {
        size: this.cache.size,
        maxSize: this.cache.max,
        totalItems: this.cache.size
      }
    };
  }

  /**
   * Check if item exists (without updating)
   */
  has(item: string): boolean {
    const cached = this.cache.get(item);
    if (cached) {
      return true;
    }
    
    return this.bloomFilter.mightContain(item);
  }

  /**
   * Get cache entry for item
   */
  getEntry(item: string): CacheEntry | undefined {
    return this.cache.get(item);
  }

  /**
   * Close deduplicator and cleanup
   */
  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.clear();
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    // LRU cache handles TTL automatically
    // This can be extended for additional cleanup logic
  }

  /**
   * Export current state
   */
  export() {
    const entries: Array<[string, CacheEntry]> = [];
    
    for (const [key, value] of this.cache.entries()) {
      entries.push([key, value]);
    }
    
    return {
      entries,
      bloomFilterStats: this.bloomFilter.stats()
    };
  }

  /**
   * Import state
   */
  import(data: { entries: Array<[string, CacheEntry]> }): void {
    this.clear();
    
    for (const [key, entry] of data.entries) {
      this.bloomFilter.add(key);
      this.cache.set(key, entry);
    }
  }
}
