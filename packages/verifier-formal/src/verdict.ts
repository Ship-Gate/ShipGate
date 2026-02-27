// ============================================================================
// Authoritative Verification Verdicts
// SMT results are authoritative when applicable, safely degradable otherwise
// ============================================================================

// ============================================================================
// VERDICT TYPES
// ============================================================================

/**
 * Authoritative verification verdict
 * - PROVED: Property is mathematically proven (SMT returned unsat for negation)
 * - DISPROVED: Property is mathematically disproven (SMT found counterexample)
 * - UNKNOWN: Solver could not determine (includes reason metadata)
 */
export type Verdict = ProvedVerdict | DisprovedVerdict | UnknownVerdict;

export interface ProvedVerdict {
  readonly kind: 'proved';
  readonly confidence: 'authoritative';
  readonly solverTime: number;
  readonly smtQuery?: string;
}

export interface DisprovedVerdict {
  readonly kind: 'disproved';
  readonly confidence: 'authoritative';
  readonly counterexample: CounterexampleData;
  readonly solverTime: number;
  readonly smtQuery?: string;
}

export interface UnknownVerdict {
  readonly kind: 'unknown';
  readonly confidence: 'degraded';
  readonly reason: UnknownReason;
  readonly solverTime: number;
  readonly smtQuery?: string;
}

export interface CounterexampleData {
  inputs: Record<string, unknown>;
  state: Record<string, unknown>;
  trace: string[];
  rawModel?: string;
}

// ============================================================================
// UNKNOWN REASONS
// ============================================================================

/**
 * Explicit, justified reasons why a verdict is unknown
 * Every unknown MUST have a categorized reason
 */
export type UnknownReason =
  | TimeoutReason
  | ComplexityReason
  | UnsupportedFeatureReason
  | ResourceExhaustedReason
  | SolverErrorReason
  | QuantifierInstantiationReason
  | NonlinearArithmeticReason
  | TheoryIncompleteReason;

export interface TimeoutReason {
  readonly type: 'timeout';
  readonly timeoutMs: number;
  readonly actualMs: number;
  readonly suggestion: string;
}

export interface ComplexityReason {
  readonly type: 'complexity';
  readonly metric: ComplexityMetric;
  readonly threshold: number;
  readonly actual: number;
  readonly suggestion: string;
}

export interface UnsupportedFeatureReason {
  readonly type: 'unsupported-feature';
  readonly feature: string;
  readonly location?: string;
  readonly suggestion: string;
}

export interface ResourceExhaustedReason {
  readonly type: 'resource-exhausted';
  readonly resource: 'memory' | 'stack' | 'terms';
  readonly suggestion: string;
}

export interface SolverErrorReason {
  readonly type: 'solver-error';
  readonly errorMessage: string;
  readonly errorCode?: string;
  readonly suggestion: string;
}

export interface QuantifierInstantiationReason {
  readonly type: 'quantifier-instantiation';
  readonly quantifierCount: number;
  readonly instantiationLimit: number;
  readonly suggestion: string;
}

export interface NonlinearArithmeticReason {
  readonly type: 'nonlinear-arithmetic';
  readonly operations: string[];
  readonly suggestion: string;
}

export interface TheoryIncompleteReason {
  readonly type: 'theory-incomplete';
  readonly theory: string;
  readonly suggestion: string;
}

// ============================================================================
// COMPLEXITY METRICS
// ============================================================================

export type ComplexityMetric =
  | 'ast-depth'
  | 'quantifier-alternations'
  | 'variable-count'
  | 'constraint-count'
  | 'theory-combination';

export interface ComplexityAnalysis {
  astDepth: number;
  quantifierCount: number;
  quantifierAlternations: number;
  variableCount: number;
  constraintCount: number;
  usesNonlinearArithmetic: boolean;
  usesStrings: boolean;
  usesArrays: boolean;
  usesQuantifiers: boolean;
  estimatedDifficulty: 'trivial' | 'easy' | 'moderate' | 'hard' | 'intractable';
}

// ============================================================================
// VERDICT CREATION HELPERS
// ============================================================================

export function createProvedVerdict(solverTime: number, smtQuery?: string): ProvedVerdict {
  return {
    kind: 'proved',
    confidence: 'authoritative',
    solverTime,
    smtQuery,
  };
}

export function createDisprovedVerdict(
  counterexample: CounterexampleData,
  solverTime: number,
  smtQuery?: string
): DisprovedVerdict {
  return {
    kind: 'disproved',
    confidence: 'authoritative',
    counterexample,
    solverTime,
    smtQuery,
  };
}

export function createUnknownVerdict(
  reason: UnknownReason,
  solverTime: number,
  smtQuery?: string
): UnknownVerdict {
  return {
    kind: 'unknown',
    confidence: 'degraded',
    reason,
    solverTime,
    smtQuery,
  };
}

// ============================================================================
// REASON CREATION HELPERS
// ============================================================================

export function createTimeoutReason(timeoutMs: number, actualMs: number): TimeoutReason {
  return {
    type: 'timeout',
    timeoutMs,
    actualMs,
    suggestion: `Solver exceeded ${timeoutMs}ms timeout. Consider simplifying the contract or increasing timeout for this property.`,
  };
}

export function createComplexityReason(
  metric: ComplexityMetric,
  threshold: number,
  actual: number
): ComplexityReason {
  const suggestions: Record<ComplexityMetric, string> = {
    'ast-depth': 'Flatten nested expressions or split into multiple simpler assertions.',
    'quantifier-alternations': 'Reduce alternating quantifiers (∀∃∀). Use single quantifier level when possible.',
    'variable-count': 'Reduce the number of free variables or add more constraints to bound them.',
    'constraint-count': 'Split the verification into smaller sub-properties.',
    'theory-combination': 'Avoid mixing theories (e.g., integers + strings + arrays simultaneously).',
  };

  return {
    type: 'complexity',
    metric,
    threshold,
    actual,
    suggestion: suggestions[metric],
  };
}

export function createUnsupportedFeatureReason(
  feature: string,
  location?: string
): UnsupportedFeatureReason {
  return {
    type: 'unsupported-feature',
    feature,
    location,
    suggestion: `Feature '${feature}' is not supported in SMT translation. Consider using an alternative formulation.`,
  };
}

export function createQuantifierInstantiationReason(
  quantifierCount: number,
  instantiationLimit: number
): QuantifierInstantiationReason {
  return {
    type: 'quantifier-instantiation',
    quantifierCount,
    instantiationLimit,
    suggestion: `Too many quantifiers (${quantifierCount}) for complete instantiation. Add triggers or bounds to guide instantiation.`,
  };
}

export function createNonlinearArithmeticReason(operations: string[]): NonlinearArithmeticReason {
  return {
    type: 'nonlinear-arithmetic',
    operations,
    suggestion: `Nonlinear arithmetic (${operations.join(', ')}) is undecidable in general. Consider linearizing or using bounds.`,
  };
}

export function createTheoryIncompleteReason(theory: string): TheoryIncompleteReason {
  return {
    type: 'theory-incomplete',
    theory,
    suggestion: `Theory '${theory}' has incomplete decision procedures. Result may be inconclusive.`,
  };
}

export function createSolverErrorReason(errorMessage: string, errorCode?: string): SolverErrorReason {
  return {
    type: 'solver-error',
    errorMessage,
    errorCode,
    suggestion: 'Check SMT-LIB syntax or solver configuration. The query may be malformed.',
  };
}

export function createResourceExhaustedReason(
  resource: 'memory' | 'stack' | 'terms'
): ResourceExhaustedReason {
  const suggestions: Record<string, string> = {
    memory: 'Reduce problem size or increase memory limit.',
    stack: 'Reduce recursion depth in specifications.',
    terms: 'Reduce the number of terms or use abstraction.',
  };

  return {
    type: 'resource-exhausted',
    resource,
    suggestion: suggestions[resource],
  };
}

// ============================================================================
// VERDICT FORMATTING
// ============================================================================

export function formatVerdict(verdict: Verdict): string {
  switch (verdict.kind) {
    case 'proved':
      return `✓ PROVED (${verdict.solverTime}ms)`;
    case 'disproved':
      return `✗ DISPROVED (${verdict.solverTime}ms)\n  Counterexample: ${JSON.stringify(verdict.counterexample.inputs)}`;
    case 'unknown':
      return `? UNKNOWN (${verdict.solverTime}ms)\n  Reason: ${formatUnknownReason(verdict.reason)}`;
  }
}

export function formatUnknownReason(reason: UnknownReason): string {
  switch (reason.type) {
    case 'timeout':
      return `Timeout after ${reason.actualMs}ms (limit: ${reason.timeoutMs}ms)`;
    case 'complexity':
      return `Complexity limit exceeded: ${reason.metric} = ${reason.actual} > ${reason.threshold}`;
    case 'unsupported-feature':
      return `Unsupported feature: ${reason.feature}`;
    case 'resource-exhausted':
      return `Resource exhausted: ${reason.resource}`;
    case 'solver-error':
      return `Solver error: ${reason.errorMessage}`;
    case 'quantifier-instantiation':
      return `Quantifier instantiation limit: ${reason.quantifierCount} > ${reason.instantiationLimit}`;
    case 'nonlinear-arithmetic':
      return `Nonlinear arithmetic: ${reason.operations.join(', ')}`;
    case 'theory-incomplete':
      return `Incomplete theory: ${reason.theory}`;
  }
}

// ============================================================================
// VERDICT AGGREGATION
// ============================================================================

/**
 * Aggregate multiple verdicts into an overall result
 * - If any is DISPROVED, overall is DISPROVED
 * - If all are PROVED, overall is PROVED
 * - Otherwise, overall is UNKNOWN with combined reasons
 */
export function aggregateVerdicts(verdicts: Verdict[]): {
  overall: 'proved' | 'disproved' | 'unknown';
  provedCount: number;
  disprovedCount: number;
  unknownCount: number;
  unknownReasons: UnknownReason[];
} {
  let provedCount = 0;
  let disprovedCount = 0;
  let unknownCount = 0;
  const unknownReasons: UnknownReason[] = [];

  for (const v of verdicts) {
    switch (v.kind) {
      case 'proved':
        provedCount++;
        break;
      case 'disproved':
        disprovedCount++;
        break;
      case 'unknown':
        unknownCount++;
        unknownReasons.push(v.reason);
        break;
    }
  }

  let overall: 'proved' | 'disproved' | 'unknown';
  if (disprovedCount > 0) {
    overall = 'disproved';
  } else if (unknownCount > 0) {
    overall = 'unknown';
  } else {
    overall = 'proved';
  }

  return { overall, provedCount, disprovedCount, unknownCount, unknownReasons };
}
