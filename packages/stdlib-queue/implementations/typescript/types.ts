// ============================================================================
// ISL Standard Library - Queue Types
// @isl-lang/stdlib-queue
// ============================================================================

/**
 * Queue identifier type
 */
export type QueueId = string;

/**
 * Job identifier type (UUID)
 */
export type JobId = string;

/**
 * Worker identifier type
 */
export type WorkerId = string;

/**
 * Duration in milliseconds
 */
export type Duration = number;

/**
 * Queue status enumeration
 */
export enum QueueStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DRAINING = 'DRAINING',
  DELETED = 'DELETED',
}

/**
 * Job status enumeration
 */
export enum JobStatus {
  WAITING = 'WAITING',
  DELAYED = 'DELAYED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DEAD = 'DEAD',
  CANCELLED = 'CANCELLED',
}

/**
 * Worker status enumeration
 */
export enum WorkerStatus {
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
}

/**
 * Overlap behavior for scheduled jobs
 */
export enum OverlapBehavior {
  SKIP = 'SKIP',
  ENQUEUE = 'ENQUEUE',
  CANCEL = 'CANCEL',
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxPerSecond: number;
  burst?: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Maximum retry attempts (default: 3) */
  maxRetries: number;
  /** Visibility timeout in ms (default: 30000) */
  visibilityTimeout: Duration;
  /** Batch size for processing (default: 1) */
  batchSize: number;
  /** Whether to use FIFO ordering (default: false) */
  fifo: boolean;
  /** Dead letter queue ID */
  deadLetterQueue?: QueueId;
  /** Threshold before moving to DLQ (default: 3) */
  deadLetterThreshold: number;
  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;
  /** Maximum concurrent workers (default: 10) */
  maxConcurrency: number;
  /** Retention for completed jobs in ms (default: 24 hours) */
  completedJobRetention: Duration;
  /** Retention for failed jobs in ms (default: 7 days) */
  failedJobRetention: Duration;
}

/**
 * Queue entity
 */
export interface Queue {
  id: QueueId;
  name: string;
  config: QueueConfig;
  status: QueueStatus;
  size: number;
  processing: number;
  delayed: number;
  failed: number;
  completed: number;
  createdAt: Date;
}

/**
 * Job error information
 */
export interface JobError {
  message: string;
  code?: string;
  stackTrace?: string;
  attempt: number;
  timestamp: Date;
}

/**
 * Job entity
 */
export interface Job<TData = unknown, TResult = unknown> {
  id: JobId;
  queueId: QueueId;
  name: string;
  data: TData;
  status: JobStatus;
  progress?: number;
  priority: number;
  delay?: Duration;
  scheduledFor?: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  result?: TResult;
  error?: JobError;
  parentId?: JobId;
  childrenIds?: JobId[];
  correlationId?: string;
  traceId?: string;
}

/**
 * Job handler function type
 */
export type JobHandler<TData = unknown, TResult = unknown> = (
  job: Job<TData, TResult>
) => Promise<TResult>;

/**
 * Job result after processing
 */
export interface JobResult<TResult = unknown> {
  jobId: JobId;
  status: JobStatus;
  result?: TResult;
  error?: JobError;
  durationMs: number;
}

/**
 * Schedule configuration
 */
export interface Schedule {
  /** Cron expression (e.g., "0 0 * * *") */
  cron?: string;
  /** Interval in milliseconds */
  interval?: Duration;
  /** Specific times to run */
  at?: string[];
}

/**
 * Scheduled job entity
 */
export interface ScheduledJob<TData = unknown> {
  id: string;
  queueId: QueueId;
  name: string;
  data: TData;
  schedule: Schedule;
  timezone: string;
  enabled: boolean;
  nextRunAt?: Date;
  lastRunAt?: Date;
  lastJobId?: JobId;
  overlapBehavior: OverlapBehavior;
}

/**
 * Worker entity
 */
export interface Worker {
  id: WorkerId;
  hostname: string;
  pid: number;
  status: WorkerStatus;
  startedAt: Date;
  lastHeartbeatAt: Date;
  queues: QueueId[];
  currentJobs: JobId[];
  jobsProcessed: number;
  jobsFailed: number;
  avgProcessingTimeMs: number;
}

/**
 * Enqueue options
 */
export interface EnqueueOptions {
  priority?: number;
  delay?: Duration;
  scheduledFor?: Date;
  maxAttempts?: number;
  dedupeKey?: string;
  dedupeWindow?: Duration;
  parentId?: JobId;
  correlationId?: string;
}

/**
 * Enqueue result
 */
export interface EnqueueResult {
  jobId: JobId;
  status: JobStatus;
}

/**
 * Bulk enqueue job input
 */
export interface BulkJobInput<TData = unknown> {
  name: string;
  data: TData;
  options?: EnqueueOptions;
}

/**
 * Bulk enqueue result
 */
export interface BulkEnqueueResult {
  jobIds: JobId[];
  enqueued: number;
  failed: number;
}

/**
 * Process options
 */
export interface ProcessOptions {
  concurrency?: number;
  batchSize?: number;
}

/**
 * Create schedule options
 */
export interface CreateScheduleOptions {
  timezone?: string;
  enabled?: boolean;
  overlapBehavior?: OverlapBehavior;
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxRetries: 3,
  visibilityTimeout: 30000, // 30 seconds
  batchSize: 1,
  fifo: false,
  deadLetterThreshold: 3,
  maxConcurrency: 10,
  completedJobRetention: 24 * 60 * 60 * 1000, // 24 hours
  failedJobRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
};
