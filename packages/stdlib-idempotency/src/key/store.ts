import { Clock, Random, StorageAdapter, IdempotencyRecord, RecordStatus } from '../types';
import { StoreOptions } from './types';
import { createIdempotencyError, IdempotencyErrorCode } from '../errors';

export class InMemoryStore implements StorageAdapter {
  private records = new Map<string, IdempotencyRecord>();
  private locks = new Map<string, { token: string; expiresAt: Date }>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private clock: Clock,
    private random: Random,
    private options: StoreOptions
  ) {
    if (this.options.cleanupInterval) {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        this.options.cleanupInterval
      );
    }
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const record = this.records.get(key);
    if (!record) {
      return null;
    }

    // Check if expired
    if (this.clock.now() > record.expiresAt) {
      this.records.delete(key);
      return null;
    }

    return { ...record };
  }

  async create(record: IdempotencyRecord): Promise<void> {
    // Check max records limit
    if (this.options.maxRecords && this.records.size >= this.options.maxRecords) {
      throw createIdempotencyError(
        IdempotencyErrorCode.STORAGE_ERROR,
        'Store has reached maximum record limit'
      );
    }

    // Check if already exists
    if (this.records.has(record.key)) {
      throw createIdempotencyError(
        IdempotencyErrorCode.CONCURRENT_REQUEST,
        'Record already exists'
      );
    }

    this.records.set(record.key, { ...record });
  }

  async update(key: string, updates: Partial<IdempotencyRecord>): Promise<void> {
    const record = this.records.get(key);
    if (!record) {
      throw createIdempotencyError(
        IdempotencyErrorCode.RECORD_NOT_FOUND,
        `Record not found: ${key}`
      );
    }

    // Check if expired
    if (this.clock.now() > record.expiresAt) {
      this.records.delete(key);
      throw createIdempotencyError(
        IdempotencyErrorCode.RECORD_NOT_FOUND,
        `Record expired: ${key}`
      );
    }

    this.records.set(key, { ...record, ...updates, updatedAt: this.clock.now() });
  }

  async delete(key: string): Promise<void> {
    this.records.delete(key);
    this.locks.delete(key);
  }

  async acquireLock(key: string, lockToken: string, expiresAt: Date): Promise<boolean> {
    const existing = this.locks.get(key);
    
    // Check if lock exists and hasn't expired
    if (existing && this.clock.now() <= existing.expiresAt) {
      return false;
    }

    this.locks.set(key, { token: lockToken, expiresAt });
    return true;
  }

  async releaseLock(key: string, lockToken: string): Promise<boolean> {
    const existing = this.locks.get(key);
    
    if (!existing || existing.token !== lockToken) {
      return false;
    }

    this.locks.delete(key);
    return true;
  }

  /**
   * Clean up expired records and locks
   */
  private cleanup(): void {
    const now = this.clock.now();
    
    // Clean up expired records
    for (const [key, record] of this.records.entries()) {
      if (now > record.expiresAt) {
        this.records.delete(key);
        this.locks.delete(key);
      }
    }

    // Clean up expired locks
    for (const [key, lock] of this.locks.entries()) {
      if (now > lock.expiresAt) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Close the store and cleanup timers
   */
  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.records.clear();
    this.locks.clear();
  }

  /**
   * Get store statistics
   */
  stats() {
    return {
      records: this.records.size,
      locks: this.locks.size,
      maxRecords: this.options.maxRecords
    };
  }
}
