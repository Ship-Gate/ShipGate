/**
 * Core types for the queue system
 */

import type { UUID } from '@isl-lang/stdlib-core';

export type QueueId = string;
export type JobId = UUID;
export type WorkerId = string;

export interface QueueConfig {
  maxRetries: number;
  visibilityTimeout: number; // in milliseconds
  batchSize: number;
  fifo: boolean;
  deadLetterQueue?: QueueId;
  deadLetterThreshold: number;
  rateLimit?: {
    maxPerSecond: number;
    burst?: number;
  };
  maxConcurrency: number;
  completedJobRetention: number; // in milliseconds
  failedJobRetention: number; // in milliseconds
}

export enum QueueStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DRAINING = 'DRAINING',
  DELETED = 'DELETED',
}

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

export enum JobStatus {
  WAITING = 'WAITING',
  DELAYED = 'DELAYED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DEAD = 'DEAD',
  CANCELLED = 'CANCELLED',
}

export interface JobError {
  message: string;
  code?: string;
  stackTrace?: string;
  attempt: number;
  timestamp: Date;
}

export interface Job {
  id: JobId;
  queueId: QueueId;
  name: string;
  data: unknown;
  status: JobStatus;
  progress?: number;
  priority: number;
  delay?: number;
  scheduledFor?: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  result?: unknown;
  error?: JobError;
  parentId?: JobId;
  childrenIds?: JobId[];
  correlationId?: UUID;
  traceId?: string;
}

export type JobHandler = (job: Job) => Promise<JobResult>;

export interface JobResult {
  jobId: JobId;
  status: JobStatus;
  result?: unknown;
  error?: JobError;
  durationMs: number;
}

export interface EnqueueOptions {
  priority?: number;
  delay?: number;
  scheduledFor?: Date;
  maxAttempts?: number;
  dedupeKey?: string;
  dedupeWindow?: number;
  parentId?: JobId;
  correlationId?: UUID;
}

export interface BulkEnqueueResult {
  jobIds: JobId[];
  enqueued: number;
  failed: number;
}

export enum WorkerStatus {
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
}

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

export interface WorkerOptions {
  concurrency: number;
  batchSize: number;
  pollInterval: number;
  visibilityTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

export interface BackpressureStrategy {
  name: string;
  shouldBlock(queue: Queue): boolean;
  onBlock?(queue: Queue): void;
  onUnblock?(queue: Queue): void;
}

export interface BackpressureConfig {
  strategy: BackpressureStrategy;
  threshold: number;
  timeout?: number;
}

export interface JobStore {
  // Job operations
  save(job: Job): Promise<void>;
  get(jobId: JobId): Promise<Job | null>;
  update(jobId: JobId, updates: Partial<Job>): Promise<void>;
  delete(jobId: JobId): Promise<void>;
  
  // Queue operations
  getQueueJobs(queueId: QueueId, status?: JobStatus[], limit?: number): Promise<Job[]>;
  getJobsByParent(parentId: JobId): Promise<Job[]>;
  
  // Cleanup
  cleanOldJobs(queueId: QueueId, olderThan: Date, status?: JobStatus[]): Promise<number>;
}

export interface QueueMetrics {
  size: number;
  processing: number;
  delayed: number;
  failed: number;
  completed: number;
  avgProcessingTime: number;
  throughput: number; // jobs per second
}

export interface ProcessOptions {
  concurrency?: number;
  batchSize?: number;
  autoAck?: boolean;
  visibilityTimeout?: number;
}

export interface ScheduledJob {
  id: UUID;
  queueId: QueueId;
  name: string;
  data: unknown;
  schedule: Schedule;
  timezone: string;
  enabled: boolean;
  nextRunAt?: Date;
  lastRunAt?: Date;
  lastJobId?: JobId;
  overlapBehavior: OverlapBehavior;
}

export interface Schedule {
  cron?: string;
  interval?: number;
  at?: string[];
}

export enum OverlapBehavior {
  SKIP = 'SKIP',
  ENQUEUE = 'ENQUEUE',
  CANCEL = 'CANCEL',
}

export interface JobProcessor {
  process(job: Job): Promise<JobResult>;
  canProcess(job: Job): boolean;
}

export interface WorkerPool {
  start(): Promise<void>;
  stop(graceful?: boolean, timeout?: number): Promise<void>;
  pause(): void;
  resume(): void;
  addWorker(workerId: WorkerId): void;
  removeWorker(workerId: WorkerId): Promise<void>;
  getStats(): WorkerPoolStats;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  processingJobs: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
}

export interface QueueOptions {
  maxSize?: number;
  backpressure?: BackpressureConfig;
  metrics?: boolean;
}

export interface FIFOQueueOptions extends QueueOptions {
  preserveOrder: boolean;
}

export interface PriorityQueueOptions extends QueueOptions {
  maxPriority?: number;
}

export interface DelayQueueOptions extends QueueOptions {
  delayResolution: number; // in milliseconds
}

export interface BoundedQueueOptions extends QueueOptions {
  capacity: number;
  fullStrategy: 'reject' | 'block' | 'drop';
}
