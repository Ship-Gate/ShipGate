/**
 * ISL Coverage Analytics
 * 
 * Provides coverage metrics for ISL specifications:
 * - Behavior binding coverage
 * - Runtime verification coverage
 * - Constraint unknown tracking
 */

export {
  analyzeCoverage,
} from './engine.js';

export type {
  CoverageReport,
  CoverageOptions,
  DomainCoverage,
  BehaviorCoverage,
  ConstraintCoverage,
  UnboundBehavior,
  UnknownConstraint,
} from './types.js';
