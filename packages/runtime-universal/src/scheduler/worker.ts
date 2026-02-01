/**
 * Worker Pool for parallel behavior execution
 */

import { ScheduledTask } from './scheduler';
import { ExecutionResult } from '../types';

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Minimum number of workers */
  minWorkers: number;
  /** Maximum number of workers */
  maxWorkers: number;
  /** Idle timeout before worker shutdown (ms) */
  idleTimeout: number;
  /** Task timeout (ms) */
  taskTimeout: number;
  /** Enable worker reuse */
  reuseWorkers: boolean;
}

/**
 * Worker state
 */
export interface WorkerState {
  id: string;
  status: 'idle' | 'busy' | 'terminating';
  currentTask?: string;
  startedAt?: number;
  completedTasks: number;
  failedTasks: number;
}

/**
 * Worker executor function type
 */
export type WorkerExecutor = (task: ScheduledTask) => Promise<ExecutionResult>;

/**
 * Worker Pool Manager
 */
export class WorkerPool {
  private config: WorkerPoolConfig;
  private workers: Map<string, WorkerState> = new Map();
  private taskQueue: ScheduledTask[] = [];
  private executor: WorkerExecutor;
  private running = false;
  private idleTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(executor: WorkerExecutor, config: Partial<WorkerPoolConfig> = {}) {
    this.executor = executor;
    this.config = {
      minWorkers: 2,
      maxWorkers: 10,
      idleTimeout: 30000,
      taskTimeout: 60000,
      reuseWorkers: true,
      ...config,
    };
  }

  /**
   * Start the worker pool
   */
  async start(): Promise<void> {
    this.running = true;

    // Start minimum workers
    for (let i = 0; i < this.config.minWorkers; i++) {
      this.createWorker();
    }
  }

  /**
   * Stop the worker pool
   */
  async stop(): Promise<void> {
    this.running = false;

    // Clear idle timers
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();

    // Wait for running tasks
    const runningWorkers = Array.from(this.workers.values()).filter(
      (w) => w.status === 'busy'
    );

    if (runningWorkers.length > 0) {
      await new Promise<void>((resolve) => {
        const check = () => {
          const stillBusy = Array.from(this.workers.values()).some(
            (w) => w.status === 'busy'
          );
          if (!stillBusy) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }

    this.workers.clear();
  }

  /**
   * Submit a task for execution
   */
  async submit(task: ScheduledTask): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const wrappedTask: ScheduledTask = {
        ...task,
        callback: (result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(result.error);
          }
          task.callback?.(result);
        },
      };

      this.taskQueue.push(wrappedTask);
      this.scheduleTask();
    });
  }

  /**
   * Submit multiple tasks
   */
  async submitAll(tasks: ScheduledTask[]): Promise<ExecutionResult[]> {
    return Promise.all(tasks.map((task) => this.submit(task)));
  }

  /**
   * Get pool statistics
   */
  getStats(): WorkerPoolStats {
    const workers = Array.from(this.workers.values());
    return {
      totalWorkers: workers.length,
      idleWorkers: workers.filter((w) => w.status === 'idle').length,
      busyWorkers: workers.filter((w) => w.status === 'busy').length,
      queuedTasks: this.taskQueue.length,
      completedTasks: workers.reduce((sum, w) => sum + w.completedTasks, 0),
      failedTasks: workers.reduce((sum, w) => sum + w.failedTasks, 0),
    };
  }

  /**
   * Get worker states
   */
  getWorkerStates(): WorkerState[] {
    return Array.from(this.workers.values());
  }

  /**
   * Scale the pool
   */
  scale(targetSize: number): void {
    const current = this.workers.size;
    const target = Math.min(
      Math.max(targetSize, this.config.minWorkers),
      this.config.maxWorkers
    );

    if (target > current) {
      // Scale up
      for (let i = current; i < target; i++) {
        this.createWorker();
      }
    } else if (target < current) {
      // Scale down (only terminate idle workers)
      const toRemove = current - target;
      const idleWorkers = Array.from(this.workers.entries())
        .filter(([_, w]) => w.status === 'idle')
        .slice(0, toRemove);

      for (const [id] of idleWorkers) {
        this.terminateWorker(id);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private createWorker(): string {
    const id = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.workers.set(id, {
      id,
      status: 'idle',
      completedTasks: 0,
      failedTasks: 0,
    });
    this.resetIdleTimer(id);
    return id;
  }

  private terminateWorker(id: string): void {
    const worker = this.workers.get(id);
    if (!worker || worker.status === 'busy') return;

    const timer = this.idleTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(id);
    }

    this.workers.delete(id);
  }

  private resetIdleTimer(workerId: string): void {
    const existing = this.idleTimers.get(workerId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      // Only terminate if above minimum
      if (this.workers.size > this.config.minWorkers) {
        this.terminateWorker(workerId);
      }
    }, this.config.idleTimeout);

    this.idleTimers.set(workerId, timer);
  }

  private scheduleTask(): void {
    if (!this.running || this.taskQueue.length === 0) return;

    // Find an idle worker
    let idleWorker: string | undefined;
    for (const [id, worker] of this.workers) {
      if (worker.status === 'idle') {
        idleWorker = id;
        break;
      }
    }

    // Create new worker if needed and allowed
    if (!idleWorker && this.workers.size < this.config.maxWorkers) {
      idleWorker = this.createWorker();
    }

    if (!idleWorker) return;

    const task = this.taskQueue.shift()!;
    this.executeOnWorker(idleWorker, task);
  }

  private async executeOnWorker(workerId: string, task: ScheduledTask): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    // Clear idle timer
    const timer = this.idleTimers.get(workerId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(workerId);
    }

    worker.status = 'busy';
    worker.currentTask = task.id;
    worker.startedAt = Date.now();

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(task);
      worker.completedTasks++;
      task.callback?.(result);
    } catch (error) {
      worker.failedTasks++;
      task.callback?.({
        success: false,
        executionId: task.id,
        error: {
          code: 'WORKER_ERROR',
          message: (error as Error).message,
          type: 'runtime',
          retryable: true,
        },
        effects: [],
        duration: Date.now() - (worker.startedAt ?? Date.now()),
        verificationResult: {
          verdict: 'error',
          score: 0,
          preconditions: [],
          postconditions: [],
          invariants: [],
        },
        stateChanges: [],
      });
    } finally {
      worker.status = 'idle';
      worker.currentTask = undefined;
      worker.startedAt = undefined;

      if (this.config.reuseWorkers) {
        this.resetIdleTimer(workerId);
        this.scheduleTask();
      } else {
        this.terminateWorker(workerId);
        if (this.workers.size < this.config.minWorkers) {
          this.createWorker();
        }
      }
    }
  }

  private async executeWithTimeout(task: ScheduledTask): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${this.config.taskTimeout}ms`));
      }, this.config.taskTimeout);

      this.executor(task)
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}

/**
 * Worker pool statistics
 */
export interface WorkerPoolStats {
  totalWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
}

/**
 * Create a worker pool
 */
export function createWorkerPool(
  executor: WorkerExecutor,
  config?: Partial<WorkerPoolConfig>
): WorkerPool {
  return new WorkerPool(executor, config);
}
