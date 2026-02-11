/**
 * In-memory Job Store Implementation
 */

import type { 
  Job, 
  JobId, 
  JobStatus 
} from '../types.js';
import type { 
  JobStore,
  JobHistoryEntry,
  JobEvent 
} from './types.js';

export class MemoryJobStore implements JobStore {
  private jobs: Map<JobId, Job> = new Map();
  private queueIndex: Map<string, Set<JobId>> = new Map();
  private statusIndex: Map<JobStatus, Set<JobId>> = new Map();
  private parentIndex: Map<JobId, Set<JobId>> = new Map();
  private history: Map<JobId, JobHistoryEntry[]> = new Map();
  private eventListeners: Map<JobEvent, Function[]> = new Map();

  async save(job: Job): Promise<void> {
    const isNew = !this.jobs.has(job.id);
    
    this.jobs.set(job.id, job);
    
    // Update indexes
    this.updateQueueIndex(job.id, job.queueId);
    this.updateStatusIndex(job.id, job.status);
    
    if (job.parentId) {
      this.updateParentIndex(job.parentId, job.id);
    }
    
    // Record history
    this.recordHistory(job.id, job.status, 'Job saved');
    
    // Emit events
    if (isNew) {
      this.emit('job:created', job);
    }
  }

  async get(jobId: JobId): Promise<Job | null> {
    return this.jobs.get(jobId) || null;
  }

  async update(jobId: JobId, updates: Partial<Job>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    const oldStatus = job.status;
    
    // Update job
    Object.assign(job, updates);
    
    // Update indexes if status changed
    if (updates.status && updates.status !== oldStatus) {
      this.updateStatusIndex(jobId, oldStatus, true);
      this.updateStatusIndex(jobId, updates.status);
      this.recordHistory(jobId, updates.status, `Status changed from ${oldStatus}`);
    }
    
    // Update queue index if queue changed
    if (updates.queueId && updates.queueId !== job.queueId) {
      this.updateQueueIndex(jobId, job.queueId, true);
      this.updateQueueIndex(jobId, updates.queueId);
    }
  }

  async delete(jobId: JobId): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    // Remove from indexes
    this.updateQueueIndex(jobId, job.queueId, true);
    this.updateStatusIndex(jobId, job.status, true);
    
    if (job.parentId) {
      const children = this.parentIndex.get(job.parentId);
      if (children) {
        children.delete(jobId);
        if (children.size === 0) {
          this.parentIndex.delete(job.parentId);
        }
      }
    }
    
    // Remove from store
    this.jobs.delete(jobId);
    this.history.delete(jobId);
  }

  async findByQueue(queueId: string, status?: JobStatus[], limit?: number): Promise<Job[]> {
    const queueJobs = this.queueIndex.get(queueId) || new Set();
    const jobs: Job[] = [];
    
    for (const jobId of queueJobs) {
      const job = this.jobs.get(jobId);
      if (job && (!status || status.includes(job.status))) {
        jobs.push(job);
        if (limit && jobs.length >= limit) {
          break;
        }
      }
    }
    
    return jobs;
  }

  async findByStatus(status: JobStatus, limit?: number): Promise<Job[]> {
    const statusJobs = this.statusIndex.get(status) || new Set();
    const jobs: Job[] = [];
    
    for (const jobId of statusJobs) {
      const job = this.jobs.get(jobId);
      if (job) {
        jobs.push(job);
        if (limit && jobs.length >= limit) {
          break;
        }
      }
    }
    
    return jobs;
  }

  async findByParent(parentId: JobId): Promise<Job[]> {
    const children = this.parentIndex.get(parentId) || new Set();
    const jobs: Job[] = [];
    
    for (const jobId of children) {
      const job = this.jobs.get(jobId);
      if (job) {
        jobs.push(job);
      }
    }
    
    return jobs;
  }

  async findDelayed(before: Date): Promise<Job[]> {
    const jobs: Job[] = [];
    
    for (const job of this.jobs.values()) {
      if (job.status === 'DELAYED' && job.scheduledFor && job.scheduledFor <= before) {
        jobs.push(job);
      }
    }
    
    return jobs;
  }

  async findFailed(maxAttempts?: number): Promise<Job[]> {
    const jobs: Job[] = [];
    
    for (const job of this.jobs.values()) {
      if (job.status === 'FAILED' && 
          (!maxAttempts || job.attempts < maxAttempts)) {
        jobs.push(job);
      }
    }
    
    return jobs;
  }

  async countByStatus(queueId?: string): Promise<Map<JobStatus, number>> {
    const counts = new Map<JobStatus, number>();
    
    // Initialize counts
    for (const status of Object.values(JobStatus)) {
      counts.set(status, 0);
    }
    
    if (queueId) {
      // Count for specific queue
      const queueJobs = this.queueIndex.get(queueId) || new Set();
      for (const jobId of queueJobs) {
        const job = this.jobs.get(jobId);
        if (job) {
          const count = counts.get(job.status) || 0;
          counts.set(job.status, count + 1);
        }
      }
    } else {
      // Count all jobs
      for (const job of this.jobs.values()) {
        const count = counts.get(job.status) || 0;
        counts.set(job.status, count + 1);
      }
    }
    
    return counts;
  }

  async countByQueue(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    
    for (const [queueId, jobIds] of this.queueIndex.entries()) {
      counts.set(queueId, jobIds.size);
    }
    
    return counts;
  }

  async deleteOlderThan(date: Date, status?: JobStatus[]): Promise<number> {
    let deleted = 0;
    const jobIdsToDelete: JobId[] = [];
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < date && (!status || status.includes(job.status))) {
        jobIdsToDelete.push(jobId);
      }
    }
    
    for (const jobId of jobIdsToDelete) {
      await this.delete(jobId);
      deleted++;
    }
    
    return deleted;
  }

  async deleteByQueue(queueId: string): Promise<number> {
    const queueJobs = this.queueIndex.get(queueId) || new Set();
    let deleted = 0;
    
    for (const jobId of queueJobs) {
      await this.delete(jobId);
      deleted++;
    }
    
    return deleted;
  }

  // History management
  async getHistory(jobId: JobId): Promise<JobHistoryEntry[]> {
    return this.history.get(jobId) || [];
  }

  async addHistoryEntry(jobId: JobId, entry: JobHistoryEntry): Promise<void> {
    const history = this.history.get(jobId) || [];
    history.push(entry);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    
    this.history.set(jobId, history);
  }

  // Event handling
  on(event: JobEvent, listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: JobEvent, listener: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Utility methods
  async clear(): Promise<void> {
    this.jobs.clear();
    this.queueIndex.clear();
    this.statusIndex.clear();
    this.parentIndex.clear();
    this.history.clear();
  }

  async size(): Promise<number> {
    return this.jobs.size;
  }

  private updateQueueIndex(jobId: JobId, queueId: string, remove = false): void {
    if (remove) {
      const jobs = this.queueIndex.get(queueId);
      if (jobs) {
        jobs.delete(jobId);
        if (jobs.size === 0) {
          this.queueIndex.delete(queueId);
        }
      }
    } else {
      if (!this.queueIndex.has(queueId)) {
        this.queueIndex.set(queueId, new Set());
      }
      this.queueIndex.get(queueId)!.add(jobId);
    }
  }

  private updateStatusIndex(jobId: JobId, status: JobStatus, remove = false): void {
    if (remove) {
      const jobs = this.statusIndex.get(status);
      if (jobs) {
        jobs.delete(jobId);
        if (jobs.size === 0) {
          this.statusIndex.delete(status);
        }
      }
    } else {
      if (!this.statusIndex.has(status)) {
        this.statusIndex.set(status, new Set());
      }
      this.statusIndex.get(status)!.add(jobId);
    }
  }

  private updateParentIndex(parentId: JobId, childId: JobId): void {
    if (!this.parentIndex.has(parentId)) {
      this.parentIndex.set(parentId, new Set());
    }
    this.parentIndex.get(parentId)!.add(childId);
  }

  private recordHistory(jobId: JobId, status: JobStatus, message: string): void {
    const entry: JobHistoryEntry = {
      timestamp: new Date(),
      status,
      message,
    };
    
    const history = this.history.get(jobId) || [];
    history.push(entry);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    
    this.history.set(jobId, history);
  }

  private emit(event: JobEvent, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in job store event listener for ${event}:`, error);
        }
      });
    }
  }
}
