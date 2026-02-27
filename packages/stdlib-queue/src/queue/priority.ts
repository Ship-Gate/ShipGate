/**
 * Priority Queue Implementation
 * Higher priority numbers are processed first
 */

import { generateUUID } from '@isl-lang/stdlib-core';
import { QueueStatus, type Job, type JobId } from '../types.js';
import type { QueueInterface, QueueMetrics, QueueEvents } from './types.js';
import { QueueFullError, QueuePausedError } from '../errors.js';

interface PriorityNode {
  job: Job;
  priority: number;
  insertOrder: number;
}

export class PriorityQueue implements QueueInterface {
  private heap: PriorityNode[] = [];
  private status: QueueStatus = QueueStatus.ACTIVE;
  private maxSize?: number;
  private maxPriority?: number;
  private metrics: QueueMetrics;
  private eventListeners: Map<keyof QueueEvents, Function[]> = new Map();
  private insertCounter = 0;

  constructor(config: { maxSize?: number; maxPriority?: number } = {}) {
    this.maxSize = config.maxSize;
    this.maxPriority = config.maxPriority;
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
      throw new QueuePausedError('priority');
    }

    if (this.maxSize && this.heap.length >= this.maxSize) {
      throw new QueueFullError('priority', this.maxSize);
    }

    const priority = Math.min(jobData.priority || 0, this.maxPriority || Infinity);
    
    const job: Job = {
      ...jobData,
      id: generateUUID(),
      createdAt: new Date(),
      attempts: 0,
      status: this.shouldDelay(jobData) ? 'DELAYED' as any : 'WAITING' as any,
    };

    const node: PriorityNode = {
      job,
      priority,
      insertOrder: this.insertCounter++,
    };

    if (job.status === 'WAITING') {
      this.push(node);
      this.metrics.waiting++;
    } else {
      this.metrics.delayed++;
      this.scheduleDelayedJob(node);
    }

    this.metrics.total++;
    this.emit('job:enqueued', job);

    return job.id;
  }

  async dequeue(): Promise<Job | null> {
    if (this.status === QueueStatus.PAUSED || this.heap.length === 0) {
      return null;
    }

    const node = this.pop();
    if (!node) {
      return null;
    }

    const job = node.job;
    job.status = 'ACTIVE' as any;
    job.startedAt = new Date();
    this.metrics.waiting--;
    this.metrics.active++;

    this.emit('job:dequeued', job);
    return job;
  }

  async peek(): Promise<Job | null> {
    return this.heap.length > 0 ? this.heap[0].job : null;
  }

  async size(): Promise<number> {
    return this.heap.length;
  }

  async isEmpty(): Promise<boolean> {
    return this.heap.length === 0;
  }

  async enqueueBulk(jobs: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>[]): Promise<JobId[]> {
    const jobIds: JobId[] = [];
    
    // For better performance, we can build the heap and then heapify
    const nodes: PriorityNode[] = [];
    
    for (const jobData of jobs) {
      if (this.status !== QueueStatus.ACTIVE) {
        throw new QueuePausedError('priority');
      }

      if (this.maxSize && this.heap.length + nodes.length >= this.maxSize) {
        throw new QueueFullError('priority', this.maxSize);
      }

      const priority = Math.min(jobData.priority || 0, this.maxPriority || Infinity);
      
      const job: Job = {
        ...jobData,
        id: generateUUID(),
        createdAt: new Date(),
        attempts: 0,
        status: this.shouldDelay(jobData) ? 'DELAYED' as any : 'WAITING' as any,
      };

      const node: PriorityNode = {
        job,
        priority,
        insertOrder: this.insertCounter++,
      };

      if (job.status === 'WAITING') {
        nodes.push(node);
        this.metrics.waiting++;
      } else {
        this.metrics.delayed++;
        this.scheduleDelayedJob(node);
      }

      this.metrics.total++;
      jobIds.push(job.id);
      this.emit('job:enqueued', job);
    }

    // Bulk insert into heap
    if (nodes.length > 0) {
      this.heap.push(...nodes);
      this.heapify();
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
    this.heap = [];
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

  // Heap operations
  private push(node: PriorityNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  private pop(): PriorityNode | null {
    if (this.heap.length === 0) return null;
    
    if (this.heap.length === 1) {
      return this.heap.pop()!;
    }

    const root = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return root;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      
      if (this.compare(this.heap[index], this.heap[parentIndex]) <= 0) {
        break;
      }

      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let largest = index;

      if (leftChild < this.heap.length && 
          this.compare(this.heap[leftChild], this.heap[largest]) > 0) {
        largest = leftChild;
      }

      if (rightChild < this.heap.length && 
          this.compare(this.heap[rightChild], this.heap[largest]) > 0) {
        largest = rightChild;
      }

      if (largest === index) {
        break;
      }

      [this.heap[index], this.heap[largest]] = [this.heap[largest], this.heap[index]];
      index = largest;
    }
  }

  private heapify(): void {
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.bubbleDown(i);
    }
  }

  private compare(a: PriorityNode, b: PriorityNode): number {
    // Higher priority first
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // FIFO for same priority (lower insert order first)
    return b.insertOrder - a.insertOrder;
  }

  private shouldDelay(jobData: Omit<Job, 'id' | 'createdAt' | 'attempts' | 'status'>): boolean {
    return !!(jobData.delay && jobData.delay > 0) || 
           !!(jobData.scheduledFor && jobData.scheduledFor > new Date());
  }

  private scheduleDelayedJob(node: PriorityNode): void {
    const job = node.job;
    const delay = job.delay || 
      (job.scheduledFor ? job.scheduledFor.getTime() - Date.now() : 0);

    setTimeout(() => {
      if (this.status === QueueStatus.ACTIVE) {
        job.status = 'WAITING' as any;
        this.push(node);
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
