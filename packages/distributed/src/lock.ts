/**
 * Distributed Locking
 * Coordination primitives for distributed ISL execution
 */

import { DistributedLock, LockOptions } from './types';

/**
 * Default lock options
 */
const DEFAULT_LOCK_OPTIONS: LockOptions = {
  ttl: 30000,
  retryDelay: 100,
  maxRetries: 50,
  fencing: true,
};

/**
 * Lock manager interface
 */
export interface LockManager {
  acquire(key: string, options?: Partial<LockOptions>): Promise<LockHandle>;
  release(handle: LockHandle): Promise<boolean>;
  extend(handle: LockHandle, ttl: number): Promise<boolean>;
  isLocked(key: string): Promise<boolean>;
}

/**
 * Lock handle returned when acquiring a lock
 */
export interface LockHandle {
  key: string;
  token: string;
  fenceToken: number;
  expiresAt: number;
}

/**
 * In-memory lock manager
 */
export class InMemoryLockManager implements LockManager {
  private locks: Map<string, DistributedLock> = new Map();
  private fenceTokenCounter = 0;

  async acquire(key: string, options: Partial<LockOptions> = {}): Promise<LockHandle> {
    const opts = { ...DEFAULT_LOCK_OPTIONS, ...options };
    const owner = this.generateToken();
    let attempts = 0;

    while (attempts < opts.maxRetries) {
      const existing = this.locks.get(key);

      if (!existing || existing.expiresAt < Date.now()) {
        // Lock is available
        const fenceToken = ++this.fenceTokenCounter;
        const now = Date.now();
        const expiresAt = now + opts.ttl;

        const lock: DistributedLock = {
          key,
          owner,
          acquiredAt: now,
          expiresAt,
          fenceToken,
        };

        this.locks.set(key, lock);

        return {
          key,
          token: owner,
          fenceToken,
          expiresAt,
        };
      }

      // Wait and retry
      await this.sleep(opts.retryDelay);
      attempts++;
    }

    throw new LockAcquisitionError(`Failed to acquire lock for ${key} after ${attempts} attempts`);
  }

  async release(handle: LockHandle): Promise<boolean> {
    const lock = this.locks.get(handle.key);

    if (!lock || lock.owner !== handle.token) {
      return false;
    }

    this.locks.delete(handle.key);
    return true;
  }

  async extend(handle: LockHandle, ttl: number): Promise<boolean> {
    const lock = this.locks.get(handle.key);

    if (!lock || lock.owner !== handle.token) {
      return false;
    }

    lock.expiresAt = Date.now() + ttl;
    return true;
  }

  async isLocked(key: string): Promise<boolean> {
    const lock = this.locks.get(key);
    return !!lock && lock.expiresAt > Date.now();
  }

  private generateToken(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Lock acquisition error
 */
export class LockAcquisitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockAcquisitionError';
  }
}

/**
 * Mutex - simple mutual exclusion
 */
export class DistributedMutex {
  private handle?: LockHandle;

  constructor(
    private lockManager: LockManager,
    private key: string,
    private options: Partial<LockOptions> = {}
  ) {}

  async lock(): Promise<void> {
    this.handle = await this.lockManager.acquire(this.key, this.options);
  }

  async unlock(): Promise<void> {
    if (this.handle) {
      await this.lockManager.release(this.handle);
      this.handle = undefined;
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.lock();
    try {
      return await fn();
    } finally {
      await this.unlock();
    }
  }

  getFenceToken(): number | undefined {
    return this.handle?.fenceToken;
  }
}

/**
 * Read-write lock
 */
export class ReadWriteLock {
  private readers = 0;
  private writer = false;
  private writerQueue: Array<() => void> = [];
  private readerQueue: Array<() => void> = [];

  async readLock(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.writer && this.writerQueue.length === 0) {
        this.readers++;
        resolve();
      } else {
        this.readerQueue.push(() => {
          this.readers++;
          resolve();
        });
      }
    });
  }

  readUnlock(): void {
    this.readers--;
    if (this.readers === 0 && this.writerQueue.length > 0) {
      const next = this.writerQueue.shift();
      if (next) next();
    }
  }

  async writeLock(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.writer && this.readers === 0) {
        this.writer = true;
        resolve();
      } else {
        this.writerQueue.push(() => {
          this.writer = true;
          resolve();
        });
      }
    });
  }

  writeUnlock(): void {
    this.writer = false;
    if (this.writerQueue.length > 0) {
      const next = this.writerQueue.shift();
      if (next) next();
    } else {
      while (this.readerQueue.length > 0) {
        const next = this.readerQueue.shift();
        if (next) next();
      }
    }
  }

  async withReadLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.readLock();
    try {
      return await fn();
    } finally {
      this.readUnlock();
    }
  }

  async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.writeLock();
    try {
      return await fn();
    } finally {
      this.writeUnlock();
    }
  }
}

/**
 * Semaphore
 */
export class DistributedSemaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waiting.push(() => {
          this.permits--;
          resolve();
        });
      }
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next) next();
    }
  }

  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  availablePermits(): number {
    return this.permits;
  }
}

/**
 * Create lock manager
 */
export function createLockManager(): LockManager {
  return new InMemoryLockManager();
}

/**
 * Create mutex
 */
export function createMutex(
  lockManager: LockManager,
  key: string,
  options?: Partial<LockOptions>
): DistributedMutex {
  return new DistributedMutex(lockManager, key, options);
}
