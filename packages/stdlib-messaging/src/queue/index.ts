/**
 * Queue module exports
 */

// Types and interfaces
export type {
  QueueAdapter,
  QueueAdapterFactory,
  QueueAdapterConfig,
  ConsumeOptions,
  RejectOptions,
} from './types.js';

export type {
  QueueRegistry,
} from './types.js';

// Core implementations
export { AbstractQueueAdapter } from './adapter.js';
export { MemoryQueueAdapter } from './memory.js';
export { MessageConsumer, ConsumerBuilder } from './consumer.js';
export { MessageProducer, ProducerBuilder } from './producer.js';

// Registry
export { QueueRegistry, queueRegistry } from './types.js';
