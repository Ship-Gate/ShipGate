/**
 * Types for deduplication
 */

export interface BloomFilterOptions {
  /** Expected number of items */
  expectedItems: number;
  /** Desired false positive rate (0-1) */
  falsePositiveRate: number;
  /** Random seed for hash functions */
  seed?: number;
}

export interface DeduplicatorOptions {
  /** Bloom filter configuration */
  bloomFilter?: BloomFilterOptions;
  /** Time window for deduplication in milliseconds */
  timeWindow?: number;
  /** Maximum number of cached hashes */
  maxCacheSize?: number;
}

export interface DeduplicationResult {
  /** Whether this is a duplicate */
  isDuplicate: boolean;
  /** First seen timestamp */
  firstSeen?: Date;
  /** Count of occurrences */
  count?: number;
}

export interface CacheEntry {
  hash: string;
  firstSeen: Date;
  lastSeen: Date;
  count: number;
}
