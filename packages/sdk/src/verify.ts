/**
 * Behavioral Verification — wraps @isl-lang/gate with a stable SDK surface.
 *
 * Maps the authoritative gate's binary SHIP/NO_SHIP into the SDK's
 * three-state SHIP / WARN / NO_SHIP by applying score thresholds.
 *
 * @internal — consumers import from the root `@shipgate/sdk` entry.
 */

import { runAuthoritativeGate } from '@isl-lang/gate';
import type { GateVerdict, VerifyOptions, VerifyResult } from './types.js';

/**
 * Verify an implementation against its ISL specification.
 *
 * Runs the authoritative gate engine and returns a structured
 * {@link VerifyResult} with verdict, score, and suggestions.
 *
 * @param options - Verification options (spec path, impl path, thresholds)
 * @returns Promise resolving to the verification result
 *
 * @example
 * ```typescript
 * const result = await verifySpec({
 *   specPath: 'src/auth/login.isl',
 *   implPath: 'src/auth/login.ts',
 * });
 *
 * console.log(result.verdict); // 'SHIP' | 'WARN' | 'NO_SHIP'
 * console.log(result.score);   // 0–100
 * ```
 */
export async function verifySpec(options: VerifyOptions): Promise<VerifyResult> {
  const { specPath, implPath, projectRoot, thresholds } = options;

  const shipThreshold = thresholds?.ship ?? 80;
  const warnThreshold = thresholds?.warn ?? 50;

  const resolvedRoot = projectRoot ?? process.cwd();

  const gateResult = await runAuthoritativeGate({
    projectRoot: resolvedRoot,
    spec: specPath,
    implementation: implPath,
    thresholds: {
      minScore: shipThreshold,
      minTestPassRate: 100,
      minCoverage: 70,
      maxCriticalFindings: 0,
      maxHighFindings: 0,
      allowSkipped: false,
    },
    writeBundle: false,
  });

  // Map binary SHIP/NO_SHIP to three-state SHIP/WARN/NO_SHIP
  let verdict: GateVerdict;
  if (gateResult.verdict === 'SHIP') {
    verdict = 'SHIP';
  } else if (gateResult.score >= warnThreshold) {
    verdict = 'WARN';
  } else {
    verdict = 'NO_SHIP';
  }

  return Object.freeze({
    verdict,
    score: gateResult.score,
    passed: gateResult.verdict === 'SHIP',
    summary: gateResult.summary,
    reasons: Object.freeze(
      gateResult.reasons.map((r) =>
        Object.freeze({
          label: r.message,
          impact: r.severity === 'info' ? ('low' as const) : r.severity,
        }),
      ),
    ),
    suggestions: Object.freeze(gateResult.suggestions ?? []),
    durationMs: gateResult.durationMs,
  });
}
