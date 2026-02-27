// ============================================================================
// ISL Standard Library - Queue Entry Point
// @isl-lang/stdlib-queue
// ============================================================================

// Re-export all types
export * from './types.js';

// Re-export queue operations
export {
  createQueue,
  getQueue,
  getAllQueues,
  pauseQueue,
  resumeQueue,
  drainQueue,
  deleteQueue,
  updateQueueMetrics,
  isQueueActive,
  isQueueProcessing,
  getQueueStats,
  clearQueues,
} from './queue.js';

// Re-export job operations
export {
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
} from './job.js';

// Re-export scheduler operations
export {
  calculateNextRun,
  validateSchedule,
  createSchedule,
  getScheduledJob,
  getScheduledJobsForQueue,
  updateSchedule,
  deleteSchedule,
  enableSchedule,
  disableSchedule,
  processDueSchedules,
  getDueSchedules,
  clearScheduledJobs,
} from './scheduler.js';

// Re-export worker operations
export {
  registerWorker,
  getWorker,
  getAllWorkers,
  getWorkersForQueue,
  heartbeat,
  startWorker,
  pauseWorker as pauseWorkerInstance,
  resumeWorker,
  stopWorker,
  markWorkerStopped,
  updateWorkerStats,
  removeWorker,
  getStaleWorkers,
  cleanupStaleWorkers,
  clearWorkers,
} from './worker.js';

// Re-export default objects
export { default as Queue } from './queue.js';
export { default as Job } from './job.js';
export { default as Scheduler } from './scheduler.js';
export { default as Worker } from './worker.js';

// Import for namespace export
import Queue from './queue.js';
import Job from './job.js';
import Scheduler from './scheduler.js';
import Worker from './worker.js';

/**
 * Convenience namespace export
 */
export const StdLibQueue = {
  Queue,
  Job,
  Scheduler,
  Worker,
};

export default StdLibQueue;
