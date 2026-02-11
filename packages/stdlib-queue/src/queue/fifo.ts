/**
 * FIFO (First-In-First-Out) Queue Implementation
 */

import { generateUUID } from '@isl-lang/stdlib-core';
import { QueueStatus, type Job, type JobId } from '../types.js';
import type { QueueInterface, QueueMetrics, QueueEvents } from './types.js';
import { QueueFullError, QueuePausedError } from '../errors.js';

export class FIFOQueue implements QueueInterface {
  private queue: Job[] = [];
  private status: QueueStatus = QueueStatus.ACTIVE;
  private maxSize?: number;
  private metrics: QueueMetrics;
  private eventListeners: Map<keyof QueueEvents, Function[]> = new Map();

  constructor(private config: { maxSize?: number } = {}) {
    this.maxSize = config.maxSize;
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
      throw new QueuePausedError('fifo');
    }

    if (this.maxSize && this.queue.length >= this.maxSize) {
      throw new QueueFullError('fifo', this.maxSize);
    }

    const job: Job = {
      ...jobData,
      id: generateUUID(),
      createdAt: new Date(),
      attempts: 0,
      status: this.shouldDelay(jobData) ? 'DELAYED' as any : 'WAITING' as any,
    };

    if (job.status === 'WAITING') {
      this.queue.push(job);
      this.metrics.waiting++;
    } else {
      this.metrics.delayed++;
      // Schedule delayed job for later
      this.scheduleDelayedJob(job);
    }

    this.metrics.total++;
    this.emit('job:enqueued', job);

    return job.id;
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
    // Process remaining jobs but don't accept new ones
    this.emit('queue:drained');
  }

  async clear(): Promise<void> {
    this.queue = [];
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
    return { ...this.metrics };
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

  private shouldDelay(jobData: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>): boolean {
    return !!(jobData.delay && jobData.delay > 0) || 
           !!(jobData.scheduledFor && jobData.scheduledFor > new Date());
  }

  private scheduleDelayedJob(job: Job): void {
    const delay = job.delay || 
      (job.scheduledFor ? job.scheduledFor.getTime() - Date.now() : 0);

    setTimeout(() => {
      if (this.status === QueueStatus.ACTIVE) {
        job.status = 'WAITING' as any;
        this.queue.push(job);
        this.metrics.delayed--;
        this.metrics.waiting++;
      }
    }, delay);
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
