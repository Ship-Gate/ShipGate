/**
 * Verified Intent Module
 *
 * Redefines what "Verified" means: ALL three pillars must pass for SHIP.
 *   1. Spec Fidelity  — signatures + types match source
 *   2. Coverage        — postconditions/invariants/error cases present
 *   3. Execution       — tests ran (not skipped), results attributable to spec
 *
 * @module @isl-lang/gate/verified-intent
 */

// Types
export type {
  PillarStatus,
  PillarName,
  ProvenanceOrigin,
  ExecutionStatus,
  ProvenanceRecord,
  ProvenanceReport,
  PillarResult,
  PillarDetail,
  VerifiedIntentResult,
  MissingPillarPolicy,
  VerifiedIntentConfig,
} from './types.js';

export {
  DEFAULT_VERIFIED_INTENT_CONFIG,
  DEV_VERIFIED_INTENT_CONFIG,
} from './types.js';

// Pillar evaluators
export {
  evaluateSpecFidelity,
  evaluateCoverage,
  evaluateExecution,
  extractSpecFidelityInput,
  extractCoverageInput,
  extractExecutionInput,
} from './pillars.js';

export type {
  SpecFidelityInput,
  CoverageInput,
  ExecutionInput,
} from './pillars.js';

// Provenance
export {
  buildProvenanceReport,
  partitionProvenance,
  formatProvenanceReport,
} from './provenance.js';

// Core evaluator
export {
  evaluateVerifiedIntent,
  evaluateVerifiedIntentFromInputs,
  applyVerifiedIntentCap,
  formatVerifiedIntentReport,
} from './evaluator.js';
