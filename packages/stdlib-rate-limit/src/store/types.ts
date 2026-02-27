/**
 * Types and interfaces for rate limit storage implementations
 */

import { RateLimitStorage, RateLimitBucket, RateLimitBlock, Violation, BucketId, RateLimitKey, IdentifierType } from '../types';

// ============================================================================
// STORAGE CONFIGURATION
// ============================================================================

export interface StorageConfig {
  /**
   * Connection timeout in milliseconds
   */
  connectionTimeoutMs?: number;
  
  /**
   * Request timeout in milliseconds
   */
  requestTimeoutMs?: number;
  
  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;
  
  /**
   * Delay between retry attempts in milliseconds
   */
  retryDelayMs?: number;
  
  /**
   * Enable debug logging
   */
  debug?: boolean;
  
  /**
   * Custom error handler
   */
  onError?: (error: Error, operation: string) => void;
}

// ============================================================================
// STORAGE METRICS
// ============================================================================

export interface StorageMetrics {
  /**
   * Total operations performed
   */
  totalOperations: number;
  
  /**
   * Successful operations
   */
  successfulOperations: number;
  
  /**
   * Failed operations
   */
  failedOperations: number;
  
  /**
   * Average operation time in milliseconds
   */
  averageOperationTime: number;
  
  /**
   * Last operation timestamp
   */
  lastOperationTime: Date;
  
  /**
   * Operations by type
   */
  operationsByType: Record<string, number>;
  
  /**
   * Connection status
   */
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  
  /**
   * Number of active connections
   */
  activeConnections: number;
}

// ============================================================================
// STORAGE EVENTS
// ============================================================================

export interface StorageEvents {
  /**
   * Fired when a connection is established
   */
  connect?: () => void;
  
  /**
   * Fired when a connection is lost
   */
  disconnect?: (error?: Error) => void;
  
  /**
   * Fired when reconnecting
   */
  reconnecting?: (attempt: number) => void;
  
  /**
   * Fired when an operation fails
   */
  error?: (error: Error, operation: string) => void;
  
  /**
   * Fired when cleanup is performed
   */
  cleanup?: (deletedCount: number) => void;
}

// ============================================================================
// SERIALIZATION TYPES
// ============================================================================

export interface Serializer {
  /**
   * Serialize a value to string
   */
  serialize(value: any): string;
  
  /**
   * Deserialize a value from string
   */
  deserialize<T>(value: string): T;
}

export interface SerializationOptions {
  /**
   * Serialization format
   */
  format?: 'json' | 'protobuf' | 'msgpack' | 'custom';
  
  /**
   * Enable compression
   */
  compression?: boolean;
  
  /**
   * Custom serializer
   */
  customSerializer?: Serializer;
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export interface CacheConfig {
  /**
   * Enable caching
   */
  enabled?: boolean;
  
  /**
   * Cache TTL in milliseconds
   */
  ttlMs?: number;
  
  /**
   * Maximum cache size
   */
  maxSize?: number;
  
  /**
   * Cache eviction policy
   */
  evictionPolicy?: 'lru' | 'lfu' | 'fifo';
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

export interface BatchOperation<T> {
  type: 'create' | 'update' | 'delete' | 'get';
  key: string;
  value?: T;
}

export interface BatchResult<T> {
  success: boolean;
  key: string;
  value?: T;
  error?: Error;
}

export interface BatchOptions {
  /**
   * Maximum batch size
   */
  maxBatchSize?: number;
  
  /**
   * Timeout for batch operations
   */
  timeoutMs?: number;
  
  /**
   * Continue on error
   */
  continueOnError?: boolean;
}

// ============================================================================
// TRANSACTION SUPPORT
// ============================================================================

export interface Transaction {
  /**
   * Transaction ID
   */
  id: string;
  
  /**
   * Transaction status
   */
  status: 'pending' | 'committed' | 'rolled_back';
  
  /**
   * Operations in the transaction
   */
  operations: Array<{
    type: string;
    key: string;
    value?: any;
  }>;
  
  /**
   * Start time
   */
  startTime: Date;
  
  /**
   * Commit or rollback the transaction
   */
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface TransactionOptions {
  /**
   * Transaction timeout in milliseconds
   */
  timeoutMs?: number;
  
  /**
   * Isolation level
   */
  isolationLevel?: 'read_committed' | 'repeatable_read' | 'serializable';
}

// ============================================================================
// STORAGE HEALTH
// ============================================================================

export interface HealthCheckResult {
  /**
   * Overall health status
   */
  healthy: boolean;
  
  /**
   * Response time in milliseconds
   */
  responseTimeMs: number;
  
  /**
   * Additional health metrics
   */
  metrics?: Record<string, any>;
  
  /**
   * Error details if unhealthy
   */
  error?: string;
  
  /**
   * Timestamp of the check
   */
  timestamp: Date;
}

// ============================================================================
// STORAGE PROVIDER INTERFACE
// ============================================================================

export interface StorageProvider extends RateLimitStorage {
  /**
   * Initialize the storage provider
   */
  initialize(config: StorageConfig): Promise<void>;
  
  /**
   * Close the storage provider and cleanup resources
   */
  close(): Promise<void>;
  
  /**
   * Get storage metrics
   */
  getMetrics(): StorageMetrics;
  
  /**
   * Perform a batch of operations
   */
  batch<T>(operations: BatchOperation<T>[], options?: BatchOptions): Promise<BatchResult<T>[]>;
  
  /**
   * Begin a transaction
   */
  beginTransaction(options?: TransactionOptions): Promise<Transaction>;
  
  /**
   * Register event handlers
   */
  on(events: Partial<StorageEvents>): void;
  
  /**
   * Perform health check
   */
  detailedHealthCheck(): Promise<HealthCheckResult>;
}

// ============================================================================
// MEMORY STORE SPECIFIC TYPES
// ============================================================================

export interface MemoryStoreConfig extends StorageConfig {
  /**
   * Cleanup interval in milliseconds
   */
  cleanupIntervalMs?: number;
  
  /**
   * Maximum number of buckets to store
   */
  maxBuckets?: number;
  
  /**
   * Maximum number of blocks to store
   */
  maxBlocks?: number;
  
  /**
   * Maximum number of violations to store
   */
  maxViolations?: number;
  
  /**
   * Cache configuration
   */
  cache?: CacheConfig;
}

// ============================================================================
// REDIS STORE SPECIFIC TYPES
// ============================================================================

export interface RedisStoreConfig extends StorageConfig {
  /**
   * Redis connection URL
   */
  url?: string;
  
  /**
   * Redis host
   */
  host?: string;
  
  /**
   * Redis port
   */
  port?: number;
  
  /**
   * Redis password
   */
  password?: string;
  
  /**
   * Redis database number
   */
  db?: number;
  
  /**
   * Key prefix for rate limit data
   */
  keyPrefix?: string;
  
  /**
   * Connection pool configuration
   */
  pool?: {
    min?: number;
    max?: number;
    acquireTimeoutMillis?: number;
    createTimeoutMillis?: number;
    destroyTimeoutMillis?: number;
    idleTimeoutMillis?: number;
    reapIntervalMillis?: number;
  };
  
  /**
   * Cluster configuration
   */
  cluster?: {
    nodes: Array<{ host: string; port: number }>;
    options?: Record<string, any>;
  };
  
  /**
   * Sentinel configuration
   */
  sentinel?: {
    sentinels: Array<{ host: string; port: number }>;
    name: string;
    password?: string;
  };
}

// ============================================================================
// STORAGE FACTORY
// ============================================================================

export interface StorageFactory {
  /**
   * Create a memory store
   */
  createMemoryStore(config?: MemoryStoreConfig): StorageProvider;
  
  /**
   * Create a Redis store
   */
  createRedisStore(config: RedisStoreConfig): StorageProvider;
  
  /**
   * Create a custom store
   */
  createCustomStore(provider: new (config: StorageConfig) => StorageProvider, config: StorageConfig): StorageProvider;
}

// ============================================================================
// STORAGE UTILITIES
// ============================================================================

export interface StorageUtils {
  /**
   * Generate a bucket key
   */
  generateBucketKey(key: RateLimitKey, configName: string): string;
  
  /**
   * Generate a block key
   */
  generateBlockKey(key: RateLimitKey, identifierType: IdentifierType): string;
  
  /**
   * Generate a violation key
   */
  generateViolationKey(violationId: string): string;
  
  /**
   * Parse a bucket key
   */
  parseBucketKey(key: string): { key: RateLimitKey; configName: string } | null;
  
  /**
   * Check if a key has expired
   */
  isExpired(timestamp: Date, ttlMs: number): boolean;
  
  /**
   * Calculate TTL for a timestamp
   */
  calculateTTL(timestamp: Date, ttlMs: number): number;
}
