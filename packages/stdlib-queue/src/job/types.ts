/**
 * Job-specific types
 */

import type { Job, JobId, JobStatus, JobHandler, JobResult } from '../types.js';

export interface JobStore {
  // CRUD operations
  save(job: Job): Promise<void>;
  get(jobId: JobId): Promise<Job | null>;
  update(jobId: JobId, updates: Partial<Job>): Promise<void>;
  delete(jobId: JobId): Promise<void>;
  
  // Query operations
  findByQueue(queueId: string, status?: JobStatus[], limit?: number): Promise<Job[]>;
  findByStatus(status: JobStatus, limit?: number): Promise<Job[]>;
  findByParent(parentId: JobId): Promise<Job[]>;
  findDelayed(before: Date): Promise<Job[]>;
  findFailed(maxAttempts?: number): Promise<Job[]>;
  
  // Metrics
  countByStatus(queueId?: string): Promise<Map<JobStatus, number>>;
  countByQueue(): Promise<Map<string, number>>;
  
  // Cleanup
  deleteOlderThan(date: Date, status?: JobStatus[]): Promise<number>;
  deleteByQueue(queueId: string): Promise<number>;
}

export interface JobProcessor {
  // Processing
  process(job: Job): Promise<JobResult>;
  processBatch(jobs: Job[]): Promise<JobResult[]>;
  
  // Configuration
  setHandler(handler: JobHandler): void;
  setTimeout(timeout: number): void;
  setRetryPolicy(policy: RetryPolicy): void;
  
  // Status
  getProcessingCount(): number;
  getProcessedCount(): number;
  getFailedCount(): number;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: BackoffStrategy;
  retryableErrors?: string[];
}

export type BackoffStrategy = 
  | 'fixed'
  | 'linear'
  | 'exponential'
  | 'custom';

export interface CustomBackoff {
  calculate(attempt: number): number;
}

export interface JobTracker {
  // Lifecycle tracking
  track(job: Job): Promise<void>;
  updateStatus(jobId: JobId, status: JobStatus): Promise<void>;
  updateProgress(jobId: JobId, progress: number, message?: string): Promise<void>;
  
  // State queries
  getStatus(jobId: JobId): Promise<JobStatus>;
  getProgress(jobId: JobId): Promise<number>;
  getHistory(jobId: JobId): Promise<JobHistoryEntry[]>;
  
  // Dependencies
  addDependency(jobId: JobId, dependsOn: JobId): Promise<void>;
  removeDependency(jobId: JobId, dependsOn: JobId): Promise<void>;
  getDependencies(jobId: JobId): Promise<JobId[]>;
  getDependents(jobId: JobId): Promise<JobId[]>;
  canExecute(jobId: JobId): Promise<boolean>;
  
  // Events
  on(event: JobEvent, listener: (...args: any[]) => void): void;
  off(event: JobEvent, listener: (...args: any[]) => void): void;
}

export interface JobHistoryEntry {
  timestamp: Date;
  status: JobStatus;
  message?: string;
  metadata?: Record<string, any>;
}

export type JobEvent = 
  | 'job:created'
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:cancelled'
  | 'job:retry'
  | 'job:timeout';

export interface JobDependencyGraph {
  // Graph operations
  addNode(jobId: JobId): void;
  removeNode(jobId: JobId): void;
  addEdge(from: JobId, to: JobId): void;
  removeEdge(from: JobId, to: JobId): void;
  
  // Queries
  getParents(jobId: JobId): JobId[];
  getChildren(jobId: JobId): JobId[];
  getAncestors(jobId: JobId): JobId[];
  getDescendants(jobId: JobId): JobId[];
  hasCycle(): boolean;
  topologicalSort(): JobId[];
  
  // Ready jobs
  getReadyJobs(): JobId[];
  isReady(jobId: JobId): boolean;
}

export interface JobPriorityQueue {
  // Priority queue operations
  enqueue(job: Job, priority?: number): Promise<void>;
  dequeue(): Promise<Job | null>;
  peek(): Promise<Job | null>;
  remove(jobId: JobId): Promise<boolean>;
  
  // Bulk operations
  enqueueBulk(jobs: Job[]): Promise<void>;
  dequeueBatch(count: number): Promise<Job[]>;
  
  // Status
  size(): Promise<number>;
  isEmpty(): Promise<boolean>;
  contains(jobId: JobId): Promise<boolean>;
  
  // Priority management
  updatePriority(jobId: JobId, priority: number): Promise<void>;
  getPriority(jobId: JobId): Promise<number>;
}

export interface JobMetrics {
  // Counters
  total: number;
  byStatus: Map<JobStatus, number>;
  byQueue: Map<string, number>;
  
  // Timing
  avgWaitTime: number;
  avgProcessTime: number;
  avgTotalTime: number;
  
  // Rates
  throughput: number; // jobs per second
  errorRate: number; // percentage
  
  // Queue specific
  queueDepths: Map<string, number>;
  processingTimes: Map<string, number>;
}

export interface JobEventListener {
  onJobEvent(event: JobEvent, job: Job, data?: any): Promise<void>;
}

export interface JobValidator {
  validate(job: Job): ValidationResult;
  validatePayload(payload: unknown): ValidationResult;
  validateDependencies(jobId: JobId, dependencies: JobId[]): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface JobSerializer {
  serialize(job: Job): string;
  deserialize(data: string): Job;
  canSerialize(job: Job): boolean;
}

export interface JobDeduplicator {
  checkDuplicate(key: string, window?: number): Promise<boolean>;
  record(key: string, jobId: JobId, window?: number): Promise<void>;
  remove(key: string): Promise<void>;
  cleanup(): Promise<void>;
}
