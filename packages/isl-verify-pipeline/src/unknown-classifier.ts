/**
 * Unknown Result Classifier
 * 
 * Categorizes unknown verification results into actionable categories:
 * - missing_bindings: Required variables/inputs not available
 * - unsupported_smt_fragment: Expression cannot be encoded for SMT
 * - runtime_data_unavailable: Traces or runtime data missing
 * 
 * Provides actionable remediation suggestions for each category.
 * 
 * @module @isl-lang/verify-pipeline
 */

import type {
  ClauseResult,
  UnknownReason,
  TriState,
} from './types.js';

// ============================================================================
// Unknown Categories
// ============================================================================

/**
 * Categories of unknown results
 */
export type UnknownCategory =
  | 'missing_bindings'        // Required variables/inputs not available
  | 'unsupported_smt_fragment' // Expression cannot be encoded for SMT
  | 'runtime_data_unavailable' // Traces or runtime data missing
  | 'evaluation_error'         // Error during evaluation
  | 'timeout'                  // Evaluation timed out
  | 'smt_unknown';            // SMT solver returned unknown

/**
 * Detailed classification of an unknown result
 */
export interface UnknownClassification {
  /** Primary category */
  category: UnknownCategory;
  
  /** Specific subcategory for more precise diagnosis */
  subcategory: string;
  
  /** Human-readable explanation */
  explanation: string;
  
  /** Actionable remediation steps */
  remediation: string[];
  
  /** Whether this unknown can potentially be resolved with mitigation strategies */
  mitigatable: boolean;
  
  /** Suggested mitigation strategies */
  suggestedMitigations: MitigationStrategy[];
  
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Mitigation strategies that can be attempted
 */
export type MitigationStrategy =
  | 'runtime_sampling'    // Try to sample partial data from available traces
  | 'fallback_check'      // Try simpler version of expression
  | 'constraint_slicing'   // Break complex expression into parts
  | 'smt_retry'           // Retry with different solver/timeout
  | 'add_bindings';       // Suggest adding explicit bindings

// ============================================================================
// Classification Logic
// ============================================================================

/**
 * Classify an unknown clause result
 */
export function classifyUnknown(
  clauseResult: ClauseResult,
  context?: {
    hasTraces?: boolean;
    traceCount?: number;
    smtAttempted?: boolean;
    smtError?: string;
    encodingError?: string;
  }
): UnknownClassification {
  const reason = clauseResult.reason ?? '';
  const triState = clauseResult.triStateResult;
  
  // Must be unknown to classify
  if (triState !== 'unknown') {
    throw new Error(`Cannot classify non-unknown result: ${triState}`);
  }
  
  // Check for missing bindings
  if (
    reason.includes('MISSING_BINDING') ||
    reason.includes('MISSING_INPUT') ||
    reason.includes('MISSING_RESULT') ||
    reason.includes('Unknown identifier') ||
    reason.includes('not available')
  ) {
    return classifyMissingBindings(clauseResult, reason);
  }
  
  // Check for SMT encoding failures
  if (
    reason.includes('encoding failed') ||
    reason.includes('not supported in SMT') ||
    reason.includes('UnsupportedFeatureError') ||
    context?.encodingError
  ) {
    return classifyUnsupportedSMTFragment(clauseResult, reason, context?.encodingError);
  }
  
  // Check for runtime data issues
  if (
    reason.includes('missing_trace') ||
    reason.includes('No execution trace') ||
    reason.includes('Trace not found') ||
    (!context?.hasTraces && context?.hasTraces !== undefined)
  ) {
    return classifyRuntimeDataUnavailable(clauseResult, reason, context);
  }
  
  // Check for evaluation errors
  if (
    reason.includes('evaluation_error') ||
    reason.includes('Error during') ||
    reason.includes('Exception')
  ) {
    return classifyEvaluationError(clauseResult, reason);
  }
  
  // Check for timeouts
  if (
    reason.includes('timeout') ||
    reason.includes('timed out') ||
    reason.includes('Timeout')
  ) {
    return classifyTimeout(clauseResult, reason);
  }
  
  // Check for SMT unknown
  if (
    reason.includes('SMT') ||
    reason.includes('solver returned') ||
    context?.smtAttempted
  ) {
    return classifySMTUnknown(clauseResult, reason, context?.smtError);
  }
  
  // Default: unclassified
  return {
    category: 'runtime_data_unavailable',
    subcategory: 'unclassified',
    explanation: `Unknown result: ${reason || 'No reason provided'}`,
    remediation: [
      'Review the clause expression for potential issues',
      'Check if all required runtime data is available',
      'Consider adding explicit bindings or test cases',
    ],
    mitigatable: false,
    suggestedMitigations: [],
    context: { originalReason: reason },
  };
}

// ============================================================================
// Category-Specific Classifiers
// ============================================================================

function classifyMissingBindings(
  clauseResult: ClauseResult,
  reason: string
): UnknownClassification {
  // Extract identifier name if possible
  const identifierMatch = reason.match(/identifier:\s*['"]?(\w+)['"]?/i) ||
                         reason.match(/Unknown identifier:\s*['"]?(\w+)['"]?/i) ||
                         reason.match(/'(\w+)'/);
  
  const identifier = identifierMatch?.[1];
  
  let subcategory = 'general';
  if (reason.includes('MISSING_INPUT')) subcategory = 'input';
  else if (reason.includes('MISSING_RESULT')) subcategory = 'result';
  else if (reason.includes('MISSING_BINDING')) subcategory = 'variable';
  
  const remediation: string[] = [];
  
  if (identifier) {
    remediation.push(`Add binding for '${identifier}' in test cases or trace data`);
    remediation.push(`Ensure '${identifier}' is provided as input to the behavior`);
  } else {
    remediation.push('Add explicit bindings for all variables used in the clause');
    remediation.push('Ensure all required inputs are provided in test cases');
  }
  
  if (subcategory === 'result') {
    remediation.push('Verify the behavior returns a result in success cases');
    remediation.push('Check postcondition outcome filters (success vs error)');
  }
  
  return {
    category: 'missing_bindings',
    subcategory,
    explanation: identifier
      ? `Missing binding for variable '${identifier}': ${reason}`
      : `Missing required bindings: ${reason}`,
    remediation,
    mitigatable: true,
    suggestedMitigations: ['add_bindings', 'runtime_sampling'],
    context: { identifier, reason },
  };
}

function classifyUnsupportedSMTFragment(
  clauseResult: ClauseResult,
  reason: string,
  encodingError?: string
): UnknownClassification {
  // Extract unsupported feature if possible
  const featureMatch = reason.match(/kind\s+['"](\w+)['"]/i) ||
                      reason.match(/feature:\s*(\w+)/i) ||
                      encodingError?.match(/not supported.*?(\w+)/i);
  
  const feature = featureMatch?.[1];
  
  const remediation: string[] = [
    'Consider rewriting the expression using supported SMT fragments',
    'Break complex expressions into simpler sub-expressions',
    'Use runtime verification instead of SMT for this clause',
  ];
  
  if (feature) {
    remediation.unshift(`Feature '${feature}' is not supported in SMT encoding`);
  }
  
  // Check if it's a quantifier issue (needs external solver)
  if (reason.includes('quantifier') || reason.includes('QuantifiedExpression')) {
    remediation.push('Try using Z3 or CVC5 solver instead of builtin (supports quantifiers)');
  }
  
  return {
    category: 'unsupported_smt_fragment',
    subcategory: feature || 'unknown_feature',
    explanation: feature
      ? `Unsupported SMT feature '${feature}': ${reason}`
      : `Expression cannot be encoded for SMT: ${reason}`,
    remediation,
    mitigatable: true,
    suggestedMitigations: ['constraint_slicing', 'fallback_check', 'smt_retry'],
    context: { feature, encodingError, reason },
  };
}

function classifyRuntimeDataUnavailable(
  clauseResult: ClauseResult,
  reason: string,
  context?: { hasTraces?: boolean; traceCount?: number }
): UnknownClassification {
  const hasTraces = context?.hasTraces ?? false;
  const traceCount = context?.traceCount ?? 0;
  
  let subcategory = 'no_traces';
  if (hasTraces && traceCount === 0) subcategory = 'empty_traces';
  else if (!hasTraces) subcategory = 'traces_disabled';
  
  const remediation: string[] = [
    'Ensure test cases are executed and traces are collected',
    'Check trace collection configuration',
  ];
  
  if (clauseResult.behavior) {
    remediation.push(`Add test cases for behavior '${clauseResult.behavior}'`);
  }
  
  if (clauseResult.outcome) {
    remediation.push(`Ensure test cases cover outcome '${clauseResult.outcome}'`);
  }
  
  return {
    category: 'runtime_data_unavailable',
    subcategory,
    explanation: hasTraces
      ? `No execution traces available for evaluation: ${reason}`
      : `Runtime data unavailable: ${reason}`,
    remediation,
    mitigatable: true,
    suggestedMitigations: ['runtime_sampling'],
    context: { hasTraces, traceCount, reason },
  };
}

function classifyEvaluationError(
  clauseResult: ClauseResult,
  reason: string
): UnknownClassification {
  return {
    category: 'evaluation_error',
    subcategory: 'runtime_error',
    explanation: `Error during evaluation: ${reason}`,
    remediation: [
      'Check the clause expression for syntax errors',
      'Verify all referenced variables and functions exist',
      'Review trace data for malformed values',
      'Consider adding error handling or type checks',
    ],
    mitigatable: false,
    suggestedMitigations: [],
    context: { reason },
  };
}

function classifyTimeout(
  clauseResult: ClauseResult,
  reason: string
): UnknownClassification {
  const timeoutMatch = reason.match(/(\d+)\s*ms/i) || reason.match(/after\s+(\d+)/i);
  const timeoutMs = timeoutMatch ? parseInt(timeoutMatch[1], 10) : undefined;
  
  return {
    category: 'timeout',
    subcategory: 'evaluation_timeout',
    explanation: `Evaluation timed out${timeoutMs ? ` after ${timeoutMs}ms` : ''}: ${reason}`,
    remediation: [
      'Consider simplifying the clause expression',
      'Break complex expressions into smaller parts',
      'Increase timeout if appropriate',
      'Use SMT verification for complex logical expressions',
    ],
    mitigatable: true,
    suggestedMitigations: ['constraint_slicing', 'fallback_check', 'smt_retry'],
    context: { timeoutMs, reason },
  };
}

function classifySMTUnknown(
  clauseResult: ClauseResult,
  reason: string,
  smtError?: string
): UnknownClassification {
  let subcategory = 'solver_unknown';
  if (reason.includes('timeout')) subcategory = 'smt_timeout';
  else if (reason.includes('error')) subcategory = 'smt_error';
  
  const remediation: string[] = [
    'Try using a different SMT solver (Z3, CVC5)',
    'Increase SMT solver timeout',
    'Simplify the expression to reduce complexity',
  ];
  
  if (smtError) {
    remediation.unshift(`SMT solver error: ${smtError}`);
  }
  
  return {
    category: 'smt_unknown',
    subcategory,
    explanation: `SMT solver could not determine verdict: ${reason}`,
    remediation,
    mitigatable: true,
    suggestedMitigations: ['smt_retry', 'constraint_slicing', 'fallback_check'],
    context: { smtError, reason },
  };
}

// ============================================================================
// Batch Classification
// ============================================================================

/**
 * Classify all unknown clauses in a verification result
 */
export function classifyAllUnknowns(
  clauseResults: ClauseResult[],
  context?: {
    hasTraces?: boolean;
    traceCount?: number;
    smtAttempted?: boolean;
  }
): Map<string, UnknownClassification> {
  const classifications = new Map<string, UnknownClassification>();
  
  for (const clauseResult of clauseResults) {
    if (clauseResult.triStateResult === 'unknown') {
      const classification = classifyUnknown(clauseResult, context);
      classifications.set(clauseResult.clauseId, classification);
    }
  }
  
  return classifications;
}

/**
 * Generate summary statistics for unknown classifications
 */
export function summarizeUnknowns(
  classifications: Map<string, UnknownClassification>
): {
  byCategory: Record<UnknownCategory, number>;
  bySubcategory: Record<string, number>;
  mitigatable: number;
  total: number;
} {
  const byCategory: Record<UnknownCategory, number> = {
    missing_bindings: 0,
    unsupported_smt_fragment: 0,
    runtime_data_unavailable: 0,
    evaluation_error: 0,
    timeout: 0,
    smt_unknown: 0,
  };
  
  const bySubcategory: Record<string, number> = {};
  let mitigatable = 0;
  
  for (const classification of classifications.values()) {
    byCategory[classification.category]++;
    bySubcategory[classification.subcategory] = (bySubcategory[classification.subcategory] || 0) + 1;
    if (classification.mitigatable) mitigatable++;
  }
  
  return {
    byCategory,
    bySubcategory,
    mitigatable,
    total: classifications.size,
  };
}
