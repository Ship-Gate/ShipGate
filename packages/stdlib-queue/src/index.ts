/**
 * @packageDocumentation
 * @isl-lang/stdlib-queue
 */

// Core types
export * from './types.js';
export * from './errors.js';

// Queue implementations
export * from './queue/types.js';
export { FIFOQueue } from './queue/fifo.js';
export { PriorityQueue } from './queue/priority.js';
export { DelayQueue } from './queue/delay.js';
export { BoundedQueue } from './queue/bounded.js';

// Worker implementations
export * from './worker/types.js';
export { Worker } from './worker/worker.js';
export { WorkerPool } from './worker/pool.js';
export { Scheduler } from './worker/scheduler.js';

// Backpressure implementations
export * from './backpressure/types.js';
export { BackpressureController } from './backpressure/controller.js';
export {
  SizeBasedStrategy,
  UtilizationBasedStrategy,
  RateBasedStrategy,
  LatencyBasedStrategy,
  CompositeStrategy,
  AdaptiveStrategy,
} from './backpressure/strategies.js';

// Job implementations
export * from './job/types.js';
export { MemoryJobStore } from './job/store.js';
export {
  DefaultJobProcessor,
  FixedBackoff,
  LinearBackoff,
  ExponentialBackoff,
  ExponentialBackoffWithJitter,
} from './job/processor.js';

// Convenience namespace
import { FIFOQueue, PriorityQueue, DelayQueue, BoundedQueue } from './queue/index.js';
import { Worker, WorkerPool, Scheduler } from './worker/index.js';
import { BackpressureController } from './backpressure/index.js';
import { MemoryJobStore, DefaultJobProcessor } from './job/index.js';

export const Queue = {
  FIFO: FIFOQueue,
  Priority: PriorityQueue,
  Delay: DelayQueue,
  Bounded: BoundedQueue,
};

export const StdLibQueue = {
  Queue,
  Worker,
  WorkerPool,
  Scheduler,
  BackpressureController,
  MemoryJobStore,
  DefaultJobProcessor,
};

export default StdLibQueue;
