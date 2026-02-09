/**
 * Trust Score Orchestrator
 *
 * High-level API that combines calculation, history, and reporting
 * into a single call. Also provides gate enforcement.
 *
 * @module @isl-lang/gate/trust-score/orchestrator
 */

import type {
  TrustScoreInput,
  TrustScoreConfig,
  TrustReport,
  TrustScoreResult,
} from './types.js';

import { calculateTrustScore, resolveConfig } from './calculator.js';
import { loadHistory, saveHistory, recordEntry, computeDelta } from './history.js';
import { generateReport } from './report.js';
import { computeProjectFingerprint } from './fingerprint.js';

// ============================================================================
// Orchestrator
// ============================================================================

/**
 * Options for the orchestrator.
 */
export interface EvaluateTrustOptions extends TrustScoreConfig {
  /** If true, persist the result to history. Default: true */
  persist?: boolean;
  /** Optional git commit hash to tag the entry */
  commitHash?: string;
}

/**
 * Evaluate trust score with full history and reporting.
 *
 * This is the primary high-level API. It:
 * 1. Calculates the trust score from clause results
 * 2. Loads history and computes delta from last run
 * 3. Generates human-readable and JSON reports
 * 4. Persists the result to history (unless disabled)
 */
export async function evaluateTrust(
  input: TrustScoreInput,
  options?: EvaluateTrustOptions,
): Promise<TrustReport> {
  const config = resolveConfig(options);
  const persist = options?.persist ?? true;

  // Compute project fingerprint
  const projectFingerprint = computeProjectFingerprint(
    input.metadata?.projectRoot,
    input.metadata?.projectFingerprint,
  );

  // 1. Calculate score
  const result = calculateTrustScore(input, options);

  // 2. Load history and compute delta (filtered by project fingerprint)
  const history = await loadHistory(config.historyPath, projectFingerprint);
  const delta = computeDelta(result, history);

  // 3. Generate report
  const report = generateReport(result, delta);

  // 4. Persist to history
  if (persist) {
    const updatedHistory = recordEntry(
      history,
      result,
      config,
      options?.commitHash,
      projectFingerprint,
    );
    await saveHistory(config.historyPath, updatedHistory);
  }

  return report;
}

// ============================================================================
// Gate Enforcement
// ============================================================================

/**
 * Result of gate enforcement.
 */
export interface GateEnforcementResult {
  /** Whether the gate passed */
  passed: boolean;
  /** The trust score */
  score: number;
  /** The threshold that was applied */
  threshold: number;
  /** The verdict */
  verdict: string;
  /** Exit code: 0 for pass, 1 for fail */
  exitCode: 0 | 1;
  /** The full trust report */
  report: TrustReport;
  /** Human-readable enforcement message */
  message: string;
}

/**
 * Enforce a trust score gate.
 *
 * Calculates the trust score and checks it against the configured
 * SHIP threshold. Returns a pass/fail result suitable for CI pipelines.
 *
 * @example
 * ```typescript
 * const gate = await enforceTrustGate(input, { shipThreshold: 90 });
 * process.exit(gate.exitCode);
 * ```
 */
export async function enforceTrustGate(
  input: TrustScoreInput,
  options?: EvaluateTrustOptions,
): Promise<GateEnforcementResult> {
  const report = await evaluateTrust(input, options);
  const { result } = report;
  const threshold = result.config.shipThreshold;
  const passed = result.score >= threshold;

  const message = passed
    ? `GATE PASSED: Trust score ${result.score}/100 >= threshold ${threshold}`
    : `GATE FAILED: Trust score ${result.score}/100 < threshold ${threshold}`;

  return {
    passed,
    score: result.score,
    threshold,
    verdict: result.verdict,
    exitCode: passed ? 0 : 1,
    report,
    message,
  };
}
