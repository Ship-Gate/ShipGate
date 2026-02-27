/**
 * ISL Coverage Analytics Types
 * 
 * Defines coverage metrics for ISL specifications:
 * - Behavior binding coverage
 * - Runtime verification coverage
 * - Constraint unknown tracking
 */

import type { Domain, Behavior, Expression, SourceLocation } from '@isl-lang/parser';

/**
 * Coverage metrics for a single behavior
 */
export interface BehaviorCoverage {
  /** Behavior name */
  name: string;
  /** Domain name */
  domain: string;
  /** Source location */
  location: SourceLocation;
  /** Whether behavior has implementation bound */
  hasBinding: boolean;
  /** Binding file path (if bound) */
  bindingFile?: string;
  /** Binding confidence (0-1) */
  bindingConfidence?: number;
  /** Whether behavior was exercised in runtime verification */
  exercisedInVerification: boolean;
  /** Number of times exercised */
  exerciseCount: number;
  /** Precondition coverage */
  preconditions: ConstraintCoverage[];
  /** Postcondition coverage */
  postconditions: ConstraintCoverage[];
  /** Invariant coverage */
  invariants: ConstraintCoverage[];
}

/**
 * Coverage metrics for a single constraint (precondition/postcondition/invariant)
 */
export interface ConstraintCoverage {
  /** Constraint expression */
  expression: string;
  /** Source location */
  location: SourceLocation;
  /** Whether constraint was evaluated */
  evaluated: boolean;
  /** Number of times evaluated */
  evaluationCount: number;
  /** Results breakdown */
  results: {
    true: number;
    false: number;
    unknown: number;
  };
  /** Whether constraint is always unknown */
  alwaysUnknown: boolean;
  /** Unknown reason codes */
  unknownReasons: string[];
}

/**
 * Domain-level coverage summary
 */
export interface DomainCoverage {
  /** Domain name */
  domain: string;
  /** Domain source file */
  sourceFile: string;
  /** Total behaviors */
  totalBehaviors: number;
  /** Behaviors with bindings */
  boundBehaviors: number;
  /** Behaviors exercised in verification */
  exercisedBehaviors: number;
  /** Behavior coverage details */
  behaviors: BehaviorCoverage[];
  /** Total constraints */
  totalConstraints: number;
  /** Evaluated constraints */
  evaluatedConstraints: number;
  /** Always-unknown constraints */
  alwaysUnknownConstraints: number;
  /** Constraint breakdown by type */
  constraints: {
    preconditions: number;
    postconditions: number;
    invariants: number;
  };
}

/**
 * Coverage report
 */
export interface CoverageReport {
  /** Report timestamp */
  timestamp: string;
  /** Overall summary */
  summary: {
    totalDomains: number;
    totalBehaviors: number;
    boundBehaviors: number;
    exercisedBehaviors: number;
    totalConstraints: number;
    evaluatedConstraints: number;
    alwaysUnknownConstraints: number;
  };
  /** Per-domain breakdown */
  domains: DomainCoverage[];
  /** Unbound behaviors with file/line pointers */
  unboundBehaviors: UnboundBehavior[];
  /** Always-unknown constraints with file/line pointers */
  unknownConstraints: UnknownConstraint[];
}

/**
 * Unbound behavior details
 */
export interface UnboundBehavior {
  /** Behavior name */
  name: string;
  /** Domain name */
  domain: string;
  /** Source file */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column?: number;
}

/**
 * Always-unknown constraint details
 */
export interface UnknownConstraint {
  /** Constraint expression */
  expression: string;
  /** Constraint type */
  type: 'precondition' | 'postcondition' | 'invariant';
  /** Behavior name */
  behavior: string;
  /** Domain name */
  domain: string;
  /** Source file */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column?: number;
  /** Unknown reason codes */
  unknownReasons: string[];
  /** Evaluation count */
  evaluationCount: number;
}

/**
 * Options for coverage analysis
 */
export interface CoverageOptions {
  /** Spec files to analyze */
  specFiles: string[];
  /** Bindings file path (default: .shipgate.bindings.json) */
  bindingsFile?: string;
  /** Verification traces directory */
  verificationTracesDir?: string;
  /** Include detailed constraint breakdown */
  detailed?: boolean;
}
