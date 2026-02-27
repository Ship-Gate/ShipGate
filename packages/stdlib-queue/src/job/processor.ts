/**
 * Job Processor Implementation
 */

import type { 
  Job, 
  JobId, 
  JobHandler, 
  JobResult, 
  JobStatus,
  JobError 
} from '../types.js';
import type { 
  JobProcessor,
  RetryPolicy,
  BackoffStrategy,
  CustomBackoff,
  JobEvent 
} from './types.js';

export class DefaultJobProcessor implements JobProcessor {
  private handler?: JobHandler;
  private timeout = 30000; // 30 seconds default
  private retryPolicy: RetryPolicy = {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
  };
  
  private processingJobs = new Set<JobId>();
  private processedCount = 0;
  private failedCount = 0;
  private eventListeners: Map<JobEvent, Function[]> = new Map();

  async process(job: Job): Promise<JobResult> {
    if (!this.handler) {
      throw new Error('No job handler configured');
    }

    this.processingJobs.add(job.id);
    const startTime = Date.now();

    try {
      // Update job status
      job.status = 'ACTIVE' as any;
      job.startedAt = new Date();
      job.attempts++;
      
      this.emit('job:started', job);

      // Execute with timeout
      const result = await this.executeWithTimeout(job);
      const duration = Date.now() - startTime;

      // Update job on success
      job.status = 'COMPLETED' as any;
      job.completedAt = new Date();
      job.result = result.result;
      
      this.processedCount++;
      this.emit('job:completed', job);

      return {
        jobId: job.id,
        status: 'COMPLETED' as any,
        result: result.result,
        durationMs: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update job on failure
      job.status = 'FAILED' as any;
      job.failedAt = new Date();
      job.error = this.createJobError(error as Error, job.attempts);
      
      this.failedCount++;
      this.emit('job:failed', job, error);

      // Check if should retry
      if (this.shouldRetry(job)) {
        job.status = 'WAITING' as any;
        const retryDelay = this.calculateRetryDelay(job.attempts);
        
        setTimeout(() => {
          job.delay = retryDelay;
          this.emit('job:retry', job);
        }, retryDelay);
      } else {
        job.status = 'DEAD' as any;
      }

      return {
        jobId: job.id,
        status: job.status as any,
        error: job.error,
        durationMs: duration,
      };
    } finally {
      this.processingJobs.delete(job.id);
    }
  }

  async processBatch(jobs: Job[]): Promise<JobResult[]> {
    const results: JobResult[] = [];
    
    // Process jobs in parallel based on concurrency
    const concurrency = 10; // Default concurrency
    const chunks = this.chunkArray(jobs, concurrency);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(job => this.process(job))
      );
      results.push(...chunkResults);
    }
    
    return results;
  }

  setHandler(handler: JobHandler): void {
    this.handler = handler;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  setRetryPolicy(policy: RetryPolicy): void {
    this.retryPolicy = { ...this.retryPolicy, ...policy };
  }

  getProcessingCount(): number {
    return this.processingJobs.size;
  }

  getProcessedCount(): number {
    return this.processedCount;
  }

  getFailedCount(): number {
    return this.failedCount;
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

  private async executeWithTimeout(job: Job): Promise<JobResult> {
    if (!this.handler) {
      throw new Error('No handler configured');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Job timeout after ${this.timeout}ms`));
      }, this.timeout);

      this.handler(job)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private shouldRetry(job: Job): boolean {
    if (job.attempts >= this.retryPolicy.maxAttempts) {
      return false;
    }

    if (!job.error) {
      return true;
    }

    // Check if error is retryable
    if (this.retryPolicy.retryableErrors) {
      return this.retryPolicy.retryableErrors.includes(job.error.code || '');
    }

    return true;
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    
    switch (this.retryPolicy.backoffStrategy) {
      case 'fixed':
        return baseDelay;
      
      case 'linear':
        return baseDelay * attempt;
      
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      
      case 'custom':
        if ((this.retryPolicy as any).customBackoff) {
          return (this.retryPolicy as any).customBackoff.calculate(attempt);
        }
        return baseDelay;
      
      default:
        return baseDelay;
    }
  }

  private createJobError(error: Error, attempt: number): JobError {
    return {
      message: error.message,
      stackTrace: error.stack,
      attempt,
      timestamp: new Date(),
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private emit(event: JobEvent, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in job processor event listener for ${event}:`, error);
        }
      });
    }
  }
}

/**
 * Custom backoff strategies
 */
export class FixedBackoff implements CustomBackoff {
  constructor(private delay: number) {}

  calculate(attempt: number): number {
    return this.delay;
  }
}

export class LinearBackoff implements CustomBackoff {
  constructor(
    private baseDelay: number,
    private increment: number = 1000
  ) {}

  calculate(attempt: number): number {
    return this.baseDelay + (attempt - 1) * this.increment;
  }
}

export class ExponentialBackoff implements CustomBackoff {
  constructor(
    private baseDelay: number,
    private maxDelay: number = 30000,
    private multiplier: number = 2
  ) {}

  calculate(attempt: number): number {
    const delay = this.baseDelay * Math.pow(this.multiplier, attempt - 1);
    return Math.min(delay, this.maxDelay);
  }
}

export class ExponentialBackoffWithJitter implements CustomBackoff {
  constructor(
    private baseDelay: number,
    private maxDelay: number = 30000,
    private multiplier: number = 2,
    private jitter: number = 0.1
  ) {}

  calculate(attempt: number): number {
    const exponentialDelay = this.baseDelay * Math.pow(this.multiplier, attempt - 1);
    const jitterRange = exponentialDelay * this.jitter;
    const jitter = Math.random() * jitterRange - jitterRange / 2;
    const delay = exponentialDelay + jitter;
    
    return Math.max(0, Math.min(delay, this.maxDelay));
  }
}
