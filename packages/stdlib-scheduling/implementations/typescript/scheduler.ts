/**
 * Scheduler Implementation
 * 
 * Core job scheduling functionality.
 */

import { v4 as uuidv4 } from 'uuid';
import { parseExpression } from 'cron-parser';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type JobId = string;
export type WorkflowId = string;
export type Priority = number;

export const JOB_STATUSES = ['PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING'] as const;
export type JobStatus = typeof JOB_STATUSES[number];

export const DEFAULT_PRIORITY = 50;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_DELAY = 1000;

/** Retry policy configuration */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/** Job result */
export interface JobResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

/** Schedule configuration */
export interface ScheduleConfig {
  runAt?: Date;
  delay?: number;
  cron?: string;
  timezone?: string;
}

/** Job entity */
export interface Job {
  id: JobId;
  name: string;
  uniqueKey?: string;
  handler: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: Priority;
  scheduledAt?: Date;
  cron?: string;
  timezone: string;
  nextRunAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  result?: JobResult;
  attempts: number;
  maxAttempts: number;
  retryDelay: number;
  retryBackoff: number;
  lastError?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Schedule entity */
export interface Schedule {
  id: string;
  name: string;
  description?: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  startDate?: Date;
  endDate?: Date;
  handler: string;
  payload?: Record<string, unknown>;
  priority: Priority;
  retryPolicy?: RetryPolicy;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Job handler function */
export type JobHandler = (payload: Record<string, unknown>, context: JobContext) => Promise<unknown>;

/** Job execution context */
export interface JobContext {
  jobId: JobId;
  attempt: number;
  maxAttempts: number;
  startedAt: Date;
  signal?: AbortSignal;
}

/** Handler registry */
export interface HandlerRegistry {
  register(name: string, handler: JobHandler): void;
  unregister(name: string): void;
  get(name: string): JobHandler | undefined;
  has(name: string): boolean;
  list(): string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduleJobInput {
  name: string;
  handler: string;
  payload?: Record<string, unknown>;
  runAt?: Date;
  delay?: number;
  cron?: string;
  timezone?: string;
  priority?: number;
  maxAttempts?: number;
  retryDelay?: number;
  uniqueKey?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export type ScheduleJobOutput = 
  | { success: true; job: Job }
  | { success: false; error: SchedulingError };

export interface CancelJobInput {
  jobId: JobId;
  reason?: string;
}

export type CancelJobOutput =
  | { success: true; job: Job }
  | { success: false; error: SchedulingError };

export interface RetryJobInput {
  jobId: JobId;
  delay?: number;
  resetAttempts?: boolean;
}

export type RetryJobOutput =
  | { success: true; job: Job }
  | { success: false; error: SchedulingError };

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

export type SchedulerEvent = JobEvent;

export type JobEvent =
  | { type: 'job.scheduled'; job: Job }
  | { type: 'job.started'; job: Job }
  | { type: 'job.completed'; job: Job; result: JobResult }
  | { type: 'job.failed'; job: Job; error: string }
  | { type: 'job.cancelled'; job: Job; reason?: string }
  | { type: 'job.retrying'; job: Job; attempt: number };

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class SchedulingError extends Error {
  constructor(
    public code: string,
    message: string,
    public data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SchedulingError';
  }
}

export class JobNotFoundError extends SchedulingError {
  constructor(jobId: JobId) {
    super('JOB_NOT_FOUND', `Job not found: ${jobId}`, { jobId });
  }
}

export class DuplicateJobError extends SchedulingError {
  constructor(uniqueKey: string, existingJobId: JobId) {
    super('DUPLICATE_JOB', `Job with unique_key '${uniqueKey}' already exists`, { 
      uniqueKey, 
      existingJobId 
    });
  }
}

export class InvalidCronError extends SchedulingError {
  constructor(expression: string, reason?: string) {
    super('INVALID_CRON', `Invalid cron expression: ${expression}${reason ? ` (${reason})` : ''}`, { 
      expression 
    });
  }
}

export class MaxRetriesExceededError extends SchedulingError {
  constructor(jobId: JobId, attempts: number, maxAttempts: number) {
    super('MAX_RETRIES_EXCEEDED', `Job ${jobId} has exceeded maximum retries`, {
      jobId,
      attempts,
      maxAttempts
    });
  }
}

export class WorkflowValidationError extends SchedulingError {
  constructor(message: string, data?: Record<string, unknown>) {
    super('WORKFLOW_VALIDATION_ERROR', message, data);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cron Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a cron expression
 */
export function isValidCronExpression(expression: string): boolean {
  try {
    parseExpression(expression);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a cron expression
 */
export function parseCronExpression(expression: string, options?: { tz?: string }) {
  try {
    return parseExpression(expression, { tz: options?.tz });
  } catch (err) {
    throw new InvalidCronError(expression, err instanceof Error ? err.message : undefined);
  }
}

/**
 * Get next run time for a cron expression
 */
export function getNextCronRun(expression: string, options?: { tz?: string; from?: Date }): Date {
  const cron = parseCronExpression(expression, options);
  return cron.next().toDate();
}

// ─────────────────────────────────────────────────────────────────────────────
// Duration Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a duration string (e.g., "5m", "1h", "30s")
 */
export function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') return duration;
  
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  
  const [, value, unit] = match;
  const num = parseInt(value, 10);
  
  switch (unit) {
    case 'ms': return num;
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return num;
  }
}

/**
 * Format milliseconds as a human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler Registry
// ─────────────────────────────────────────────────────────────────────────────

class DefaultHandlerRegistry implements HandlerRegistry {
  private handlers = new Map<string, JobHandler>();

  register(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  unregister(name: string): void {
    this.handlers.delete(name);
  }

  get(name: string): JobHandler | undefined {
    return this.handlers.get(name);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  list(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler
// ─────────────────────────────────────────────────────────────────────────────

export interface SchedulerOptions {
  /** Polling interval for scheduled jobs (ms) */
  pollInterval?: number;
  /** Maximum concurrent job executions */
  concurrency?: number;
  /** Custom handler registry */
  handlers?: HandlerRegistry;
  /** Event handler */
  onEvent?: (event: SchedulerEvent) => void;
}

export class Scheduler {
  private jobs = new Map<JobId, Job>();
  private uniqueKeys = new Map<string, JobId>();
  private handlers: HandlerRegistry;
  private pollInterval: number;
  private concurrency: number;
  private onEvent?: (event: SchedulerEvent) => void;
  private pollTimer?: ReturnType<typeof setInterval>;
  private running = false;
  private activeJobs = 0;

  constructor(options: SchedulerOptions = {}) {
    this.pollInterval = options.pollInterval ?? 1000;
    this.concurrency = options.concurrency ?? 10;
    this.handlers = options.handlers ?? new DefaultHandlerRegistry();
    this.onEvent = options.onEvent;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.pollTimer = setInterval(() => this.poll(), this.pollInterval);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.running;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Handler Registration
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Register a job handler
   */
  registerHandler(name: string, handler: JobHandler): void {
    this.handlers.register(name, handler);
  }

  /**
   * Unregister a job handler
   */
  unregisterHandler(name: string): void {
    this.handlers.unregister(name);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Job Operations
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Schedule a new job
   */
  async scheduleJob(input: ScheduleJobInput): Promise<ScheduleJobOutput> {
    try {
      // Validate handler exists
      if (!this.handlers.has(input.handler)) {
        return {
          success: false,
          error: new SchedulingError('HANDLER_NOT_FOUND', `Handler not found: ${input.handler}`, {
            handler: input.handler
          })
        };
      }

      // Check for duplicate unique_key
      if (input.uniqueKey) {
        const existingId = this.uniqueKeys.get(input.uniqueKey);
        if (existingId) {
          const existing = this.jobs.get(existingId);
          if (existing && !['COMPLETED', 'CANCELLED'].includes(existing.status)) {
            return {
              success: false,
              error: new DuplicateJobError(input.uniqueKey, existingId)
            };
          }
        }
      }

      // Validate scheduling
      if (!input.runAt && !input.delay && !input.cron) {
        return {
          success: false,
          error: new SchedulingError('INVALID_SCHEDULE', 'Must provide runAt, delay, or cron')
        };
      }

      // Validate cron
      if (input.cron && !isValidCronExpression(input.cron)) {
        return {
          success: false,
          error: new InvalidCronError(input.cron)
        };
      }

      // Calculate scheduled time
      let scheduledAt: Date;
      if (input.runAt) {
        scheduledAt = input.runAt;
      } else if (input.delay) {
        scheduledAt = new Date(Date.now() + input.delay);
      } else if (input.cron) {
        scheduledAt = getNextCronRun(input.cron, { tz: input.timezone });
      } else {
        scheduledAt = new Date();
      }

      // Create job
      const now = new Date();
      const job: Job = {
        id: uuidv4(),
        name: input.name,
        uniqueKey: input.uniqueKey,
        handler: input.handler,
        payload: input.payload ?? {},
        status: 'SCHEDULED',
        priority: input.priority ?? DEFAULT_PRIORITY,
        scheduledAt,
        cron: input.cron,
        timezone: input.timezone ?? 'UTC',
        attempts: 0,
        maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        retryDelay: input.retryDelay ?? DEFAULT_RETRY_DELAY,
        retryBackoff: 2.0,
        tags: input.tags,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      };

      // Store job
      this.jobs.set(job.id, job);
      if (job.uniqueKey) {
        this.uniqueKeys.set(job.uniqueKey, job.id);
      }

      this.emit({ type: 'job.scheduled', job });

      return { success: true, job };
    } catch (err) {
      return {
        success: false,
        error: err instanceof SchedulingError ? err : new SchedulingError(
          'UNKNOWN_ERROR',
          err instanceof Error ? err.message : String(err)
        )
      };
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(input: CancelJobInput): Promise<CancelJobOutput> {
    const job = this.jobs.get(input.jobId);
    
    if (!job) {
      return { success: false, error: new JobNotFoundError(input.jobId) };
    }

    if (job.status === 'COMPLETED') {
      return {
        success: false,
        error: new SchedulingError('JOB_ALREADY_COMPLETED', 'Cannot cancel completed job', {
          jobId: input.jobId,
          completedAt: job.completedAt
        })
      };
    }

    if (job.status === 'CANCELLED') {
      return {
        success: false,
        error: new SchedulingError('JOB_ALREADY_CANCELLED', 'Job already cancelled', {
          jobId: input.jobId
        })
      };
    }

    if (job.status === 'RUNNING') {
      return {
        success: false,
        error: new SchedulingError('JOB_RUNNING', 'Cannot cancel running job', {
          jobId: input.jobId,
          startedAt: job.startedAt
        })
      };
    }

    // Update job
    job.status = 'CANCELLED';
    job.lastError = input.reason;
    job.updatedAt = new Date();

    this.emit({ type: 'job.cancelled', job, reason: input.reason });

    return { success: true, job };
  }

  /**
   * Retry a failed job
   */
  async retryJob(input: RetryJobInput): Promise<RetryJobOutput> {
    const job = this.jobs.get(input.jobId);

    if (!job) {
      return { success: false, error: new JobNotFoundError(input.jobId) };
    }

    if (job.status !== 'FAILED') {
      return {
        success: false,
        error: new SchedulingError('JOB_NOT_FAILED', 'Can only retry failed jobs', {
          jobId: input.jobId,
          status: job.status
        })
      };
    }

    if (!input.resetAttempts && job.attempts >= job.maxAttempts) {
      return {
        success: false,
        error: new MaxRetriesExceededError(input.jobId, job.attempts, job.maxAttempts)
      };
    }

    // Calculate retry delay with exponential backoff
    const baseDelay = input.delay ?? job.retryDelay;
    const attempt = input.resetAttempts ? 1 : job.attempts + 1;
    const delay = Math.min(
      baseDelay * Math.pow(job.retryBackoff, attempt - 1),
      300000 // Max 5 minutes
    );

    // Update job
    job.status = 'RETRYING';
    job.attempts = input.resetAttempts ? 0 : job.attempts;
    job.scheduledAt = new Date(Date.now() + delay);
    job.updatedAt = new Date();

    this.emit({ type: 'job.retrying', job, attempt });

    return { success: true, job };
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: JobId): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * List jobs with optional filters
   */
  listJobs(filters?: {
    status?: JobStatus | JobStatus[];
    handler?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Job[] {
    let jobs = Array.from(this.jobs.values());

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      jobs = jobs.filter(j => statuses.includes(j.status));
    }

    if (filters?.handler) {
      jobs = jobs.filter(j => j.handler === filters.handler);
    }

    if (filters?.tags) {
      jobs = jobs.filter(j => 
        j.tags && filters.tags!.every(t => j.tags!.includes(t))
      );
    }

    // Sort by priority (descending) then scheduledAt (ascending)
    jobs.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      const aTime = a.scheduledAt?.getTime() ?? 0;
      const bTime = b.scheduledAt?.getTime() ?? 0;
      return aTime - bTime;
    });

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 100;
    return jobs.slice(offset, offset + limit);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal Methods
  // ───────────────────────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    if (!this.running) return;

    const now = new Date();
    const readyJobs = this.listJobs({
      status: ['SCHEDULED', 'RETRYING'],
      limit: this.concurrency - this.activeJobs,
    }).filter(j => j.scheduledAt && j.scheduledAt <= now);

    for (const job of readyJobs) {
      if (this.activeJobs >= this.concurrency) break;
      this.executeJob(job);
    }
  }

  private async executeJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.handler);
    if (!handler) {
      job.status = 'FAILED';
      job.lastError = `Handler not found: ${job.handler}`;
      job.updatedAt = new Date();
      this.emit({ type: 'job.failed', job, error: job.lastError });
      return;
    }

    this.activeJobs++;
    job.status = 'RUNNING';
    job.startedAt = new Date();
    job.attempts++;
    job.updatedAt = new Date();

    this.emit({ type: 'job.started', job });

    const context: JobContext = {
      jobId: job.id,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      startedAt: job.startedAt,
    };

    try {
      const startTime = Date.now();
      const output = await handler(job.payload, context);
      const durationMs = Date.now() - startTime;

      job.status = 'COMPLETED';
      job.completedAt = new Date();
      job.durationMs = durationMs;
      job.result = {
        success: true,
        output: output as Record<string, unknown>,
        durationMs,
      };
      job.updatedAt = new Date();

      // For recurring jobs, schedule next run
      if (job.cron) {
        job.status = 'SCHEDULED';
        job.scheduledAt = getNextCronRun(job.cron, { tz: job.timezone });
        job.startedAt = undefined;
        job.completedAt = undefined;
      }

      this.emit({ type: 'job.completed', job, result: job.result });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      job.status = 'FAILED';
      job.lastError = error;
      job.durationMs = Date.now() - job.startedAt!.getTime();
      job.result = {
        success: false,
        error,
        durationMs: job.durationMs,
      };
      job.updatedAt = new Date();

      this.emit({ type: 'job.failed', job, error });
    } finally {
      this.activeJobs--;
    }
  }

  private emit(event: SchedulerEvent): void {
    this.onEvent?.(event);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new scheduler instance
 */
export function createScheduler(options?: SchedulerOptions): Scheduler {
  return new Scheduler(options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone Functions
// ─────────────────────────────────────────────────────────────────────────────

let defaultScheduler: Scheduler | null = null;

function getDefaultScheduler(): Scheduler {
  if (!defaultScheduler) {
    defaultScheduler = new Scheduler();
  }
  return defaultScheduler;
}

export async function scheduleJob(input: ScheduleJobInput): Promise<ScheduleJobOutput> {
  return getDefaultScheduler().scheduleJob(input);
}

export async function cancelJob(input: CancelJobInput): Promise<CancelJobOutput> {
  return getDefaultScheduler().cancelJob(input);
}

export async function retryJob(input: RetryJobInput): Promise<RetryJobOutput> {
  return getDefaultScheduler().retryJob(input);
}

export function getJob(jobId: JobId): Job | undefined {
  return getDefaultScheduler().getJob(jobId);
}

export function listJobs(filters?: Parameters<Scheduler['listJobs']>[0]): Job[] {
  return getDefaultScheduler().listJobs(filters);
}
