/**
 * Behavior Scheduler
 * Manages execution of ISL behaviors with priorities and concurrency control
 */

import { ExecutionContext, ExecutionResult, Actor } from '../types';

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Maximum concurrent executions */
  maxConcurrency: number;
  /** Default priority for new tasks */
  defaultPriority: number;
  /** Enable fair scheduling */
  fairScheduling: boolean;
  /** Time quantum for preemption (ms) */
  timeQuantum: number;
  /** Enable priority aging */
  priorityAging: boolean;
  /** Aging interval (ms) */
  agingInterval: number;
}

/**
 * Scheduled task
 */
export interface ScheduledTask {
  id: string;
  domain: string;
  behavior: string;
  input: Record<string, unknown>;
  actor: Actor;
  priority: number;
  scheduledAt: number;
  deadline?: number;
  dependencies?: string[];
  callback?: (result: ExecutionResult) => void;
}

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Task state
 */
export interface TaskState {
  task: ScheduledTask;
  status: TaskStatus;
  startedAt?: number;
  completedAt?: number;
  result?: ExecutionResult;
  error?: Error;
  attempts: number;
}

/**
 * Behavior Scheduler
 */
export class BehaviorScheduler {
  private config: SchedulerConfig;
  private pendingTasks: Map<string, TaskState> = new Map();
  private runningTasks: Map<string, TaskState> = new Map();
  private completedTasks: Map<string, TaskState> = new Map();
  private executor?: (task: ScheduledTask) => Promise<ExecutionResult>;
  private running = false;
  private agingTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      maxConcurrency: 10,
      defaultPriority: 5,
      fairScheduling: true,
      timeQuantum: 100,
      priorityAging: true,
      agingInterval: 1000,
      ...config,
    };
  }

  /**
   * Set the executor function
   */
  setExecutor(executor: (task: ScheduledTask) => Promise<ExecutionResult>): void {
    this.executor = executor;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    if (this.config.priorityAging) {
      this.agingTimer = setInterval(() => this.agePriorities(), this.config.agingInterval);
    }

    this.processQueue();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false;
    if (this.agingTimer) {
      clearInterval(this.agingTimer);
      this.agingTimer = undefined;
    }
  }

  /**
   * Schedule a task
   */
  schedule(task: Omit<ScheduledTask, 'id' | 'scheduledAt'>): string {
    const id = this.generateTaskId();
    const scheduledTask: ScheduledTask = {
      ...task,
      id,
      priority: task.priority ?? this.config.defaultPriority,
      scheduledAt: Date.now(),
    };

    this.pendingTasks.set(id, {
      task: scheduledTask,
      status: 'pending',
      attempts: 0,
    });

    if (this.running) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Schedule multiple tasks
   */
  scheduleMany(tasks: Array<Omit<ScheduledTask, 'id' | 'scheduledAt'>>): string[] {
    return tasks.map((task) => this.schedule(task));
  }

  /**
   * Schedule a task with dependencies
   */
  scheduleAfter(
    task: Omit<ScheduledTask, 'id' | 'scheduledAt'>,
    dependencyIds: string[]
  ): string {
    return this.schedule({
      ...task,
      dependencies: dependencyIds,
    });
  }

  /**
   * Cancel a task
   */
  cancel(taskId: string): boolean {
    const state = this.pendingTasks.get(taskId);
    if (!state) return false;

    state.status = 'cancelled';
    this.pendingTasks.delete(taskId);
    this.completedTasks.set(taskId, state);
    return true;
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): TaskState | undefined {
    return (
      this.pendingTasks.get(taskId) ??
      this.runningTasks.get(taskId) ??
      this.completedTasks.get(taskId)
    );
  }

  /**
   * Wait for a task to complete
   */
  async waitFor(taskId: string): Promise<ExecutionResult | undefined> {
    return new Promise((resolve) => {
      const check = () => {
        const state = this.completedTasks.get(taskId);
        if (state) {
          resolve(state.result);
          return;
        }

        const pending = this.pendingTasks.get(taskId);
        const running = this.runningTasks.get(taskId);
        if (!pending && !running) {
          resolve(undefined);
          return;
        }

        setTimeout(check, 10);
      };
      check();
    });
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return {
      pendingCount: this.pendingTasks.size,
      runningCount: this.runningTasks.size,
      completedCount: this.completedTasks.size,
      averageWaitTime: this.calculateAverageWaitTime(),
      throughput: this.calculateThroughput(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private async processQueue(): Promise<void> {
    if (!this.running || !this.executor) return;

    while (this.running && this.runningTasks.size < this.config.maxConcurrency) {
      const nextTask = this.selectNextTask();
      if (!nextTask) break;

      this.runTask(nextTask);
    }
  }

  private selectNextTask(): TaskState | undefined {
    if (this.pendingTasks.size === 0) return undefined;

    // Filter tasks with satisfied dependencies
    const ready = Array.from(this.pendingTasks.values()).filter((state) =>
      this.areDependenciesSatisfied(state.task)
    );

    if (ready.length === 0) return undefined;

    // Sort by priority (higher first) and then by scheduled time (older first)
    ready.sort((a, b) => {
      if (a.task.priority !== b.task.priority) {
        return b.task.priority - a.task.priority;
      }
      return a.task.scheduledAt - b.task.scheduledAt;
    });

    // Check deadlines - prioritize tasks near deadline
    const nearDeadline = ready.filter((state) => {
      if (!state.task.deadline) return false;
      const timeToDeadline = state.task.deadline - Date.now();
      return timeToDeadline < this.config.timeQuantum * 10;
    });

    if (nearDeadline.length > 0) {
      nearDeadline.sort((a, b) => (a.task.deadline ?? 0) - (b.task.deadline ?? 0));
      return nearDeadline[0];
    }

    return ready[0];
  }

  private areDependenciesSatisfied(task: ScheduledTask): boolean {
    if (!task.dependencies || task.dependencies.length === 0) return true;

    return task.dependencies.every((depId) => {
      const depState = this.completedTasks.get(depId);
      return depState?.status === 'completed';
    });
  }

  private async runTask(state: TaskState): Promise<void> {
    const { task } = state;

    this.pendingTasks.delete(task.id);
    state.status = 'running';
    state.startedAt = Date.now();
    state.attempts++;
    this.runningTasks.set(task.id, state);

    try {
      const result = await this.executor!(task);
      state.status = 'completed';
      state.completedAt = Date.now();
      state.result = result;

      if (task.callback) {
        task.callback(result);
      }
    } catch (error) {
      state.status = 'failed';
      state.completedAt = Date.now();
      state.error = error as Error;
    } finally {
      this.runningTasks.delete(task.id);
      this.completedTasks.set(task.id, state);

      // Continue processing queue
      this.processQueue();
    }
  }

  private agePriorities(): void {
    const now = Date.now();
    for (const state of this.pendingTasks.values()) {
      const waitTime = now - state.task.scheduledAt;
      // Increase priority by 1 for every aging interval waited
      const ageBonus = Math.floor(waitTime / this.config.agingInterval);
      state.task.priority = Math.min(10, state.task.priority + ageBonus * 0.1);
    }
  }

  private calculateAverageWaitTime(): number {
    const completed = Array.from(this.completedTasks.values());
    if (completed.length === 0) return 0;

    const totalWait = completed.reduce((sum, state) => {
      if (state.startedAt) {
        return sum + (state.startedAt - state.task.scheduledAt);
      }
      return sum;
    }, 0);

    return totalWait / completed.length;
  }

  private calculateThroughput(): number {
    const completed = Array.from(this.completedTasks.values());
    if (completed.length === 0) return 0;

    const oldest = Math.min(...completed.map((s) => s.task.scheduledAt));
    const elapsed = (Date.now() - oldest) / 1000; // seconds

    return completed.length / elapsed;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
  pendingCount: number;
  runningCount: number;
  completedCount: number;
  averageWaitTime: number;
  throughput: number;
}

/**
 * Create a scheduler
 */
export function createScheduler(config?: Partial<SchedulerConfig>): BehaviorScheduler {
  return new BehaviorScheduler(config);
}
