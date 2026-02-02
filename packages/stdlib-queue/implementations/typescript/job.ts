// ============================================================================
// ISL Standard Library - Job Operations
// @isl-lang/stdlib-queue
// ============================================================================

import {
  Job,
  JobId,
  JobStatus,
  JobError,
  JobResult,
  JobHandler,
  QueueId,
  EnqueueOptions,
  EnqueueResult,
  BulkJobInput,
  BulkEnqueueResult,
  ProcessOptions,
} from './types.js';
import { getQueue, updateQueueMetrics, isQueueActive, isQueueProcessing } from './queue.js';

/**
 * In-memory job storage (for reference implementation)
 */
const jobs = new Map<JobId, Job>();
const queueJobs = new Map<QueueId, JobId[]>();

/**
 * Generate a unique job ID (UUID-like)
 */
function generateJobId(): JobId {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Enqueue a new job
 */
export function enqueue<TData = unknown>(
  queueId: QueueId,
  name: string,
  data: TData,
  options: EnqueueOptions = {}
): EnqueueResult | { error: string } {
  const queue = getQueue(queueId);
  
  if (!queue) {
    return { error: 'QUEUE_NOT_FOUND' };
  }
  
  if (!isQueueActive(queueId)) {
    return { error: 'QUEUE_PAUSED' };
  }
  
  // Check for duplicate if dedupeKey is provided
  if (options.dedupeKey) {
    const existingJob = findJobByDedupeKey(queueId, options.dedupeKey, options.dedupeWindow);
    if (existingJob) {
      return { error: 'DUPLICATE_JOB' };
    }
  }
  
  const jobId = generateJobId();
  const now = new Date();
  
  const job: Job<TData> = {
    id: jobId,
    queueId,
    name,
    data,
    status: options.delay || options.scheduledFor ? JobStatus.DELAYED : JobStatus.WAITING,
    priority: options.priority ?? 0,
    delay: options.delay,
    scheduledFor: options.scheduledFor,
    attempts: 0,
    maxAttempts: options.maxAttempts ?? queue.config.maxRetries + 1,
    createdAt: now,
    parentId: options.parentId,
    correlationId: options.correlationId,
  };
  
  jobs.set(jobId, job);
  
  // Add to queue job list
  const jobList = queueJobs.get(queueId) ?? [];
  jobList.push(jobId);
  queueJobs.set(queueId, jobList);
  
  // Update queue metrics
  updateQueueMetrics(queueId, {
    size: (queue.size ?? 0) + 1,
    delayed: job.status === JobStatus.DELAYED ? (queue.delayed ?? 0) + 1 : queue.delayed,
  });
  
  return {
    jobId,
    status: job.status,
  };
}

/**
 * Enqueue multiple jobs at once
 */
export function enqueueBulk<TData = unknown>(
  queueId: QueueId,
  jobInputs: BulkJobInput<TData>[]
): BulkEnqueueResult {
  const jobIds: JobId[] = [];
  let enqueued = 0;
  let failed = 0;
  
  for (const input of jobInputs) {
    const result = enqueue(queueId, input.name, input.data, input.options);
    if ('jobId' in result) {
      jobIds.push(result.jobId);
      enqueued++;
    } else {
      failed++;
    }
  }
  
  return { jobIds, enqueued, failed };
}

/**
 * Get a job by ID
 */
export function getJob<TData = unknown, TResult = unknown>(
  jobId: JobId
): Job<TData, TResult> | undefined {
  return jobs.get(jobId) as Job<TData, TResult> | undefined;
}

/**
 * Get jobs for a queue
 */
export function getQueueJobs(queueId: QueueId, status?: JobStatus): Job[] {
  const jobIds = queueJobs.get(queueId) ?? [];
  const queueJobList = jobIds
    .map((id) => jobs.get(id))
    .filter((job): job is Job => job !== undefined);
  
  if (status) {
    return queueJobList.filter((job) => job.status === status);
  }
  
  return queueJobList;
}

/**
 * Cancel a job
 */
export function cancelJob(jobId: JobId, reason?: string): Job | { error: string } {
  const job = jobs.get(jobId);
  
  if (!job) {
    return { error: 'JOB_NOT_FOUND' };
  }
  
  if (job.status === JobStatus.COMPLETED || job.status === JobStatus.DEAD) {
    return { error: 'JOB_NOT_CANCELLABLE' };
  }
  
  job.status = JobStatus.CANCELLED;
  if (reason) {
    job.error = {
      message: reason,
      attempt: job.attempts,
      timestamp: new Date(),
    };
  }
  
  return job;
}

/**
 * Retry a failed job
 */
export function retryJob(jobId: JobId): Job | { error: string } {
  const job = jobs.get(jobId);
  
  if (!job) {
    return { error: 'JOB_NOT_FOUND' };
  }
  
  if (job.status !== JobStatus.FAILED) {
    return { error: 'JOB_NOT_FAILED' };
  }
  
  job.status = JobStatus.WAITING;
  job.error = undefined;
  
  return job;
}

/**
 * Update job progress
 */
export function updateProgress(
  jobId: JobId,
  progress: number,
  _message?: string
): boolean {
  const job = jobs.get(jobId);
  
  if (!job || job.status !== JobStatus.ACTIVE) {
    return false;
  }
  
  job.progress = Math.min(100, Math.max(0, progress));
  return true;
}

/**
 * Find a job by dedupe key within a time window
 */
function findJobByDedupeKey(
  queueId: QueueId,
  _dedupeKey: string,
  dedupeWindow?: number
): Job | undefined {
  const jobIds = queueJobs.get(queueId) ?? [];
  const now = Date.now();
  const windowMs = dedupeWindow ?? 60000; // Default 1 minute
  
  for (const id of jobIds) {
    const job = jobs.get(id);
    if (
      job &&
      job.status !== JobStatus.COMPLETED &&
      job.status !== JobStatus.DEAD &&
      job.status !== JobStatus.CANCELLED &&
      now - job.createdAt.getTime() < windowMs
    ) {
      return job;
    }
  }
  
  return undefined;
}

/**
 * Dequeue the next job for processing
 */
export function dequeueJob(queueId: QueueId): Job | undefined {
  if (!isQueueProcessing(queueId)) {
    return undefined;
  }
  
  const jobIds = queueJobs.get(queueId) ?? [];
  const queue = getQueue(queueId);
  
  // Find the next waiting job (respecting priority and FIFO if configured)
  const waitingJobs = jobIds
    .map((id) => jobs.get(id))
    .filter((job): job is Job => 
      job !== undefined && 
      job.status === JobStatus.WAITING
    );
  
  if (waitingJobs.length === 0) {
    return undefined;
  }
  
  // Sort by priority (higher first), then by creation time (FIFO)
  waitingJobs.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  
  const job = waitingJobs[0];
  if (!job) {
    return undefined;
  }
  job.status = JobStatus.ACTIVE;
  job.startedAt = new Date();
  job.attempts++;
  
  // Update queue metrics
  if (queue) {
    updateQueueMetrics(queueId, {
      size: Math.max(0, (queue.size ?? 0) - 1),
      processing: (queue.processing ?? 0) + 1,
    });
  }
  
  return job;
}

/**
 * Complete a job successfully
 */
export function completeJob<TResult = unknown>(
  jobId: JobId,
  result?: TResult
): Job | undefined {
  const job = jobs.get(jobId);
  
  if (!job || job.status !== JobStatus.ACTIVE) {
    return undefined;
  }
  
  job.status = JobStatus.COMPLETED;
  job.completedAt = new Date();
  job.result = result;
  job.progress = 100;
  
  const queue = getQueue(job.queueId);
  if (queue) {
    updateQueueMetrics(job.queueId, {
      processing: Math.max(0, (queue.processing ?? 0) - 1),
      completed: (queue.completed ?? 0) + 1,
    });
  }
  
  return job;
}

/**
 * Fail a job
 */
export function failJob(jobId: JobId, error: Partial<JobError>): Job | undefined {
  const job = jobs.get(jobId);
  
  if (!job || job.status !== JobStatus.ACTIVE) {
    return undefined;
  }
  
  const queue = getQueue(job.queueId);
  
  job.error = {
    message: error.message ?? 'Unknown error',
    code: error.code,
    stackTrace: error.stackTrace,
    attempt: job.attempts,
    timestamp: new Date(),
  };
  job.failedAt = new Date();
  
  // Check if we should retry or move to dead letter queue
  if (job.attempts < job.maxAttempts) {
    job.status = JobStatus.FAILED;
  } else {
    job.status = JobStatus.DEAD;
  }
  
  if (queue) {
    updateQueueMetrics(job.queueId, {
      processing: Math.max(0, (queue.processing ?? 0) - 1),
      failed: (queue.failed ?? 0) + 1,
    });
  }
  
  return job;
}

/**
 * Process jobs from a queue
 */
export async function processJobs<TData = unknown, TResult = unknown>(
  queueId: QueueId,
  handler: JobHandler<TData, TResult>,
  options: ProcessOptions = {}
): Promise<JobResult<TResult>[]> {
  // Note: concurrency would be used for parallel processing in a real implementation
  const batchSize = options.batchSize ?? options.concurrency ?? 1;
  const results: JobResult<TResult>[] = [];
  
  for (let i = 0; i < batchSize; i++) {
    const job = dequeueJob(queueId) as Job<TData, TResult> | undefined;
    if (!job) break;
    
    const startTime = Date.now();
    
    try {
      const result = await handler(job);
      completeJob(job.id, result);
      
      results.push({
        jobId: job.id,
        status: JobStatus.COMPLETED,
        result,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      failJob(job.id, {
        message: error.message,
        stackTrace: error.stack,
      });
      
      results.push({
        jobId: job.id,
        status: job.attempts < job.maxAttempts ? JobStatus.FAILED : JobStatus.DEAD,
        error: {
          message: error.message,
          stackTrace: error.stack,
          attempt: job.attempts,
          timestamp: new Date(),
        },
        durationMs: Date.now() - startTime,
      });
    }
  }
  
  return results;
}

/**
 * Spawn a child job from a parent
 */
export function spawnChildJob<TData = unknown>(
  parentId: JobId,
  name: string,
  data: TData
): Job | { error: string } {
  const parent = jobs.get(parentId);
  
  if (!parent) {
    return { error: 'PARENT_NOT_FOUND' };
  }
  
  const result = enqueue(parent.queueId, name, data, {
    parentId,
    correlationId: parent.correlationId,
  });
  
  if ('error' in result) {
    return result;
  }
  
  // Update parent's children list
  parent.childrenIds = parent.childrenIds ?? [];
  parent.childrenIds.push(result.jobId);
  
  return jobs.get(result.jobId)!;
}

/**
 * Get child jobs for a parent
 */
export function getChildJobs(parentId: JobId): Job[] {
  const parent = jobs.get(parentId);
  if (!parent || !parent.childrenIds) {
    return [];
  }
  
  return parent.childrenIds
    .map((id) => jobs.get(id))
    .filter((job): job is Job => job !== undefined);
}

/**
 * Check if all child jobs are completed
 */
export function areChildrenComplete(parentId: JobId): boolean {
  const children = getChildJobs(parentId);
  return children.every(
    (child) =>
      child.status === JobStatus.COMPLETED ||
      child.status === JobStatus.DEAD ||
      child.status === JobStatus.CANCELLED
  );
}

/**
 * Clean up old jobs
 */
export function cleanJobs(
  queueId: QueueId,
  statuses?: JobStatus[],
  olderThanMs?: number
): number {
  const jobIds = queueJobs.get(queueId) ?? [];
  const now = Date.now();
  const targetStatuses = statuses ?? [JobStatus.COMPLETED, JobStatus.DEAD];
  let removed = 0;
  
  const remainingIds: JobId[] = [];
  
  for (const id of jobIds) {
    const job = jobs.get(id);
    if (!job) continue;
    
    const shouldRemove =
      targetStatuses.includes(job.status) &&
      (!olderThanMs || now - job.createdAt.getTime() > olderThanMs);
    
    if (shouldRemove) {
      jobs.delete(id);
      removed++;
    } else {
      remainingIds.push(id);
    }
  }
  
  queueJobs.set(queueId, remainingIds);
  return removed;
}

/**
 * Clear all jobs (for testing)
 */
export function clearJobs(): void {
  jobs.clear();
  queueJobs.clear();
}

export default {
  enqueue,
  enqueueBulk,
  getJob,
  getQueueJobs,
  cancelJob,
  retryJob,
  updateProgress,
  dequeueJob,
  completeJob,
  failJob,
  processJobs,
  spawnChildJob,
  getChildJobs,
  areChildrenComplete,
  cleanJobs,
  clearJobs,
};
