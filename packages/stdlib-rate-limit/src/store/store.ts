/**
 * Base storage implementation and utilities
 */

import { 
  RateLimitStorage, 
  RateLimitBucket, 
  RateLimitBlock, 
  Violation, 
  BucketId, 
  RateLimitKey, 
  IdentifierType 
} from '../types';
import { 
  StorageProvider, 
  StorageConfig, 
  StorageMetrics, 
  StorageEvents, 
  BatchOperation, 
  BatchResult, 
  Transaction, 
  TransactionOptions,
  HealthCheckResult,
  StorageUtils
} from './types';
import { StorageError, StorageTimeoutError } from '../errors';

/**
 * Abstract base class for storage implementations
 */
export abstract class BaseStorageProvider implements StorageProvider {
  protected config: StorageConfig;
  protected metrics: StorageMetrics;
  protected events: Partial<StorageEvents> = {};
  protected isInitialized = false;
  protected isClosed = false;
  
  constructor(config: StorageConfig = {}) {
    this.config = {
      connectionTimeoutMs: 5000,
      requestTimeoutMs: 3000,
      maxRetries: 3,
      retryDelayMs: 1000,
      debug: false,
      ...config,
    };
    
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageOperationTime: 0,
      lastOperationTime: new Date(),
      operationsByType: {},
      connectionStatus: 'disconnected',
      activeConnections: 0,
    };
  }
  
  // ============================================================================
  // ABSTRACT METHODS (must be implemented by subclasses)
  // ============================================================================
  
  abstract initialize(config: StorageConfig): Promise<void>;
  abstract close(): Promise<void>;
  abstract getBucket(bucketId: BucketId): Promise<RateLimitBucket | null>;
  abstract setBucket(bucket: RateLimitBucket): Promise<void>;
  abstract incrementBucket(bucketId: BucketId, amount: number): Promise<RateLimitBucket>;
  abstract deleteBucket(bucketId: BucketId): Promise<boolean>;
  abstract getBlock(key: RateLimitKey, identifierType: IdentifierType): Promise<RateLimitBlock | null>;
  abstract setBlock(block: RateLimitBlock): Promise<void>;
  abstract removeBlock(key: RateLimitKey, identifierType: IdentifierType): Promise<boolean>;
  abstract listBlocks(options?: {
    identifierType?: IdentifierType;
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ blocks: RateLimitBlock[]; total: number }>;
  abstract recordViolation(violation: Violation): Promise<void>;
  abstract getViolations(options?: {
    key?: RateLimitKey;
    identifierType?: IdentifierType;
    configName?: string;
    since?: Date;
    limit?: number;
  }): Promise<{ violations: Violation[]; total: number }>;
  abstract healthCheck(): Promise<boolean>;
  abstract cleanup(olderThanMs: number): Promise<number>;
  
  // ============================================================================
  // DEFAULT IMPLEMENTATIONS
  // ============================================================================
  
  async batch<T>(operations: BatchOperation<T>[], options: { maxBatchSize?: number; timeoutMs?: number; continueOnError?: boolean } = {}): Promise<BatchResult<T>[]> {
    const results: BatchResult<T>[] = [];
    const maxBatchSize = options.maxBatchSize || 100;
    const timeout = options.timeoutMs || 30000;
    const continueOnError = options.continueOnError || false;
    
    // Process in batches
    for (let i = 0; i < operations.length; i += maxBatchSize) {
      const batch = operations.slice(i, i + maxBatchSize);
      
      for (const op of batch) {
        try {
          let result: T | undefined;
          
          switch (op.type) {
            case 'get':
              result = await this.performGet(op.key) as T;
              break;
            case 'create':
            case 'update':
              await this.performSet(op.key, op.value);
              result = op.value;
              break;
            case 'delete':
              await this.performDelete(op.key);
              break;
            default:
              throw new StorageError(`Unknown operation type: ${op.type}`);
          }
          
          results.push({
            success: true,
            key: op.key,
            value: result,
          });
          
        } catch (error) {
          results.push({
            success: false,
            key: op.key,
            error: error as Error,
          });
          
          if (!continueOnError) {
            throw error;
          }
        }
      }
    }
    
    return results;
  }
  
  async beginTransaction(options?: TransactionOptions): Promise<Transaction> {
    // Default implementation doesn't support transactions
    throw new StorageError('Transactions not supported by this storage provider');
  }
  
  async detailedHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const healthy = await this.healthCheck();
      const responseTime = Date.now() - startTime;
      
      return {
        healthy,
        responseTimeMs: responseTime,
        timestamp: new Date(),
        metrics: this.getMetrics(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: false,
        responseTimeMs: responseTime,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }
  
  getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }
  
  on(events: Partial<StorageEvents>): void {
    this.events = { ...this.events, ...events };
  }
  
  // ============================================================================
  // PROTECTED HELPER METHODS
  // ============================================================================
  
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const result = await this.executeWithTimeout(
          operation,
          operationName,
          this.config.requestTimeoutMs!
        );
        
        // Update metrics on success
        this.updateMetrics(operationName, Date.now() - startTime, true);
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.maxRetries!) {
          if (this.config.debug) {
            console.debug(`[Storage] Retry ${attempt + 1}/${this.config.maxRetries} for ${operationName}:`, error);
          }
          
          // Wait before retry
          await this.sleep(this.config.retryDelayMs! * (attempt + 1));
        }
      }
    }
    
    // Update metrics on failure
    this.updateMetrics(operationName, Date.now() - startTime, false);
    
    // Emit error event
    this.events.error?.(lastError!, operationName);
    
    throw lastError!;
  }
  
  protected async executeWithTimeout<T>(
    operation: () => Promise<T>,
    operationName: string,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new StorageTimeoutError(operationName, timeoutMs));
      }, timeoutMs);
      
      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
  
  protected updateMetrics(operation: string, duration: number, success: boolean): void {
    this.metrics.totalOperations++;
    this.metrics.lastOperationTime = new Date();
    
    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
    }
    
    // Update average operation time
    const totalDuration = this.metrics.averageOperationTime * (this.metrics.totalOperations - 1) + duration;
    this.metrics.averageOperationTime = totalDuration / this.metrics.totalOperations;
    
    // Update operations by type
    this.metrics.operationsByType[operation] = (this.metrics.operationsByType[operation] || 0) + 1;
  }
  
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ============================================================================
  // ABSTRACT STORAGE OPERATIONS (to be implemented by subclasses)
  // ============================================================================
  
  protected abstract performGet(key: string): Promise<any>;
  protected abstract performSet(key: string, value: any): Promise<void>;
  protected abstract performDelete(key: string): Promise<void>;
}

/**
 * Storage utilities implementation
 */
export class StorageUtilsImpl implements StorageUtils {
  private readonly keyPrefix: string;
  
  constructor(keyPrefix = 'rl:') {
    this.keyPrefix = keyPrefix;
  }
  
  generateBucketKey(key: RateLimitKey, configName: string): string {
    return `${this.keyPrefix}bucket:${configName}:${key}`;
  }
  
  generateBlockKey(key: RateLimitKey, identifierType: IdentifierType): string {
    return `${this.keyPrefix}block:${identifierType}:${key}`;
  }
  
  generateViolationKey(violationId: string): string {
    return `${this.keyPrefix}violation:${violationId}`;
  }
  
  parseBucketKey(key: string): { key: RateLimitKey; configName: string } | null {
    const pattern = new RegExp(`^${this.keyPrefix}bucket:(.+?):(.+?)$`);
    const match = key.match(pattern);
    
    if (!match) {
      return null;
    }
    
    return {
      configName: match[1],
      key: match[2],
    };
  }
  
  isExpired(timestamp: Date, ttlMs: number): boolean {
    return Date.now() - timestamp.getTime() > ttlMs;
  }
  
  calculateTTL(timestamp: Date, ttlMs: number): number {
    const elapsed = Date.now() - timestamp.getTime();
    return Math.max(0, ttlMs - elapsed);
  }
}

/**
 * Storage factory implementation
 */
export class StorageFactoryImpl {
  private static instance: StorageFactoryImpl;
  private utils: StorageUtils;
  
  private constructor() {
    this.utils = new StorageUtilsImpl();
  }
  
  static getInstance(): StorageFactoryImpl {
    if (!StorageFactoryImpl.instance) {
      StorageFactoryImpl.instance = new StorageFactoryImpl();
    }
    return StorageFactoryImpl.instance;
  }
  
  createMemoryStore(config?: import('./memory').MemoryStoreConfig): StorageProvider {
    const { MemoryStore } = require('./memory');
    return new MemoryStore(config);
  }
  
  createRedisStore(config: import('./types').RedisStoreConfig): StorageProvider {
    const { RedisStore } = require('./redis');
    return new RedisStore(config);
  }
  
  createCustomStore(
    provider: new (config: StorageConfig) => StorageProvider,
    config: StorageConfig
  ): StorageProvider {
    return new provider(config);
  }
  
  getUtils(): StorageUtils {
    return this.utils;
  }
}

/**
 * Global storage factory instance
 */
export const storageFactory = StorageFactoryImpl.getInstance();
