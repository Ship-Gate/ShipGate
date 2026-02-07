/**
 * ISL Gate - SHIP/NO_SHIP Decision Engine
 * 
 * Evaluates code against ISL specs and produces deployment verdicts.
 * 
 * @module @isl-lang/gate
 * 
 * @example
 * ```typescript
 * import { runGate, quickCheck } from '@isl-lang/gate';
 * 
 * const result = await runGate({
 *   findings: [...],
 *   filesConsidered: 100,
 *   filesScanned: 95,
 * }, {
 *   projectRoot: '/path/to/project',
 * });
 * 
 * console.log(result.verdict); // 'SHIP' or 'NO_SHIP'
 * console.log(result.score);   // 0-100
 * ```
 */

// Main gate functions
export { runGate, quickCheck, wouldPass, VERDICT_THRESHOLDS } from './gate.js';

// Types
export type {
  GateResult,
  GateOptions,
  GateInput,
  GateReason,
  GateVerdict,
  Finding,
  CommandVerdict,
  CommandCounts,
  CommandScores,
  CommandVerdictInfo,
  SeverityCounts,
  ShipScoreDimensions,
  CriticalBlockers,
} from './types/index.js';

// Type utilities
export {
  createEmptySeverityCounts,
  createEmptyCommandCounts,
  assertCountsValid,
  assertScoresValid,
} from './types/index.js';

// Errors
export {
  ISLGateError,
  GateBlockedError,
  ValidationError,
  TimeoutError,
  ConfigError,
  isISLGateError,
  wrapError,
} from './utils/errors.js';

// Scoring (for advanced users)
export {
  calculateHealthScore,
  calculateScoreFromCounts,
  calculatePassRate,
  buildResult,
  buildScores,
  buildCommandCounts,
  determineVerdict,
  getScoreColor,
  getScoreStatus,
  formatScore,
  formatVerdict,
} from './scoring/unified-scorer.js';

// Trust Score Engine
export {
  calculateTrustScore,
  evaluateTrust,
  enforceTrustGate,
  resolveConfig as resolveTrustConfig,
  generateReport as generateTrustReport,
} from './trust-score/index.js';

export type {
  TrustCategory,
  TrustScoreInput,
  TrustScoreConfig,
  TrustScoreResult,
  TrustClauseResult,
  ClauseStatus,
  CategoryScore,
  TrustVerdict,
  TrustWeights,
  TrustDelta,
  TrustHistoryEntry,
  TrustHistory,
  TrustReport,
  TrustReportJSON,
  ResolvedTrustConfig,
} from './trust-score/index.js';
