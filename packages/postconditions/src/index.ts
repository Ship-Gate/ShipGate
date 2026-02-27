/**
 * @isl-lang/postconditions
 *
 * Postcondition evaluation engine with evidence-based PASS/PARTIAL/FAIL semantics.
 *
 * ## Evidence Ladder (highest to lowest priority)
 *
 * 1. **BINDING_PROOF** - Static bindings prove the postcondition (type system, formal verification)
 * 2. **EXECUTED_TEST** - Test executed and assertion passed with sufficient coverage
 * 3. **RUNTIME_ASSERT** - Runtime assertion present but not yet executed in tests
 * 4. **HEURISTIC_MATCH** - Heuristic analysis suggests compliance
 * 5. **NO_EVIDENCE** - No evidence found
 *
 * ## Status Determination
 *
 * - **PASS**: BINDING_PROOF or EXECUTED_TEST with sufficient coverage
 * - **PARTIAL**: RUNTIME_ASSERT present, or EXECUTED_TEST with low coverage, or HEURISTIC_MATCH
 * - **FAIL**: NO_EVIDENCE or contradicting evidence
 *
 * @packageDocumentation
 */

// Types
export type {
  ClauseResult,
  EvaluationInput,
  EvaluationResult,
  EvaluatorConfig,
  Evidence,
  EvidenceType,
  PostconditionStatus,
  SpecClause,
} from './types.js';

// Constants
export { EVIDENCE_PRIORITY } from './types.js';

// Evaluator
export {
  compareEvidenceTypes,
  evaluatePostconditions,
  getRequiredEvidenceFor,
  isEvidenceSufficientFor,
} from './evaluator.js';
