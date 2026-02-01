/**
 * Database Failure Injector
 * 
 * Simulates database failures: connection loss, query timeout, deadlock, etc.
 */

import type { Timeline } from '../timeline.js';

export type DatabaseFailureType = 
  | 'connection_lost'
  | 'query_timeout'
  | 'deadlock'
  | 'constraint_violation'
  | 'disk_full'
  | 'read_only'
  | 'unavailable';

export interface DatabaseInjectorConfig {
  /** Type of database failure to inject */
  failureType: DatabaseFailureType;
  /** Operations to affect: 'read' | 'write' | 'all' */
  affectedOperations?: 'read' | 'write' | 'all';
  /** Failure probability (0-1) */
  probability?: number;
  /** Whether to simulate recovery after N attempts */
  recoversAfter?: number;
  /** Delay before failure (ms) */
  delayBeforeFailure?: number;
}

export interface DatabaseInjectorState {
  active: boolean;
  operationsIntercepted: number;
  operationsFailed: number;
  recoveries: number;
}

export interface DatabaseOperation {
  type: 'read' | 'write' | 'transaction';
  table?: string;
  query?: string;
}

export type DatabaseHandler = (operation: DatabaseOperation) => Promise<unknown>;

/**
 * Database failure injector for chaos testing
 */
export class DatabaseInjector {
  private config: Required<DatabaseInjectorConfig>;
  private state: DatabaseInjectorState;
  private attemptCount: number = 0;
  private timeline: Timeline | null = null;
  private interceptedHandlers: Map<string, DatabaseHandler> = new Map();
  private originalHandlers: Map<string, DatabaseHandler> = new Map();

  constructor(config: DatabaseInjectorConfig) {
    this.config = {
      failureType: config.failureType,
      affectedOperations: config.affectedOperations ?? 'all',
      probability: config.probability ?? 1.0,
      recoversAfter: config.recoversAfter ?? 0,
      delayBeforeFailure: config.delayBeforeFailure ?? 0,
    };
    this.state = {
      active: false,
      operationsIntercepted: 0,
      operationsFailed: 0,
      recoveries: 0,
    };
  }

  /**
   * Attach a timeline for event recording
   */
  attachTimeline(timeline: Timeline): void {
    this.timeline = timeline;
  }

  /**
   * Register a database handler to intercept
   */
  registerHandler(name: string, handler: DatabaseHandler): void {
    this.originalHandlers.set(name, handler);
  }

  /**
   * Get the intercepted handler
   */
  getHandler(name: string): DatabaseHandler {
    if (this.state.active && this.interceptedHandlers.has(name)) {
      return this.interceptedHandlers.get(name)!;
    }
    return this.originalHandlers.get(name) ?? (async () => undefined);
  }

  /**
   * Activate the database injector
   */
  activate(): void {
    if (this.state.active) return;

    // Create intercepted handlers
    for (const [name, handler] of this.originalHandlers) {
      this.interceptedHandlers.set(name, this.createInterceptedHandler(handler));
    }

    this.attemptCount = 0;
    this.state.active = true;
    this.timeline?.record('injection_start', {
      injector: 'database',
      config: this.config,
    });
  }

  /**
   * Deactivate the database injector
   */
  deactivate(): void {
    if (!this.state.active) return;

    this.interceptedHandlers.clear();
    this.state.active = false;
    this.timeline?.record('injection_end', {
      injector: 'database',
      state: { ...this.state },
    });
  }

  /**
   * Get current state
   */
  getState(): DatabaseInjectorState {
    return { ...this.state };
  }

  /**
   * Check if operation should be affected
   */
  private shouldAffectOperation(operation: DatabaseOperation): boolean {
    if (this.config.affectedOperations === 'all') return true;
    if (this.config.affectedOperations === 'read' && operation.type === 'read') return true;
    if (this.config.affectedOperations === 'write' && operation.type === 'write') return true;
    return false;
  }

  /**
   * Determine if this operation should fail
   */
  private shouldFail(operation: DatabaseOperation): boolean {
    if (!this.shouldAffectOperation(operation)) return false;
    
    // Check probability
    if (Math.random() > this.config.probability) return false;

    // Check recovery logic
    if (this.config.recoversAfter > 0) {
      this.attemptCount++;
      if (this.attemptCount > this.config.recoversAfter) {
        this.state.recoveries++;
        this.timeline?.recordRecovery('database', {
          afterAttempts: this.attemptCount - 1,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Create the database error based on failure type
   */
  private createError(): Error {
    const errors: Record<DatabaseFailureType, string> = {
      connection_lost: 'Database connection lost: ECONNRESET',
      query_timeout: 'Query execution timeout exceeded',
      deadlock: 'Transaction deadlock detected, aborting',
      constraint_violation: 'Constraint violation: foreign key or unique constraint failed',
      disk_full: 'Database disk full: no space left on device',
      read_only: 'Database is in read-only mode',
      unavailable: 'Database service unavailable',
    };

    const error = new Error(errors[this.config.failureType]);
    (error as Record<string, unknown>).code = this.config.failureType.toUpperCase();
    return error;
  }

  /**
   * Create intercepted handler
   */
  private createInterceptedHandler(originalHandler: DatabaseHandler): DatabaseHandler {
    const self = this;

    return async function interceptedHandler(operation: DatabaseOperation): Promise<unknown> {
      self.state.operationsIntercepted++;

      if (self.shouldFail(operation)) {
        self.state.operationsFailed++;
        
        // Apply delay before failure
        if (self.config.delayBeforeFailure > 0) {
          await new Promise(resolve => setTimeout(resolve, self.config.delayBeforeFailure));
        }

        self.timeline?.record('error', {
          injector: 'database',
          failureType: self.config.failureType,
          operation,
        });

        throw self.createError();
      }

      return originalHandler(operation);
    };
  }

  /**
   * Simulate a database operation with potential failure
   */
  async simulateOperation(operation: DatabaseOperation): Promise<unknown> {
    this.state.operationsIntercepted++;

    if (this.state.active && this.shouldFail(operation)) {
      this.state.operationsFailed++;

      if (this.config.delayBeforeFailure > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.delayBeforeFailure));
      }

      this.timeline?.record('error', {
        injector: 'database',
        failureType: this.config.failureType,
        operation,
      });

      throw this.createError();
    }

    return { success: true, operation };
  }
}

/**
 * Create a database connection lost injector
 */
export function createDatabaseConnectionLost(probability?: number): DatabaseInjector {
  return new DatabaseInjector({
    failureType: 'connection_lost',
    probability,
  });
}

/**
 * Create a database timeout injector
 */
export function createDatabaseTimeout(
  affectedOperations?: 'read' | 'write' | 'all',
  probability?: number
): DatabaseInjector {
  return new DatabaseInjector({
    failureType: 'query_timeout',
    affectedOperations,
    probability,
  });
}

/**
 * Create a deadlock injector
 */
export function createDeadlock(probability?: number): DatabaseInjector {
  return new DatabaseInjector({
    failureType: 'deadlock',
    affectedOperations: 'write',
    probability,
  });
}

/**
 * Create a recoverable database failure injector
 */
export function createRecoverableDatabaseFailure(
  failureType: DatabaseFailureType,
  recoversAfter: number = 3
): DatabaseInjector {
  return new DatabaseInjector({
    failureType,
    recoversAfter,
  });
}

/**
 * Create a database unavailable injector
 */
export function createDatabaseUnavailable(): DatabaseInjector {
  return new DatabaseInjector({
    failureType: 'unavailable',
    probability: 1.0,
  });
}
