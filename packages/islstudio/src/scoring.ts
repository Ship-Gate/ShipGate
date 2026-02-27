/**
 * ISL Studio - Scoring Documentation
 * 
 * The gate score is calculated deterministically based on violations.
 * 
 * ## Score Calculation
 * 
 * Base score: 100
 * 
 * Deductions:
 *   - hard_block (error):   -20 points each
 *   - soft_block (warning): -10 points each  
 *   - info:                 -2 points each
 * 
 * Minimum score: 0
 * Maximum score: 100
 * 
 * ## Severity Levels
 * 
 * | Severity | Tier | Deduction | Blocks PR |
 * |----------|------|-----------|-----------|
 * | error    | hard_block | -20 | Yes (always) |
 * | warning  | soft_block | -10 | Yes (if score < threshold) |
 * | info     | advisory   | -2  | No |
 * 
 * ## Threshold
 * 
 * Default threshold: 70
 * 
 * - Score >= threshold: SHIP
 * - Score < threshold: NO_SHIP
 * 
 * ## Examples
 * 
 * Clean code: 100/100 → SHIP
 * 1 warning: 90/100 → SHIP (above 70)
 * 2 hard blocks: 60/100 → NO_SHIP
 * 1 hard block + 2 warnings: 60/100 → NO_SHIP
 */

export interface ScoringConfig {
  hardBlockPenalty: number;
  softBlockPenalty: number;
  infoPenalty: number;
  threshold: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  hardBlockPenalty: 20,
  softBlockPenalty: 10,
  infoPenalty: 2,
  threshold: 70,
};

export interface ViolationCount {
  hardBlocks: number;
  softBlocks: number;
  infos: number;
}

/**
 * Calculate score from violations
 */
export function calculateScore(
  violations: ViolationCount,
  config: ScoringConfig = DEFAULT_SCORING
): number {
  const deduction =
    violations.hardBlocks * config.hardBlockPenalty +
    violations.softBlocks * config.softBlockPenalty +
    violations.infos * config.infoPenalty;

  return Math.max(0, 100 - deduction);
}

/**
 * Determine verdict from score
 */
export function getVerdict(
  score: number,
  hasHardBlocks: boolean,
  threshold: number = DEFAULT_SCORING.threshold
): 'SHIP' | 'NO_SHIP' {
  // Hard blocks always fail regardless of score
  if (hasHardBlocks) {
    return 'NO_SHIP';
  }
  
  return score >= threshold ? 'SHIP' : 'NO_SHIP';
}

/**
 * Format score explanation
 */
export function explainScore(
  violations: ViolationCount,
  config: ScoringConfig = DEFAULT_SCORING
): string {
  const score = calculateScore(violations, config);
  const lines: string[] = [];
  
  lines.push('Score Breakdown:');
  lines.push('  Base score: 100');
  
  if (violations.hardBlocks > 0) {
    lines.push(`  Hard blocks (${violations.hardBlocks}): -${violations.hardBlocks * config.hardBlockPenalty}`);
  }
  if (violations.softBlocks > 0) {
    lines.push(`  Soft blocks (${violations.softBlocks}): -${violations.softBlocks * config.softBlockPenalty}`);
  }
  if (violations.infos > 0) {
    lines.push(`  Info (${violations.infos}): -${violations.infos * config.infoPenalty}`);
  }
  
  lines.push(`  ─────────────`);
  lines.push(`  Final score: ${score}/100`);
  
  return lines.join('\n');
}
