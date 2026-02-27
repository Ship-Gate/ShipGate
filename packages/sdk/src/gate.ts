/**
 * Gate Decision — the core value of Shipgate.
 *
 * A pure, deterministic function that produces a SHIP / WARN / NO_SHIP
 * verdict from a {@link VerifyResult}. No I/O, no side effects.
 *
 * Decision algorithm:
 *   1. Any reason with `impact: 'critical'` → **NO_SHIP**
 *   2. `passed` is true AND `score ≥ 80` → **SHIP**
 *   3. `score ≥ 50` → **WARN**
 *   4. Otherwise → **NO_SHIP**
 *
 * @internal — consumers import from the root `@shipgate/sdk` entry.
 */

import type { GateVerdict, VerifyResult } from './types.js';

/** Score at or above which the result is SHIP (when passed) */
const SHIP_THRESHOLD = 80;

/** Score at or above which the result is WARN (when not passed) */
const WARN_THRESHOLD = 50;

/**
 * Make an explicit gate decision from a verification result.
 *
 * This is the **core programmatic entry point** for Shipgate decisions.
 * It is pure and deterministic: the same {@link VerifyResult} always
 * produces the same {@link GateVerdict}.
 *
 * @param result - The output of {@link verifySpec}
 * @returns `'SHIP'`, `'WARN'`, or `'NO_SHIP'`
 *
 * @example
 * ```typescript
 * const verifyResult = await verifySpec({ specPath, implPath });
 * const gate = decideGate(verifyResult);
 *
 * if (gate === 'NO_SHIP') {
 *   process.exitCode = 1;
 *   console.error('Blocked:', verifyResult.summary);
 * }
 * ```
 */
export function decideGate(result: VerifyResult): GateVerdict {
  // 1. Critical failures always block deployment
  const hasCritical = result.reasons.some((r) => r.impact === 'critical');
  if (hasCritical) {
    return 'NO_SHIP';
  }

  // 2. High score + explicit pass → safe to ship
  if (result.passed && result.score >= SHIP_THRESHOLD) {
    return 'SHIP';
  }

  // 3. Borderline score → warn (review recommended)
  if (result.score >= WARN_THRESHOLD) {
    return 'WARN';
  }

  // 4. Below threshold → do not ship
  return 'NO_SHIP';
}
