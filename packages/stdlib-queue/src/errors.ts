/**
 * Custom error types for the queue system
 */

export class QueueError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'QueueError';
  }
}

export class QueueNotFoundError extends QueueError {
  constructor(queueId: string) {
    super(`Queue not found: ${queueId}`, 'QUEUE_NOT_FOUND');
    this.name = 'QueueNotFoundError';
  }
}

export class QueuePausedError extends QueueError {
  constructor(queueId: string) {
    super(`Queue is paused: ${queueId}`, 'QUEUE_PAUSED');
    this.name = 'QueuePausedError';
  }
}

export class JobNotFoundError extends QueueError {
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`, 'JOB_NOT_FOUND');
    this.name = 'JobNotFoundError';
  }
}

export class JobNotCancellableError extends QueueError {
  constructor(jobId: string, status: string) {
    super(`Job cannot be cancelled: ${jobId} (status: ${status})`, 'JOB_NOT_CANCELLABLE');
    this.name = 'JobNotCancellableError';
  }
}

export class JobNotFailedError extends QueueError {
  constructor(jobId: string, status: string) {
    super(`Job is not in failed state: ${jobId} (status: ${status})`, 'JOB_NOT_FAILED');
    this.name = 'JobNotFailedError';
  }
}

export class DuplicateJobError extends QueueError {
  constructor(dedupeKey: string, existingJobId: string) {
    super(`Duplicate job with dedupe key: ${dedupeKey}`, 'DUPLICATE_JOB');
    this.name = 'DuplicateJobError';
    this.existingJobId = existingJobId;
  }
  
  public readonly existingJobId: string;
}

export class InvalidScheduleError extends QueueError {
  constructor(schedule: string) {
    super(`Invalid schedule: ${schedule}`, 'INVALID_SCHEDULE');
    this.name = 'InvalidScheduleError';
  }
}

export class WorkerNotFoundError extends QueueError {
  constructor(workerId: string) {
    super(`Worker not found: ${workerId}`, 'WORKER_NOT_FOUND');
    this.name = 'WorkerNotFoundError';
  }
}

export class BackpressureError extends QueueError {
  constructor(queueId: string, reason: string) {
    super(`Backpressure triggered for queue ${queueId}: ${reason}`, 'BACKPRESSURE');
    this.name = 'BackpressureError';
  }
}

export class QueueFullError extends QueueError {
  constructor(queueId: string, capacity: number) {
    super(`Queue is full: ${queueId} (capacity: ${capacity})`, 'QUEUE_FULL');
    this.name = 'QueueFullError';
  }
}

export class WorkerPoolError extends QueueError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'WorkerPoolError';
  }
}

export class WorkerPoolStoppedError extends WorkerPoolError {
  constructor() {
    super('Worker pool is stopped', 'WORKER_POOL_STOPPED');
    this.name = 'WorkerPoolStoppedError';
  }
}

export class WorkerPoolBusyError extends WorkerPoolError {
  constructor() {
    super('Worker pool is busy', 'WORKER_POOL_BUSY');
    this.name = 'WorkerPoolBusyError';
  }
}
