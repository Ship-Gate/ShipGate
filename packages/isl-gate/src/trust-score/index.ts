/**
 * Trust Score Engine
 *
 * Produces a defensible 0-100 trust score from ISL verification results.
 *
 * Features:
 * - Six-category weighted scoring (preconditions, postconditions,
 *   invariants, temporal, chaos, coverage)
 * - Configurable weights per category
 * - Unknown = partial penalty (adjustable 0-100%)
 * - History tracking with delta detection
 * - Human-readable and JSON reports
 * - CLI gate enforcement via threshold
 *
 * @module @isl-lang/gate/trust-score
 *
 * @example
 * ```typescript
 * import { evaluateTrust } from '@isl-lang/gate/trust-score';
 *
 * const report = await evaluateTrust({
 *   clauses: [
 *     { id: 'pre-1', category: 'preconditions', description: 'Input validated', status: 'pass' },
 *     { id: 'post-1', category: 'postconditions', description: 'Returns result', status: 'fail' },
 *   ],
 * });
 *
 * console.log(report.result.score);   // 0-100
 * console.log(report.result.verdict); // 'SHIP' | 'WARN' | 'BLOCK'
 * console.log(report.text);           // Human-readable report
 * ```
 */

// Re-export everything
export * from './types.js';
export { calculateTrustScore, resolveConfig } from './calculator.js';
export {
  loadHistory,
  saveHistory,
  createEmptyHistory,
  recordEntry,
  computeDelta,
  computeDeltaBetween,
  computeTrend,
} from './history.js';
export { generateReport, formatTextReport, formatJSONReport } from './report.js';
export { generateProjectFingerprint, computeProjectFingerprint } from './fingerprint.js';

// Orchestrator
export { evaluateTrust, enforceTrustGate } from './orchestrator.js';
