/**
 * Delay Queue Implementation
 * Handles delayed and scheduled jobs efficiently
 */

import { generateUUID } from '@isl-lang/stdlib-core';
import { QueueStatus, type Job, type JobId } from '../types.js';
import type { QueueInterface, QueueMetrics, QueueEvents } from './types.js';
import { QueueFullError, QueuePausedError } from '../errors.js';

interface DelayedJob {
  job: Job;
  executeAt: number;
  timeoutId?: NodeJS.Timeout;
}

export class DelayQueue implements QueueInterface {
  private readyQueue: Job[] = [];
  private delayedHeap: DelayedJob[] = [];
  private status: QueueStatus = QueueStatus.ACTIVE;
  private maxSize?: number;
  private delayResolution: number;
  private metrics: QueueMetrics;
  private eventListeners: Map<keyof QueueEvents, Function[]> = new Map();
  private processingTimer?: NodeJS.Timeout;

  constructor(config: { maxSize?: number; delayResolution?: number } = {}) {
    this.maxSize = config.maxSize;
    this.delayResolution = config.delayResolution || 1000; // Check every second by default
    this.metrics = {
      total: 0,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      dead: 0,
    };
    
    // Start the delay processor
    this.startDelayProcessor();
  }

  async enqueue(jobData: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<JobId> {
    if (this.status !== QueueStatus.ACTIVE) {
      throw new QueuePausedError('delay');
    }

    if (this.maxSize && this.getTotalSize() >= this.maxSize) {
      throw new QueueFullError('delay', this.maxSize);
    }

    const job: Job = {
      ...jobData,
      id: generateUUID(),
      createdAt: new Date(),
      attempts: 0,
      status: 'WAITING' as any,
    };

    const executeAt = this.calculateExecuteAt(job);

    if (executeAt <= Date.now()) {
      // Job is ready to execute now
      this.readyQueue.push(job);
      this.metrics.waiting++;
    } else {
      // Job is delayed
      const delayedJob: DelayedJob = {
        job,
        executeAt,
      };
      this.insertDelayed(delayedJob);
      job.status = 'DELAYED' as any;
      this.metrics.delayed++;
    }

    this.metrics.total++;
    this.emit('job:enqueued', job);

    return job.id;
  }

  async dequeue(): Promise<Job | null> {
    if (this.status === QueueStatus.PAUSED) {
      return null;
    }

    // Process any ready delayed jobs first
    this.processDelayedJobs();

    // Then dequeue from ready queue
    const job = this.readyQueue.shift();
    if (!job) {
      return null;
    }

    job.status = 'ACTIVE' as any;
    job.startedAt = new Date();
    this.metrics.waiting--;
    this.metrics.active++;

    this.emit('job:dequeued', job);
    return job;
  }

  async peek(): Promise<Job | null> {
    this.processDelayedJobs();
    return this.readyQueue[0] || null;
  }

  async size(): Promise<number> {
    return this.readyQueue.length;
  }

  async isEmpty(): Promise<boolean> {
    this.processDelayedJobs();
    return this.readyQueue.length === 0;
  }

  async enqueueBulk(jobs: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>[]): Promise<JobId[]> {
    const jobIds: JobId[] = [];
    
    for (const jobData of jobs) {
      const jobId = await this.enqueue(jobData);
      jobIds.push(jobId);
    }

    return jobIds;
  }

  async pause(): Promise<void> {
    this.status = QueueStatus.PAUSED;
    this.emit('queue:paused');
  }

  async resume(): Promise<void> {
    this.status = QueueStatus.ACTIVE;
    this.emit('queue:resumed');
  }

  async drain(): Promise<void> {
    this.status = QueueStatus.DRAINING;
    this.emit('queue:drained');
  }

  async clear(): Promise<void> {
    // Clear all timeouts
    this.delayedHeap.forEach(delayedJob => {
      if (delayedJob.timeoutId) {
        clearTimeout(delayedJob.timeoutId);
      }
    });

    this.readyQueue = [];
    this.delayedHeap = [];
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
      waiting: this.readyQueue.length,
      delayed: this.delayedHeap.length,
    };
  }

  // Get total size including delayed jobs
  async getTotalSize(): Promise<number> {
    return this.readyQueue.length + this.delayedHeap.length;
  }

  // Get next job execution time
  async getNextExecutionTime(): Promise<Date | null> {
    if (this.delayedHeap.length === 0) {
      return null;
    }
    return new Date(this.delayedHeap[0].executeAt);
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

  private calculateExecuteAt(job: Job): number {
    const now = Date.now();
    
    if (job.scheduledFor) {
      return job.scheduledFor.getTime();
    }
    
    if (job.delay && job.delay > 0) {
      return now + job.delay;
    }
    
    return now;
  }

  private insertDelayed(delayedJob: DelayedJob): void {
    this.delayedHeap.push(delayedJob);
    this.bubbleUp(this.delayedHeap.length - 1);
  }

  private startDelayProcessor(): void {
    this.processingTimer = setInterval(() => {
      if (this.status === QueueStatus.ACTIVE) {
        this.processDelayedJobs();
      }
    }, this.delayResolution);
  }

  private processDelayedJobs(): void {
    const now = Date.now();
    
    while (this.delayedHeap.length > 0 && this.delayedHeap[0].executeAt <= now) {
      const delayedJob = this.popDelayed();
      if (delayedJob) {
        delayedJob.job.status = 'WAITING' as any;
        this.readyQueue.push(delayedJob.job);
        this.metrics.delayed--;
        this.metrics.waiting++;
      }
    }
  }

  private popDelayed(): DelayedJob | null {
    if (this.delayedHeap.length === 0) return null;
    
    if (this.delayedHeap.length === 1) {
      return this.delayedHeap.pop()!;
    }

    const root = this.delayedHeap[0];
    this.delayedHeap[0] = this.delayedHeap.pop()!;
    this.bubbleDown(0);
    return root;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      
      if (this.delayedHeap[index].executeAt >= this.delayedHeap[parentIndex].executeAt) {
        break;
      }

      [this.delayedHeap[index], this.delayedHeap[parentIndex]] = 
        [this.delayedHeap[parentIndex], this.delayedHeap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < this.delayedHeap.length && 
          this.delayedHeap[leftChild].executeAt < this.delayedHeap[smallest].executeAt) {
        smallest = leftChild;
      }

      if (rightChild < this.delayedHeap.length && 
          this.delayedHeap[rightChild].executeAt < this.delayedHeap[smallest].executeAt) {
        smallest = rightChild;
      }

      if (smallest === index) {
        break;
      }

      [this.delayedHeap[index], this.delayedHeap[smallest]] = 
        [this.delayedHeap[smallest], this.delayedHeap[index]];
      index = smallest;
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

  // Cleanup
  destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    this.clear();
  }
}
