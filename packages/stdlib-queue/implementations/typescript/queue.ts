// ============================================================================
// ISL Standard Library - Queue Operations
// @isl-lang/stdlib-queue
// ============================================================================

import {
  Queue,
  QueueId,
  QueueConfig,
  QueueStatus,
  DEFAULT_QUEUE_CONFIG,
} from './types.js';

/**
 * In-memory queue storage (for reference implementation)
 */
const queues = new Map<QueueId, Queue>();

/**
 * Generate a unique queue ID
 */
function generateQueueId(): QueueId {
  return `queue_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create a new queue
 */
export function createQueue(
  name: string,
  config: Partial<QueueConfig> = {}
): Queue {
  const id = generateQueueId();
  const queue: Queue = {
    id,
    name,
    config: { ...DEFAULT_QUEUE_CONFIG, ...config },
    status: QueueStatus.ACTIVE,
    size: 0,
    processing: 0,
    delayed: 0,
    failed: 0,
    completed: 0,
    createdAt: new Date(),
  };
  queues.set(id, queue);
  return queue;
}

/**
 * Get a queue by ID
 */
export function getQueue(queueId: QueueId): Queue | undefined {
  return queues.get(queueId);
}

/**
 * Get all queues
 */
export function getAllQueues(): Queue[] {
  return Array.from(queues.values());
}

/**
 * Pause a queue
 */
export function pauseQueue(queueId: QueueId): Queue | undefined {
  const queue = queues.get(queueId);
  if (queue) {
    queue.status = QueueStatus.PAUSED;
  }
  return queue;
}

/**
 * Resume a paused queue
 */
export function resumeQueue(queueId: QueueId): Queue | undefined {
  const queue = queues.get(queueId);
  if (queue && queue.status === QueueStatus.PAUSED) {
    queue.status = QueueStatus.ACTIVE;
  }
  return queue;
}

/**
 * Start draining a queue
 */
export function drainQueue(queueId: QueueId): Queue | undefined {
  const queue = queues.get(queueId);
  if (queue) {
    queue.status = QueueStatus.DRAINING;
  }
  return queue;
}

/**
 * Delete a queue
 */
export function deleteQueue(queueId: QueueId): boolean {
  const queue = queues.get(queueId);
  if (queue) {
    queue.status = QueueStatus.DELETED;
    return queues.delete(queueId);
  }
  return false;
}

/**
 * Update queue metrics
 */
export function updateQueueMetrics(
  queueId: QueueId,
  updates: Partial<Pick<Queue, 'size' | 'processing' | 'delayed' | 'failed' | 'completed'>>
): Queue | undefined {
  const queue = queues.get(queueId);
  if (queue) {
    Object.assign(queue, updates);
  }
  return queue;
}

/**
 * Check if queue is accepting new jobs
 */
export function isQueueActive(queueId: QueueId): boolean {
  const queue = queues.get(queueId);
  return queue?.status === QueueStatus.ACTIVE;
}

/**
 * Check if queue is processing jobs
 */
export function isQueueProcessing(queueId: QueueId): boolean {
  const queue = queues.get(queueId);
  return queue?.status === QueueStatus.ACTIVE || queue?.status === QueueStatus.DRAINING;
}

/**
 * Get queue statistics
 */
export function getQueueStats(queueId: QueueId): {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  delayed: number;
} | undefined {
  const queue = queues.get(queueId);
  if (!queue) return undefined;
  
  return {
    pending: queue.size,
    processing: queue.processing,
    completed: queue.completed,
    failed: queue.failed,
    delayed: queue.delayed,
  };
}

/**
 * Clear queue storage (for testing)
 */
export function clearQueues(): void {
  queues.clear();
}

export default {
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
};
