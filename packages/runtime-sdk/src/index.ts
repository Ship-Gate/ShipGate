/**
 * ISL Runtime SDK
 * 
 * SDK for embedding ISL verification in production code.
 */

// Core client
export { ISLClient, createClient, type ClientOptions } from './client.js';

// Decorators
export { Behavior } from './decorators/behavior.js';
export { Precondition, type PreconditionFn } from './decorators/precondition.js';
export { Postcondition, type PostconditionFn } from './decorators/postcondition.js';
export { Invariant, type InvariantFn } from './decorators/invariant.js';

// Monitoring
export { ISLMonitor, type MonitorOptions, type MonitorStats } from './monitoring/metrics.js';
export { ISLTracer, type TracerOptions } from './monitoring/traces.js';
export { ISLAlerter, type AlertOptions, type AlertRule } from './monitoring/alerts.js';

// Shadow mode
export { shadowMode, type ShadowOptions, type ShadowExecutor, type ShadowResult } from './shadow/mode.js';
export { comparator, type CompareResult } from './shadow/compare.js';

// Sampling
export { Sampler, type SamplerOptions } from './sampling/sampler.js';

// Verification helper
export { verify } from './verify.js';

// Types
export type {
  VerificationResult,
  Violation,
  ViolationType,
  ExecutionContext,
} from './types.js';
