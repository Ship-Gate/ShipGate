/**
 * Worker-specific types
 */

import type { Job, JobHandler, JobResult, WorkerId, WorkerStatus } from '../types.js';

export interface WorkerInterface {
  // Lifecycle
  start(): Promise<void>;
  stop(graceful?: boolean, timeout?: number): Promise<void>;
  pause(): void;
  resume(): void;
  
  // Status
  getStatus(): WorkerStatus;
  isRunning(): boolean;
  isPaused(): boolean;
  
  // Work assignment
  assignJob(job: Job): Promise<void>;
  getCurrentJob(): Job | null;
  
  // Configuration
  updateConcurrency(concurrency: number): void;
  updateHandler(handler: JobHandler): void;
  
  // Events
  on(event: WorkerEvent, listener: (...args: any[]) => void): void;
  off(event: WorkerEvent, listener: (...args: any[]) => void): void;
}

export type WorkerEvent = 
  | 'worker:started'
  | 'worker:stopped'
  | 'worker:paused'
  | 'worker:resumed'
  | 'job:started'
  | 'job:completed'
  | 'job:failed'
  | 'job:retry'
  | 'job:progress'
  | 'heartbeat'
  | 'error';

export interface WorkerConfig {
  id: WorkerId;
  handler: JobHandler;
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  visibilityTimeout: number;
  heartbeatInterval: number;
  gracefulShutdownTimeout: number;
}

export interface WorkerStats {
  id: WorkerId;
  status: WorkerStatus;
  uptime: number;
  jobsProcessed: number;
  jobsFailed: number;
  avgProcessingTime: number;
  currentJobs: number;
  lastHeartbeat: Date;
}

export interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  workerFactory: () => Promise<WorkerInterface>;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  jobQueue: {
    size: () => Promise<number>;
    dequeue: () => Promise<Job | null>;
  };
}

export interface WorkerPoolInterface {
  // Lifecycle
  start(): Promise<void>;
  stop(graceful?: boolean, timeout?: number): Promise<void>;
  pause(): void;
  resume(): void;
  
  // Scaling
  scaleUp(count?: number): Promise<void>;
  scaleDown(count?: number): Promise<void>;
  setMinWorkers(count: number): void;
  setMaxWorkers(count: number): void;
  
  // Status
  getStats(): WorkerPoolStats;
  getWorker(id: WorkerId): WorkerInterface | null;
  getAllWorkers(): WorkerInterface[];
  
  // Events
  on(event: WorkerPoolEvent, listener: (...args: any[]) => void): void;
  off(event: WorkerPoolEvent, listener: (...args: any[]) => void): void;
}

export type WorkerPoolEvent =
  | 'pool:started'
  | 'pool:stopped'
  | 'pool:scaled_up'
  | 'pool:scaled_down'
  | 'worker:added'
  | 'worker:removed'
  | 'error';

export interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  processingJobs: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
  uptime: number;
}

export interface SchedulerInterface {
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
  
  // Job scheduling
  schedule(job: Job): Promise<void>;
  unschedule(jobId: string): Promise<void>;
  reschedule(jobId: string, newDate: Date): Promise<void>;
  
  // Status
  getScheduledCount(): Promise<number>;
  getNextScheduledTime(): Promise<Date | null>;
  
  // Events
  on(event: SchedulerEvent, listener: (...args: any[]) => void): void;
  off(event: SchedulerEvent, listener: (...args: any[]) => void): void;
}

export type SchedulerEvent =
  | 'scheduler:started'
  | 'scheduler:stopped'
  | 'job:scheduled'
  | 'job:unscheduled'
  | 'job:rescheduled'
  | 'job:triggered'
  | 'error';

export interface JobExecutor {
  execute(job: Job): Promise<JobResult>;
  canExecute(job: Job): boolean;
  getConcurrency(): number;
  setConcurrency(concurrency: number): void;
}
