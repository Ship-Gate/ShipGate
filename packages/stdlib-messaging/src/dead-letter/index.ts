/**
 * Dead letter module exports
 */

// Types and interfaces
export type {
  DeadLetterHandler,
  DeadLetterPolicy,
  BackoffPolicy,
  DeadLetterProcessor,
  DeadLetterAction,
  DeadLetterInspector,
  DeadLetterQueryOptions,
  DeadLetterMessage,
  DeadLetterStats,
  DeadLetterManager,
} from './types.js';

export { BackoffType } from './types.js';

// Core implementations
export { DefaultDeadLetterHandler } from './handler.js';
export { 
  BackoffCalculator,
  DefaultDeadLetterPolicies,
  DeadLetterPolicyBuilder,
  DeadLetterPolicyValidator,
} from './policy.js';
export { 
  DefaultDeadLetterProcessor,
  LoggingDeadLetterHandler,
  CallbackDeadLetterHandler,
  CompositeDeadLetterHandler,
  DeadLetterHandlerBuilder,
} from './handler.js';
