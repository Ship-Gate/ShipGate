/**
 * @isl-lang/shipgate-compliance
 *
 * SOC2 CC-series mapping for ShipGate checks and proof bundles.
 * Translates proof bundles into controls auditors understand.
 */

export {
  SHIPGATE_RULE_TO_SOC2,
  GATE_PHASES_FOR_CC8,
  SOC2_CONTROL_META,
} from './soc2-mapping.js';

export type {
  SOC2ControlStatus,
  SOC2ControlMapping,
  ContributingCheck,
  EvidenceRef,
} from './soc2-mapping.js';

export { evaluateSOC2 } from './evaluator.js';

export type {
  SOC2EvaluationInput,
  SOC2EvaluationResult,
  VerdictArtifact,
  Violation,
} from './evaluator.js';
