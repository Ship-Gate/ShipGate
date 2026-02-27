/**
 * Job Scheduler Implementation
 * Handles delayed and recurring job scheduling
 */

import type { Job, JobId } from '../types.js';
import type { SchedulerInterface, SchedulerEvent } from './types.js';

interface ScheduledJob {
  id: string;
  job: Job;
  executeAt: number;
  interval?: number; // For recurring jobs
  cronPattern?: string; // For cron-based scheduling
  maxRuns?: number;
  runCount: number;
  timeoutId?: NodeJS.Timeout;
}

export class Scheduler implements SchedulerInterface {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private sortedByTime: ScheduledJob[] = [];
  private status: 'stopped' | 'running' | 'paused' = 'stopped';
  private eventListeners: Map<SchedulerEvent, Function[]> = new Map();
  private processingTimer?: NodeJS.Timeout;
  private resolution = 1000; // Check every second

  start(): Promise<void> {
    if (this.status !== 'stopped') {
      return Promise.resolve();
    }

    this.status = 'running';
    this.emit('scheduler:started');
    this.startProcessing();

    return Promise.resolve();
  }

  stop(): Promise<void> {
    if (this.status === 'stopped') {
      return Promise.resolve();
    }

    this.status = 'stopped';
    this.emit('scheduler:stopped');

    // Clear all timeouts
    for (const scheduledJob of Array.from(this.scheduledJobs.values())) {
      if (scheduledJob.timeoutId) {
        clearTimeout(scheduledJob.timeoutId);
      }
    }

    // Stop processing timer
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }

    return Promise.resolve();
  }

  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
    }
  }

  resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
    }
  }

  async schedule(job: Job, executeAt?: Date, options?: {
    interval?: number;
    cron?: string;
    maxRuns?: number;
  }): Promise<void> {
    const scheduledAt = executeAt || job.scheduledFor || new Date();
    const executeTime = scheduledAt.getTime();

    const scheduledJob: ScheduledJob = {
      id: `scheduled_${job.id}_${Date.now()}`,
      job,
      executeAt: executeTime,
      interval: options?.interval,
      cronPattern: options?.cron,
      maxRuns: options?.maxRuns,
      runCount: 0,
    };

    this.scheduledJobs.set(scheduledJob.id, scheduledJob);
    this.insertSorted(scheduledJob);
    
    this.emit('job:scheduled', job, scheduledAt);
  }

  async unschedule(jobId: JobId): Promise<void> {
    // Find and remove scheduled job
    for (const [scheduledId, scheduledJob] of Array.from(this.scheduledJobs.entries())) {
      if (scheduledJob.job.id === jobId) {
        if (scheduledJob.timeoutId) {
          clearTimeout(scheduledJob.timeoutId);
        }
        
        this.scheduledJobs.delete(scheduledId);
        this.removeFromSorted(scheduledJob);
        
        this.emit('job:unscheduled', jobId);
        return;
      }
    }
  }

  async reschedule(jobId: JobId, newDate: Date): Promise<void> {
    await this.unschedule(jobId);
    
    // Find the job and reschedule it
    for (const scheduledJob of Array.from(this.scheduledJobs.values())) {
      if (scheduledJob.job.id === jobId) {
        scheduledJob.executeAt = newDate.getTime();
        this.insertSorted(scheduledJob);
        this.emit('job:rescheduled', jobId, newDate);
        return;
      }
    }
  }

  async getScheduledCount(): Promise<number> {
    return this.scheduledJobs.size;
  }

  async getNextScheduledTime(): Promise<Date | null> {
    if (this.sortedByTime.length === 0) {
      return null;
    }
    
    return new Date(this.sortedByTime[0].executeAt);
  }

  // Get all scheduled jobs
  async getScheduledJobs(): Promise<ScheduledJob[]> {
    return Array.from(this.scheduledJobs.values());
  }

  // Get jobs scheduled within a time range
  async getJobsInRange(start: Date, end: Date): Promise<ScheduledJob[]> {
    const startTime = start.getTime();
    const endTime = end.getTime();
    
    return this.sortedByTime.filter(sj => 
      sj.executeAt >= startTime && sj.executeAt <= endTime
    );
  }

  // Event handling
  on(event: SchedulerEvent, listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: SchedulerEvent, listener: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private startProcessing(): void {
    this.processingTimer = setInterval(() => {
      if (this.status === 'running') {
        this.processDueJobs();
      }
    }, this.resolution);
  }

  private processDueJobs(): void {
    const now = Date.now();
    const dueJobs: ScheduledJob[] = [];

    // Find all due jobs
    while (this.sortedByTime.length > 0 && this.sortedByTime[0].executeAt <= now) {
      const scheduledJob = this.sortedByTime.shift()!;
      dueJobs.push(scheduledJob);
    }

    // Process due jobs
    for (const scheduledJob of dueJobs) {
      this.executeScheduledJob(scheduledJob);
    }
  }

  private executeScheduledJob(scheduledJob: ScheduledJob): void {
    const { job } = scheduledJob;
    scheduledJob.runCount++;

    // Update job status
    job.status = 'WAITING' as any;
    
    this.emit('job:triggered', job);

    // Handle recurring jobs
    if (scheduledJob.interval && scheduledJob.runCount < (scheduledJob.maxRuns || Infinity)) {
      // Reschedule for next run
      scheduledJob.executeAt = Date.now() + scheduledJob.interval;
      this.insertSorted(scheduledJob);
    } else if (scheduledJob.cronPattern) {
      // Calculate next run time based on cron pattern
      const nextRun = this.calculateNextCronRun(scheduledJob.cronPattern, new Date());
      if (nextRun && scheduledJob.runCount < (scheduledJob.maxRuns || Infinity)) {
        scheduledJob.executeAt = nextRun.getTime();
        this.insertSorted(scheduledJob);
      }
    } else {
      // One-time job, remove it
      this.scheduledJobs.delete(scheduledJob.id);
    }
  }

  private insertSorted(scheduledJob: ScheduledJob): void {
    // Remove from sorted array if it exists
    this.removeFromSorted(scheduledJob);
    
    // Insert in sorted order
    let insertIndex = 0;
    for (let i = 0; i < this.sortedByTime.length; i++) {
      if (this.sortedByTime[i].executeAt > scheduledJob.executeAt) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }
    
    this.sortedByTime.splice(insertIndex, 0, scheduledJob);
  }

  private removeFromSorted(scheduledJob: ScheduledJob): void {
    const index = this.sortedByTime.indexOf(scheduledJob);
    if (index > -1) {
      this.sortedByTime.splice(index, 1);
    }
  }

  private calculateNextCronRun(cronPattern: string, from: Date): Date | null {
    // Simple cron implementation - in production, use a proper cron library
    // This is a placeholder that handles basic patterns like "0 * * * *" (every hour)
    
    const parts = cronPattern.split(' ');
    if (parts.length !== 5) {
      return null;
    }
    
    const [minute, hour, day, month, weekday] = parts;
    const next = new Date(from);
    
    // Simple implementation for hourly patterns
    if (minute === '0' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
      next.setHours(next.getHours() + 1);
      next.setMinutes(0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }
    
    // Add more cron pattern parsing as needed
    return null;
  }

  private emit(event: SchedulerEvent, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in scheduler event listener for ${event}:`, error);
        }
      });
    }
  }
}
