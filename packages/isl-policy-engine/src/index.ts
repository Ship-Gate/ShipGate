/**
 * ISL Policy Engine
 *
 * Deterministic policy evaluation with explainable block/allow decisions.
 *
 * @packageDocumentation
 * @module @isl-lang/isl-policy-engine
 */

// Types
export type {
  ComparisonOp,
  StringMatchOp,
  LogicOp,
  VerdictCondition,
  ConfidenceCondition,
  BlastRadiusCondition,
  ClaimTypeCondition,
  ClaimFieldCondition,
  MetricCondition,
  PresenceCondition,
  LogicCondition,
  PolicyCondition,
  PolicyAction,
  PolicyDef,
  PolicyEnginePack,
  PolicyEvalInput,
  PolicyFileInput,
  EvidenceRef,
  PolicyDecisionEntry,
  PolicyEngineResult,
} from './types.js';

// Evaluator
export { evaluate, evaluateCondition } from './evaluator.js';

// Explainer
export {
  formatTerminal,
  formatMarkdown,
  formatJSON,
  formatCILine,
  explainDecision,
} from './explainer.js';

// Starter packs
export { starterPolicyPack } from './starter-pack.js';
