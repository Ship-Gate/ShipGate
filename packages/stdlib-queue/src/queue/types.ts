/**
 * Queue-specific types
 */

import type { Job, JobId, QueueConfig, QueueStatus } from '../types.js';

export interface QueueInterface {
  // Core operations
  enqueue(job: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<JobId>;
  dequeue(): Promise<Job | null>;
  peek(): Promise<Job | null>;
  size(): Promise<number>;
  isEmpty(): Promise<boolean>;
  
  // Batch operations
  enqueueBulk(jobs: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>[]): Promise<JobId[]>;
  
  // Queue management
  pause(): Promise<void>;
  resume(): Promise<void>;
  drain(): Promise<void>;
  clear(): Promise<void>;
  
  // Status
  getStatus(): Promise<QueueStatus>;
  getMetrics(): Promise<QueueMetrics>;
}

export interface QueueMetrics {
  total: number;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  dead: number;
}

export interface QueueEvents {
  'job:enqueued': (job: Job) => void;
  'job:dequeued': (job: Job) => void;
  'job:completed': (job: Job) => void;
  'job:failed': (job: Job, error: Error) => void;
  'queue:paused': () => void;
  'queue:resumed': () => void;
  'queue:drained': () => void;
  'queue:full': () => void;
}

export interface QueueOptions {
  maxSize?: number;
  metricsEnabled?: boolean;
  persistenceEnabled?: boolean;
}
