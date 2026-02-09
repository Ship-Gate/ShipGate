/**
 * ISL Authoritative Gate
 * 
 * The single source of truth for SHIP/NO_SHIP decisions.
 * 
 * @module @isl-lang/gate/authoritative
 */

// Core gate function
export { 
  runAuthoritativeGate, 
  quickGateCheck, 
  wouldShip,
} from './gate.js';

// Decision engine
export { 
  makeDecision, 
  wouldShip as wouldShipFromAggregation,
  getSuggestions,
  getMinScoreToShip,
} from './decision-engine.js';

// Signal aggregation
export {
  aggregateSignals,
  createSignal,
  createBlockingSignal,
  createFinding,
  hasBlockingIssues,
  getFailedSignals,
  getBlockingFailures,
  countBySeverity,
} from './aggregator.js';

// Evidence bundle
export {
  hashContent,
  generateFingerprint,
  createBundle,
  createArtifact,
  writeBundle,
} from './evidence-bundle.js';

// Verdict engine (SHIP / WARN / NO_SHIP)
export {
  SCORING_THRESHOLDS,
  CRITICAL_FAILURES,
  createGateEvidence,
  computeScore,
  findCriticalFailures,
  hasCriticalFailure,
  produceVerdict,
} from './verdict-engine.js';

export type {
  ScoringThresholds,
  CriticalFailureKind,
  GateEvidenceSource,
  GateEvidence,
  VerdictDecision,
  GateVerdict,
} from './verdict-engine.js';

// Specless check registry
export {
  registerSpeclessCheck,
  unregisterSpeclessCheck,
  getSpeclessChecks,
  clearSpeclessChecks,
  runSpeclessChecks,
} from './specless-registry.js';

export type {
  GateContext,
  SpeclessCheck,
} from './specless-registry.js';

// Types
export type {
  AuthoritativeVerdict,
  AuthoritativeGateInput,
  AuthoritativeGateResult,
  VerificationSignal,
  SignalSource,
  SignalFinding,
  AggregatedSignals,
  ThresholdConfig,
  VerdictReason,
  EvidenceBundle,
  EvidenceArtifact,
  VerdictSource,
  CombinedVerdictResult,
} from './types.js';

// Constants
export {
  EXIT_CODES,
  DEFAULT_THRESHOLDS,
  DEV_THRESHOLDS,
} from './types.js';
