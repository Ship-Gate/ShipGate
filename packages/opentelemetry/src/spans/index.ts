export {
  BehaviorSpan,
  BehaviorSpanBuilder,
  withBehaviorSpan,
  createBehaviorSpan,
  TraceBehavior,
} from './behavior.js';
export type { BehaviorSpanConfig, BehaviorResult } from './behavior.js';

export {
  VerificationSpan,
  VerificationSpanBuilder,
  withVerificationSpan,
  createVerificationSpan,
  TraceVerification,
} from './verification.js';
export type {
  VerificationSpanConfig,
  CheckResult,
  CoverageMetrics,
  VerificationResult,
} from './verification.js';

export {
  ChaosSpan,
  ChaosSpanBuilder,
  withChaosSpan,
  createChaosSpan,
  ChaosUtils,
} from './chaos.js';
export type { ChaosSpanConfig, ChaosResult } from './chaos.js';