/**
 * Individual Worker Implementation
 */

import { 
  type Job, 
  type JobHandler, 
  type JobResult, 
  type WorkerId, 
  WorkerStatus,
  type JobError 
} from '../types.js';
import type { 
  WorkerInterface, 
  WorkerConfig, 
  WorkerStats, 
  WorkerEvent,
  JobExecutor 
} from './types.js';

export class Worker implements WorkerInterface, JobExecutor {
  private id: WorkerId;
  private handler: JobHandler;
  private concurrency: number;
  private maxRetries: number;
  private retryDelay: number;
  private visibilityTimeout: number;
  private heartbeatInterval: number;
  private gracefulShutdownTimeout: number;
  
  private status: WorkerStatus = WorkerStatus.STOPPED;
  private currentJobs: Map<string, Job> = new Map();
  private eventListeners: Map<WorkerEvent, Function[]> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private startTime?: Date;
  private stats: WorkerStats;
  
  // Metrics
  private jobsProcessed = 0;
  private jobsFailed = 0;
  private processingTimes: number[] = [];
  private lastHeartbeat = new Date();

  constructor(config: WorkerConfig) {
    this.id = config.id;
    this.handler = config.handler;
    this.concurrency = config.concurrency;
    this.maxRetries = config.maxRetries;
    this.retryDelay = config.retryDelay;
    this.visibilityTimeout = config.visibilityTimeout;
    this.heartbeatInterval = config.heartbeatInterval;
    this.gracefulShutdownTimeout = config.gracefulShutdownTimeout;
    
    this.stats = {
      id: this.id,
      status: this.status,
      uptime: 0,
      jobsProcessed: 0,
      jobsFailed: 0,
      avgProcessingTime: 0,
      currentJobs: 0,
      lastHeartbeat: this.lastHeartbeat,
    };
  }

  async start(): Promise<void> {
    if (this.status !== WorkerStatus.STOPPED) {
      return;
    }

    this.status = WorkerStatus.STARTING;
    this.startTime = new Date();
    this.emit('worker:started');

    // Start heartbeat
    this.startHeartbeat();

    this.status = WorkerStatus.RUNNING;
  }

  async stop(graceful = true, timeout?: number): Promise<void> {
    if (this.status === WorkerStatus.STOPPED) {
      return;
    }

    this.status = WorkerStatus.STOPPING;
    this.emit('worker:stopped');

    if (graceful && this.currentJobs.size > 0) {
      // Wait for current jobs to finish
      const stopTimeout = timeout || this.gracefulShutdownTimeout;
      const startTime = Date.now();

      while (this.currentJobs.size > 0 && Date.now() - startTime < stopTimeout) {
        await this.sleep(100);
      }

      // Force stop if timeout reached
      if (this.currentJobs.size > 0) {
        this.currentJobs.clear();
      }
    }

    this.status = WorkerStatus.STOPPED;
    this.stopHeartbeat();
  }

  pause(): void {
    if (this.status === WorkerStatus.RUNNING) {
      this.status = WorkerStatus.PAUSED;
      this.emit('worker:paused');
    }
  }

  resume(): void {
    if (this.status === WorkerStatus.PAUSED) {
      this.status = WorkerStatus.RUNNING;
      this.emit('worker:resumed');
    }
  }

  getStatus(): WorkerStatus {
    return this.status;
  }

  isRunning(): boolean {
    return this.status === WorkerStatus.RUNNING;
  }

  isPaused(): boolean {
    return this.status === WorkerStatus.PAUSED;
  }

  async assignJob(job: Job): Promise<void> {
    if (this.status !== WorkerStatus.RUNNING) {
      throw new Error(`Worker ${this.id} is not running`);
    }

    if (this.currentJobs.size >= this.concurrency) {
      throw new Error(`Worker ${this.id} has reached concurrency limit`);
    }

    this.currentJobs.set(job.id, job);
    job.status = 'ACTIVE' as any;
    job.startedAt = new Date();
    
    this.emit('job:started', job);

    // Process job asynchronously
    this.processJob(job);
  }

  getCurrentJob(): Job | null {
    return this.currentJobs.size > 0 ? Array.from(this.currentJobs.values())[0] : null;
  }

  getCurrentJobs(): Job[] {
    return Array.from(this.currentJobs.values());
  }

  updateConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency);
  }

  updateHandler(handler: JobHandler): void {
    this.handler = handler;
  }

  // JobExecutor interface
  async execute(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.handler(job);
      const duration = Date.now() - startTime;
      
      this.recordProcessingTime(duration);
      this.jobsProcessed++;
      
      return {
        jobId: job.id,
        status: 'COMPLETED' as any,
        result: result.result,
        durationMs: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recordProcessingTime(duration);
      this.jobsFailed++;
      
      const jobError: JobError = {
        message: (error as Error).message,
        stackTrace: (error as Error).stack,
        attempt: job.attempts,
        timestamp: new Date(),
      };
      
      return {
        jobId: job.id,
        status: 'FAILED' as any,
        error: jobError,
        durationMs: duration,
      };
    }
  }

  canExecute(job: Job): boolean {
    return this.status === WorkerStatus.RUNNING && 
           this.currentJobs.size < this.concurrency;
  }

  getConcurrency(): number {
    return this.concurrency;
  }

  setConcurrency(concurrency: number): void {
    this.updateConcurrency(concurrency);
  }

  getStats(): WorkerStats {
    this.stats.status = this.status;
    this.stats.uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    this.stats.jobsProcessed = this.jobsProcessed;
    this.stats.jobsFailed = this.jobsFailed;
    this.stats.avgProcessingTime = this.calculateAvgProcessingTime();
    this.stats.currentJobs = this.currentJobs.size;
    this.stats.lastHeartbeat = this.lastHeartbeat;
    
    return { ...this.stats };
  }

  // Event handling
  on(event: WorkerEvent, listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: WorkerEvent, listener: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: WorkerEvent, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in worker event listener for ${event}:`, error);
        }
      });
    }
  }

  private async processJob(job: Job): Promise<void> {
    try {
      const result = await this.execute(job);
      
      // Update job based on result
      if (result.status === 'COMPLETED') {
        job.status = 'COMPLETED' as any;
        job.completedAt = new Date();
        job.result = result.result;
        this.emit('job:completed', job, result);
      } else {
        job.status = 'FAILED' as any;
        job.failedAt = new Date();
        job.error = result.error;
        job.attempts++;
        
        // Retry logic
        if (job.attempts < job.maxAttempts) {
          setTimeout(() => {
            this.emit('job:retry', job);
          }, this.retryDelay);
        } else {
          job.status = 'DEAD' as any;
          this.emit('job:failed', job, result);
        }
      }
    } catch (error) {
      job.status = 'FAILED' as any;
      job.failedAt = new Date();
      job.error = {
        message: (error as Error).message,
        attempt: job.attempts,
        timestamp: new Date(),
      };
      job.attempts++;
      
      this.emit('error', error);
    } finally {
      this.currentJobs.delete(job.id);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.lastHeartbeat = new Date();
      this.emit('heartbeat');
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    // Keep only last 100 processing times
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
  }

  private calculateAvgProcessingTime(): number {
    if (this.processingTimes.length === 0) {
      return 0;
    }
    
    const sum = this.processingTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.processingTimes.length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
