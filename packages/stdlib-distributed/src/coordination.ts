// ============================================================================
// ISL Standard Library - Coordination (Leader Election & Distributed Locks)
// @isl-lang/stdlib-distributed/coordination
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export type NodeId = string;

export interface LockHandle {
  resource: string;
  owner: NodeId;
  token: string;
  acquiredAt: Date;
  expiresAt: Date;
}

export interface ElectionResult {
  isLeader: boolean;
  leader: NodeId;
  term: number;
  leaseExpiry: Date;
}

export interface LeadershipCallback {
  onBecomeLeader: () => void;
  onLoseLeadership: () => void;
}

// ============================================================================
// DISTRIBUTED LOCK (In-Memory for single process, can be backed by Redis/etcd)
// ============================================================================

export class DistributedLock {
  private locks = new Map<string, LockHandle>();
  private waiters = new Map<string, Array<{
    owner: NodeId;
    ttlMs: number;
    resolve: (handle: LockHandle | null) => void;
    timeout: NodeJS.Timeout;
  }>>();

  /**
   * Acquire a distributed lock.
   */
  async acquire(
    resource: string,
    owner: NodeId,
    ttlMs: number,
    waitTimeoutMs?: number
  ): Promise<LockAcquireResult> {
    const existing = this.locks.get(resource);
    
    // Check if lock is held and not expired
    if (existing && existing.expiresAt > new Date()) {
      if (existing.owner === owner) {
        // Extend the lock
        return this.extend(existing.token, ttlMs);
      }

      if (waitTimeoutMs) {
        // Wait for lock to be released
        return this.waitForLock(resource, owner, ttlMs, waitTimeoutMs);
      }

      return {
        success: false,
        error: 'lock_held',
        holder: existing.owner,
        expiresAt: existing.expiresAt,
      };
    }

    // Acquire the lock
    const handle: LockHandle = {
      resource,
      owner,
      token: crypto.randomUUID(),
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + ttlMs),
    };

    this.locks.set(resource, handle);

    // Schedule auto-release
    setTimeout(() => {
      const current = this.locks.get(resource);
      if (current?.token === handle.token) {
        this.release(handle);
      }
    }, ttlMs);

    return { success: true, handle };
  }

  /**
   * Release a distributed lock.
   */
  async release(handle: LockHandle): Promise<LockReleaseResult> {
    const existing = this.locks.get(handle.resource);

    if (!existing) {
      return { success: false, error: 'lock_not_held' };
    }

    if (existing.token !== handle.token) {
      return { success: false, error: 'token_mismatch' };
    }

    this.locks.delete(handle.resource);

    // Notify waiters
    const waiters = this.waiters.get(handle.resource);
    if (waiters && waiters.length > 0) {
      const next = waiters.shift()!;
      clearTimeout(next.timeout);
      
      const newHandle: LockHandle = {
        resource: handle.resource,
        owner: next.owner,
        token: crypto.randomUUID(),
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + next.ttlMs),
      };
      
      this.locks.set(handle.resource, newHandle);
      next.resolve(newHandle);
    }

    return { success: true };
  }

  /**
   * Extend a lock's TTL.
   */
  async extend(token: string, additionalTtlMs: number): Promise<LockAcquireResult> {
    for (const [_resource, handle] of this.locks) {
      if (handle.token === token) {
        handle.expiresAt = new Date(Date.now() + additionalTtlMs);
        return { success: true, handle };
      }
    }
    return { success: false, error: 'lock_not_found' };
  }

  /**
   * Check if a lock is held.
   */
  isLocked(resource: string): boolean {
    const lock = this.locks.get(resource);
    return lock !== undefined && lock.expiresAt > new Date();
  }

  /**
   * Get lock info.
   */
  getLockInfo(resource: string): LockHandle | null {
    const lock = this.locks.get(resource);
    if (lock && lock.expiresAt > new Date()) {
      return lock;
    }
    return null;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private waitForLock(
    resource: string,
    owner: NodeId,
    ttlMs: number,
    waitTimeoutMs: number
  ): Promise<LockAcquireResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        const waiters = this.waiters.get(resource);
        if (waiters) {
          const index = waiters.findIndex(w => w.owner === owner);
          if (index !== -1) {
            waiters.splice(index, 1);
          }
        }
        resolve({ success: false, error: 'timeout' });
      }, waitTimeoutMs);

      if (!this.waiters.has(resource)) {
        this.waiters.set(resource, []);
      }

      this.waiters.get(resource)!.push({
        owner,
        ttlMs,
        resolve: (handle) => {
          if (handle) {
            resolve({ success: true, handle });
          } else {
            resolve({ success: false, error: 'cancelled' });
          }
        },
        timeout,
      });
    });
  }
}

export type LockAcquireResult =
  | { success: true; handle: LockHandle }
  | { success: false; error: string; holder?: NodeId; expiresAt?: Date };

export type LockReleaseResult =
  | { success: true }
  | { success: false; error: string };

// ============================================================================
// LEADER ELECTION
// ============================================================================

export class LeaderElection {
  private nodeId: NodeId;
  private electionName: string;
  private leaseDurationMs: number;
  private callbacks: LeadershipCallback;
  private lock: DistributedLock;
  private handle?: LockHandle;
  private renewalTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    nodeId: NodeId,
    electionName: string,
    leaseDurationMs: number,
    callbacks: LeadershipCallback,
    lock?: DistributedLock
  ) {
    this.nodeId = nodeId;
    this.electionName = electionName;
    this.leaseDurationMs = leaseDurationMs;
    this.callbacks = callbacks;
    this.lock = lock ?? new DistributedLock();
  }

  /**
   * Start participating in leader election.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.tryBecomeLeader();
  }

  /**
   * Stop participating in leader election.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = undefined;
    }

    if (this.handle) {
      const wasLeader = this.isLeader();
      await this.lock.release(this.handle);
      this.handle = undefined;
      if (wasLeader) {
        this.callbacks.onLoseLeadership();
      }
    }
  }

  /**
   * Check if this node is currently the leader.
   */
  isLeader(): boolean {
    return this.handle !== undefined && this.handle.expiresAt > new Date();
  }

  /**
   * Get current election result.
   */
  getElectionResult(): ElectionResult | null {
    const lockInfo = this.lock.getLockInfo(this.electionName);
    if (!lockInfo) return null;

    return {
      isLeader: lockInfo.owner === this.nodeId,
      leader: lockInfo.owner,
      term: 1, // Simplified - real implementation would track terms
      leaseExpiry: lockInfo.expiresAt,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async tryBecomeLeader(): Promise<void> {
    if (!this.isRunning) return;

    const result = await this.lock.acquire(
      this.electionName,
      this.nodeId,
      this.leaseDurationMs
    );

    if (result.success) {
      const wasLeader = this.handle !== undefined;
      this.handle = result.handle;

      if (!wasLeader) {
        this.callbacks.onBecomeLeader();
      }

      // Schedule lease renewal
      this.scheduleRenewal();
    } else {
      // Schedule retry
      setTimeout(() => this.tryBecomeLeader(), this.leaseDurationMs / 3);
    }
  }

  private scheduleRenewal(): void {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
    }

    this.renewalTimer = setInterval(async () => {
      if (!this.isRunning || !this.handle) {
        if (this.renewalTimer) clearInterval(this.renewalTimer);
        return;
      }

      const result = await this.lock.extend(
        this.handle.token,
        this.leaseDurationMs
      );

      if (!result.success) {
        // Lost leadership
        const wasLeader = this.isLeader();
        this.handle = undefined;
        if (wasLeader) {
          this.callbacks.onLoseLeadership();
        }
        // Try to become leader again
        this.tryBecomeLeader();
      }
    }, this.leaseDurationMs / 3);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createDistributedLock(): DistributedLock {
  return new DistributedLock();
}

export function createLeaderElection(
  nodeId: NodeId,
  electionName: string,
  leaseDurationMs: number,
  callbacks: LeadershipCallback,
  lock?: DistributedLock
): LeaderElection {
  return new LeaderElection(nodeId, electionName, leaseDurationMs, callbacks, lock);
}

// ============================================================================
// FENCING TOKEN
// ============================================================================

/**
 * Fencing token for preventing stale operations.
 */
export interface FencingToken {
  token: number;
  resource: string;
  issuedAt: Date;
}

export class FencingTokenGenerator {
  private counters = new Map<string, number>();

  /**
   * Generate a new fencing token for a resource.
   */
  generate(resource: string): FencingToken {
    const current = this.counters.get(resource) ?? 0;
    const next = current + 1;
    this.counters.set(resource, next);

    return {
      token: next,
      resource,
      issuedAt: new Date(),
    };
  }

  /**
   * Validate a fencing token is current.
   */
  validate(token: FencingToken): boolean {
    const current = this.counters.get(token.resource) ?? 0;
    return token.token === current;
  }
}
