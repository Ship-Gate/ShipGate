// ============================================================================
// ISL Standard Library - Worker Management
// @isl-lang/stdlib-queue
// ============================================================================

import {
  Worker,
  WorkerId,
  WorkerStatus,
  QueueId,
  JobId,
  Duration,
} from './types.js';

/**
 * In-memory worker storage (for reference implementation)
 */
const workers = new Map<WorkerId, Worker>();

/**
 * Generate a unique worker ID
 */
function generateWorkerId(): WorkerId {
  return `worker_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get the current hostname
 */
function getHostname(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalProcess = (globalThis as any).process;
    if (globalProcess?.env?.HOSTNAME) {
      return globalProcess.env.HOSTNAME as string;
    }
  } catch {
    // Not in Node.js environment
  }
  return 'localhost';
}

/**
 * Get the current process ID
 */
function getPid(): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalProcess = (globalThis as any).process;
    if (globalProcess?.pid) {
      return globalProcess.pid as number;
    }
  } catch {
    // Not in Node.js environment
  }
  return 0;
}

/**
 * Register a new worker
 */
export function registerWorker(
  queues: QueueId[],
  hostname?: string
): Worker {
  const id = generateWorkerId();
  const now = new Date();

  const worker: Worker = {
    id,
    hostname: hostname ?? getHostname(),
    pid: getPid(),
    status: WorkerStatus.STARTING,
    startedAt: now,
    lastHeartbeatAt: now,
    queues,
    currentJobs: [],
    jobsProcessed: 0,
    jobsFailed: 0,
    avgProcessingTimeMs: 0,
  };

  workers.set(id, worker);
  return worker;
}

/**
 * Get a worker by ID
 */
export function getWorker(workerId: WorkerId): Worker | undefined {
  return workers.get(workerId);
}

/**
 * Get all workers
 */
export function getAllWorkers(): Worker[] {
  return Array.from(workers.values());
}

/**
 * Get workers for a specific queue
 */
export function getWorkersForQueue(queueId: QueueId): Worker[] {
  return Array.from(workers.values()).filter(
    (worker) =>
      worker.queues.includes(queueId) &&
      (worker.status === WorkerStatus.RUNNING ||
        worker.status === WorkerStatus.STARTING)
  );
}

/**
 * Send a heartbeat from a worker
 */
export function heartbeat(
  workerId: WorkerId,
  currentJobs?: JobId[]
): boolean {
  const worker = workers.get(workerId);

  if (!worker) {
    return false;
  }

  worker.lastHeartbeatAt = new Date();
  if (currentJobs !== undefined) {
    worker.currentJobs = currentJobs;
  }

  // Transition from STARTING to RUNNING on first heartbeat
  if (worker.status === WorkerStatus.STARTING) {
    worker.status = WorkerStatus.RUNNING;
  }

  return true;
}

/**
 * Start a worker
 */
export function startWorker(workerId: WorkerId): Worker | undefined {
  const worker = workers.get(workerId);

  if (worker && worker.status === WorkerStatus.STARTING) {
    worker.status = WorkerStatus.RUNNING;
  }

  return worker;
}

/**
 * Pause a worker
 */
export function pauseWorker(workerId: WorkerId): Worker | undefined {
  const worker = workers.get(workerId);

  if (worker && worker.status === WorkerStatus.RUNNING) {
    worker.status = WorkerStatus.PAUSED;
  }

  return worker;
}

/**
 * Resume a paused worker
 */
export function resumeWorker(workerId: WorkerId): Worker | undefined {
  const worker = workers.get(workerId);

  if (worker && worker.status === WorkerStatus.PAUSED) {
    worker.status = WorkerStatus.RUNNING;
  }

  return worker;
}

/**
 * Stop a worker
 */
export function stopWorker(
  workerId: WorkerId,
  graceful: boolean = true,
  _timeout?: Duration
): { jobsInProgress: number; jobsReturned: number } | undefined {
  const worker = workers.get(workerId);

  if (!worker) {
    return undefined;
  }

  const jobsInProgress = worker.currentJobs.length;

  if (graceful) {
    worker.status = WorkerStatus.STOPPING;
  } else {
    worker.status = WorkerStatus.STOPPED;
    worker.currentJobs = [];
  }

  return {
    jobsInProgress,
    jobsReturned: graceful ? 0 : jobsInProgress,
  };
}

/**
 * Mark a worker as stopped
 */
export function markWorkerStopped(workerId: WorkerId): Worker | undefined {
  const worker = workers.get(workerId);

  if (worker) {
    worker.status = WorkerStatus.STOPPED;
    worker.currentJobs = [];
  }

  return worker;
}

/**
 * Update worker statistics
 */
export function updateWorkerStats(
  workerId: WorkerId,
  processingTimeMs: number,
  success: boolean
): Worker | undefined {
  const worker = workers.get(workerId);

  if (!worker) {
    return undefined;
  }

  if (success) {
    worker.jobsProcessed++;
  } else {
    worker.jobsFailed++;
  }

  // Update rolling average
  const totalJobs = worker.jobsProcessed + worker.jobsFailed;
  worker.avgProcessingTimeMs =
    (worker.avgProcessingTimeMs * (totalJobs - 1) + processingTimeMs) / totalJobs;

  return worker;
}

/**
 * Remove a worker
 */
export function removeWorker(workerId: WorkerId): boolean {
  return workers.delete(workerId);
}

/**
 * Get stale workers (no heartbeat within threshold)
 */
export function getStaleWorkers(thresholdMs: number = 60000): Worker[] {
  const now = Date.now();
  return Array.from(workers.values()).filter(
    (worker) =>
      worker.status !== WorkerStatus.STOPPED &&
      now - worker.lastHeartbeatAt.getTime() > thresholdMs
  );
}

/**
 * Clean up stale workers
 */
export function cleanupStaleWorkers(thresholdMs: number = 60000): number {
  const staleWorkers = getStaleWorkers(thresholdMs);
  let cleaned = 0;

  for (const worker of staleWorkers) {
    worker.status = WorkerStatus.STOPPED;
    workers.delete(worker.id);
    cleaned++;
  }

  return cleaned;
}

/**
 * Clear all workers (for testing)
 */
export function clearWorkers(): void {
  workers.clear();
}

export default {
  registerWorker,
  getWorker,
  getAllWorkers,
  getWorkersForQueue,
  heartbeat,
  startWorker,
  pauseWorker,
  resumeWorker,
  stopWorker,
  markWorkerStopped,
  updateWorkerStats,
  removeWorker,
  getStaleWorkers,
  cleanupStaleWorkers,
  clearWorkers,
};
