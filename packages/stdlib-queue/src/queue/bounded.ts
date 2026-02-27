/**
 * Bounded Queue Implementation
 * Enforces capacity limits with configurable strategies when full
 */

import { generateUUID } from '@isl-lang/stdlib-core';
import { QueueStatus, type Job, type JobId } from '../types.js';
import type { QueueInterface, QueueMetrics, QueueEvents } from './types.js';
import { QueueFullError, QueuePausedError } from '../errors.js';

export type FullStrategy = 'reject' | 'block' | 'drop';

interface BlockRequest {
  jobData: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>;
  resolve: (jobId: JobId) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

export class BoundedQueue implements QueueInterface {
  private queue: Job[] = [];
  private status: QueueStatus = QueueStatus.ACTIVE;
  private capacity: number;
  private fullStrategy: FullStrategy;
  private blockTimeout?: number;
  private blockQueue: BlockRequest[] = [];
  private metrics: QueueMetrics;
  private eventListeners: Map<keyof QueueEvents, Function[]> = new Map();
  private droppedCount = 0;

  constructor(config: { capacity: number; fullStrategy?: FullStrategy; blockTimeout?: number }) {
    this.capacity = config.capacity;
    this.fullStrategy = config.fullStrategy || 'reject';
    this.blockTimeout = config.blockTimeout;
    this.metrics = {
      total: 0,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      dead: 0,
    };
  }

  async enqueue(jobData: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<JobId> {
    if (this.status !== QueueStatus.ACTIVE) {
      throw new QueuePausedError('bounded');
    }

    // Handle different strategies when queue is full
    if (this.queue.length >= this.capacity) {
      switch (this.fullStrategy) {
        case 'reject':
          throw new QueueFullError('bounded', this.capacity);
        
        case 'drop':
          this.droppedCount++;
          this.emit('queue:full');
          throw new QueueFullError('bounded', this.capacity);
        
        case 'block':
          return this.blockEnqueue(jobData);
      }
    }

    return this.doEnqueue(jobData);
  }

  async dequeue(): Promise<Job | null> {
    if (this.status === QueueStatus.PAUSED) {
      return null;
    }

    const job = this.queue.shift();
    if (!job) {
      return null;
    }

    job.status = 'ACTIVE' as any;
    job.startedAt = new Date();
    this.metrics.waiting--;
    this.metrics.active++;

    // Process blocked requests if space freed up
    this.processBlockQueue();

    this.emit('job:dequeued', job);
    return job;
  }

  async peek(): Promise<Job | null> {
    return this.queue[0] || null;
  }

  async size(): Promise<number> {
    return this.queue.length;
  }

  async isEmpty(): Promise<boolean> {
    return this.queue.length === 0;
  }

  async enqueueBulk(jobs: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>[]): Promise<JobId[]> {
    const jobIds: JobId[] = [];
    
    for (const jobData of jobs) {
      try {
        const jobId = await this.enqueue(jobData);
        jobIds.push(jobId);
      } catch (error) {
        // For bulk operations, we stop on first failure
        break;
      }
    }

    return jobIds;
  }

  async pause(): Promise<void> {
    this.status = QueueStatus.PAUSED;
    
    // Reject all blocked requests when pausing
    this.blockQueue.forEach(request => {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new QueuePausedError('bounded'));
    });
    this.blockQueue = [];
    
    this.emit('queue:paused');
  }

  async resume(): Promise<void> {
    this.status = QueueStatus.ACTIVE;
    this.emit('queue:resumed');
  }

  async drain(): Promise<void> {
    this.status = QueueStatus.DRAINING;
    
    // Reject all blocked requests when draining
    this.blockQueue.forEach(request => {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Queue is draining'));
    });
    this.blockQueue = [];
    
    this.emit('queue:drained');
  }

  async clear(): Promise<void> {
    this.queue = [];
    
    // Reject all blocked requests
    this.blockQueue.forEach(request => {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Queue cleared'));
    });
    this.blockQueue = [];
    
    this.metrics = {
      total: 0,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      dead: 0,
    };
  }

  async getStatus(): Promise<QueueStatus> {
    return this.status;
  }

  async getMetrics(): Promise<QueueMetrics> {
    return { 
      ...this.metrics,
      dropped: this.droppedCount,
      blocked: this.blockQueue.length,
    } as QueueMetrics & { dropped: number; blocked: number };
  }

  // Get capacity info
  getCapacity(): { capacity: number; used: number; available: number; utilization: number } {
    const used = this.queue.length;
    const available = Math.max(0, this.capacity - used);
    const utilization = used / this.capacity;
    
    return {
      capacity: this.capacity,
      used,
      available,
      utilization,
    };
  }

  // Get blocked requests count
  getBlockedCount(): number {
    return this.blockQueue.length;
  }

  // Event handling
  on<K extends keyof QueueEvents>(event: K, listener: QueueEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off<K extends keyof QueueEvents>(event: K, listener: QueueEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit<K extends keyof QueueEvents>(event: K, ...args: Parameters<QueueEvents[K]>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  private doEnqueue(jobData: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>): JobId {
    const job: Job = {
      ...jobData,
      id: generateUUID(),
      createdAt: new Date(),
      attempts: 0,
      status: 'WAITING' as any,
    };

    this.queue.push(job);
    this.metrics.waiting++;
    this.metrics.total++;
    this.emit('job:enqueued', job);

    return job.id;
  }

  private blockEnqueue(jobData: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<JobId> {
    return new Promise<JobId>((resolve, reject) => {
      const request: BlockRequest = {
        jobData,
        resolve,
        reject,
      };

      // Set timeout if configured
      if (this.blockTimeout) {
        request.timeout = setTimeout(() => {
          const index = this.blockQueue.indexOf(request);
          if (index > -1) {
            this.blockQueue.splice(index, 1);
            reject(new Error(`Block timeout after ${this.blockTimeout}ms`));
          }
        }, this.blockTimeout);
      }

      this.blockQueue.push(request);
    });
  }

  private processBlockQueue(): void {
    while (this.blockQueue.length > 0 && this.queue.length < this.capacity) {
      const request = this.blockQueue.shift();
      if (!request) break;

      if (request.timeout) {
        clearTimeout(request.timeout);
      }

      try {
        const jobId = this.doEnqueue(request.jobData);
        request.resolve(jobId);
      } catch (error) {
        request.reject(error as Error);
      }
    }
  }

  // Job completion tracking
  markJobCompleted(job: Job): void {
    job.status = 'COMPLETED' as any;
    job.completedAt = new Date();
    this.metrics.active--;
    this.metrics.completed++;
    this.emit('job:completed', job);
  }

  markJobFailed(job: Job, error: Error): void {
    job.status = 'FAILED' as any;
    job.failedAt = new Date();
    job.error = {
      message: error.message,
      attempt: job.attempts,
      timestamp: new Date(),
    };
    this.metrics.active--;
    this.metrics.failed++;
    this.emit('job:failed', job, error);
  }
}
