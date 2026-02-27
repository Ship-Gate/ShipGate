/**
 * ISL Trust Score Command
 *
 * Computes and enforces a 0-100 trust score from ISL verification results.
 *
 * Usage:
 *   isl gate trust-score <spec> --impl <file>                 # Evaluate trust score
 *   isl gate trust-score <spec> --impl <file> --threshold 90  # Enforce minimum
 *   isl gate trust-score <spec> --impl <file> --json          # JSON output
 *   isl gate trust-score <spec> --impl <file> --history       # Show history
 *
 * @module @isl-lang/cli/commands/trust-score
 */

import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

import type {
  TrustCategory,
  TrustScoreConfig,
  TrustClauseResult,
  TrustScoreInput,
  TrustReport,
  TrustVerdict,
  ClauseStatus,
} from '@isl-lang/gate/trust-score';

// ============================================================================
// Types
// ============================================================================

export interface TrustScoreOptions {
  impl: string;
  threshold?: number;
  weights?: string;
  unknownPenalty?: number;
  history?: boolean;
  json?: boolean;
  ci?: boolean;
  verbose?: boolean;
  historyPath?: string;
  commitHash?: string;
  noPersist?: boolean;
}

export interface TrustScoreCommandResult {
  passed: boolean;
  score: number;
  threshold: number;
  verdict: string;
  exitCode: 0 | 1;
  report?: TrustReport;
  error?: string;
}

// ============================================================================
// Main Command
// ============================================================================

/**
 * Run the trust-score command.
 */
export async function trustScore(
  specPath: string,
  options: TrustScoreOptions,
): Promise<TrustScoreCommandResult> {
  const {
    impl,
    threshold = 80,
    unknownPenalty = 0.5,
    verbose = false,
  } = options;

  try {
    // Validate inputs exist
    if (!existsSync(specPath)) {
      return {
        passed: false,
        score: 0,
        threshold,
        verdict: 'BLOCK',
        exitCode: 1,
        error: `Spec file not found: ${specPath}`,
      };
    }

    if (!existsSync(impl)) {
      return {
        passed: false,
        score: 0,
        threshold,
        verdict: 'BLOCK',
        exitCode: 1,
        error: `Implementation file not found: ${impl}`,
      };
    }

    // Read spec and implementation
    const specSource = await readFile(specPath, 'utf-8');
    const implSource = await readImplSource(impl);

    // Parse and verify to get clause results
    const clauses = await runVerificationForTrust(specSource, implSource);

    // Parse custom weights if provided
    const weights = parseWeights(options.weights);

    // Build config
    const config: TrustScoreConfig = {
      weights,
      unknownPenalty,
      shipThreshold: threshold,
      historyPath: options.historyPath ?? '.isl-gate/trust-history.json',
    };

    // Dynamically import the gate trust-score module
    const { enforceTrustGate } = await import('@isl-lang/gate/trust-score');

    const input: TrustScoreInput = {
      clauses,
      metadata: {
        specFile: specPath,
        implFile: impl,
        timestamp: new Date().toISOString(),
      },
    };

    const result = await enforceTrustGate(input, {
      ...config,
      persist: !options.noPersist,
      commitHash: options.commitHash,
    });

    return {
      passed: result.passed,
      score: result.score,
      threshold: result.threshold,
      verdict: result.verdict,
      exitCode: result.exitCode,
      report: result.report,
    };
  } catch (error) {
    return {
      passed: false,
      score: 0,
      threshold,
      verdict: 'BLOCK',
      exitCode: 1,
      error: `Trust score error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ============================================================================
// Verification Bridge
// ============================================================================

/**
 * Run ISL verification and convert results to TrustClauseResult[].
 */
async function runVerificationForTrust(
  specSource: string,
  implSource: string,
): Promise<TrustClauseResult[]> {
  let parse: typeof import('@isl-lang/parser').parse;
  let check: typeof import('@isl-lang/typechecker').check;
  let verify: typeof import('@isl-lang/isl-verify').verify;

  try {
    const parser = await import('@isl-lang/parser');
    const typechecker = await import('@isl-lang/typechecker');
    const verifier = await import('@isl-lang/isl-verify');

    parse = parser.parse;
    check = typechecker.check;
    verify = verifier.verify;
  } catch {
    throw new Error(
      'Required ISL packages not available. Install @isl-lang/parser, @isl-lang/typechecker, @isl-lang/isl-verify',
    );
  }

  // Parse spec
  const parseResult = parse(specSource, 'spec.isl');
  if (!parseResult.success || !parseResult.domain) {
    const errors = parseResult.errors?.map(e => e.message).join('; ') ?? 'Parse failed';
    throw new Error(`Spec parse error: ${errors}`);
  }

  // Type check
  const typeResult = check(parseResult.domain);
  const typeErrors = typeResult.diagnostics.filter(d => d.severity === 'error');
  if (typeErrors.length > 0) {
    throw new Error(`Spec type error: ${typeErrors.map(e => e.message).join('; ')}`);
  }

  // Run verification
  const verifyResult = await verify(parseResult.domain, implSource, {
    runner: { framework: 'vitest' },
  });

  // Convert to TrustClauseResult[]
  return verifyResult.trustScore.details.map((detail, idx) => {
    const category = mapCategoryName(detail.category);
    const status = mapStatus(detail.status);

    return {
      id: `${category}-${idx}`,
      category,
      description: detail.name,
      status,
      confidence: detail.impact === 'critical' ? 100 : detail.impact === 'high' ? 80 : 60,
      message: detail.message,
    };
  });
}

/**
 * Map verification category names to TrustCategory.
 */
function mapCategoryName(category: string): TrustCategory {
  const lower = category.toLowerCase();
  if (lower.includes('precondition') || lower === 'pre') return 'preconditions';
  if (lower.includes('postcondition') || lower === 'post') return 'postconditions';
  if (lower.includes('invariant') || lower === 'inv') return 'invariants';
  if (lower.includes('temporal') || lower === 'temp') return 'temporal';
  if (lower.includes('chaos')) return 'chaos';
  if (lower.includes('coverage') || lower.includes('test')) return 'coverage';
  // Default: treat unknown categories as postconditions
  return 'postconditions';
}

/**
 * Map verification status to ClauseStatus.
 */
function mapStatus(status: string): ClauseStatus {
  const lower = status.toLowerCase();
  if (lower === 'passed' || lower === 'pass') return 'pass';
  if (lower === 'failed' || lower === 'fail') return 'fail';
  if (lower === 'partial') return 'partial';
  if (lower === 'skipped' || lower === 'skip') return 'unknown';
  return 'unknown';
}

// ============================================================================
// Print
// ============================================================================

/**
 * Print the trust score result.
 */
export function printTrustScoreResult(
  result: TrustScoreCommandResult,
  options: { json?: boolean; verbose?: boolean; ci?: boolean } = {},
): void {
  const { json = false, verbose = false, ci = false } = options;

  // JSON output
  if (json) {
    if (result.report) {
      process.stdout.write(JSON.stringify(result.report.json, null, 2) + '\n');
    } else {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    }
    return;
  }

  // CI mode: minimal
  if (ci) {
    process.stdout.write(`${result.verdict} ${result.score}/100\n`);
    return;
  }

  // Error case
  if (result.error) {
    process.stderr.write('\n');
    process.stderr.write(chalk.red(`  Error: ${result.error}\n`));
    process.stderr.write('\n');
    return;
  }

  // Full text report
  if (result.report) {
    process.stdout.write(result.report.text);
    return;
  }

  // Fallback
  process.stdout.write('\n');
  const verdictColor = result.passed ? chalk.green : chalk.red;
  process.stdout.write(verdictColor(`  ${result.verdict}  ${result.score}/100\n`));
  process.stdout.write(chalk.gray(`  Threshold: ${result.threshold}\n`));
  process.stdout.write('\n');
}

/**
 * Print history report.
 */
export async function printTrustScoreHistory(
  historyPath: string = '.isl-gate/trust-history.json',
): Promise<void> {
  let loadHistory: typeof import('@isl-lang/gate/trust-score').loadHistory;
  let computeTrend: typeof import('@isl-lang/gate/trust-score').computeTrend;

  try {
    const mod = await import('@isl-lang/gate/trust-score');
    loadHistory = mod.loadHistory;
    computeTrend = mod.computeTrend;
  } catch {
    process.stderr.write(chalk.red('  @isl-lang/gate not available\n'));
    return;
  }

  const history = await loadHistory(historyPath);

  if (history.entries.length === 0) {
    process.stdout.write(chalk.gray('\n  No trust score history found.\n\n'));
    return;
  }

  process.stdout.write('\n');
  process.stdout.write(chalk.bold('  Trust Score History\n'));
  process.stdout.write('  ' + '-'.repeat(60) + '\n');
  process.stdout.write(
    '  ' +
    padRight('#', 4) +
    padRight('Score', 8) +
    padRight('Verdict', 10) +
    padRight('Pass', 6) +
    padRight('Fail', 6) +
    padRight('Timestamp', 24) +
    '\n',
  );
  process.stdout.write('  ' + '-'.repeat(60) + '\n');

  const display = history.entries.slice(0, 20);
  for (let i = 0; i < display.length; i++) {
    const entry = display[i];
    const verdictColor = entry.verdict === 'SHIP' ? chalk.green
      : entry.verdict === 'WARN' ? chalk.yellow
      : chalk.red;

    process.stdout.write(
      '  ' +
      padRight(`${i + 1}`, 4) +
      padRight(`${entry.score}`, 8) +
      verdictColor(padRight(entry.verdict, 10)) +
      padRight(`${entry.counts.pass}`, 6) +
      padRight(`${entry.counts.fail}`, 6) +
      padRight(entry.timestamp.slice(0, 19), 24) +
      '\n',
    );
  }

  process.stdout.write('  ' + '-'.repeat(60) + '\n');

  const trend = computeTrend(history);
  const trendIcon = trend === 'improving' ? chalk.green('improving')
    : trend === 'declining' ? chalk.red('declining')
    : chalk.gray('stable');
  process.stdout.write(`  Trend: ${trendIcon}\n`);
  process.stdout.write(`  Total entries: ${history.entries.length}\n`);
  process.stdout.write('\n');
}

/**
 * Get exit code from trust score result.
 */
export function getTrustScoreExitCode(result: TrustScoreCommandResult): number {
  return result.exitCode;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Read implementation source from file or directory.
 */
async function readImplSource(impl: string): Promise<string> {
  const implStats = await stat(impl);

  if (implStats.isDirectory()) {
    const { readdir } = await import('fs/promises');
    const entries = await readdir(impl, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.') &&
        !entry.name.endsWith('.d.ts')
      ) {
        const content = await readFile(join(impl, entry.name), 'utf-8');
        files.push(`// === ${entry.name} ===\n${content}`);
      }
    }
    return files.join('\n\n');
  }

  return readFile(impl, 'utf-8');
}

/**
 * Parse weight string like "preconditions=30,postconditions=25,...".
 */
function parseWeights(
  weightsStr?: string,
): Partial<Record<TrustCategory, number>> | undefined {
  if (!weightsStr) return undefined;

  const weights: Partial<Record<TrustCategory, number>> = {};
  const parts = weightsStr.split(',');

  for (const part of parts) {
    const [key, value] = part.trim().split('=');
    if (key && value) {
      const cat = key.trim() as TrustCategory;
      const num = parseInt(value.trim(), 10);
      if (!isNaN(num)) {
        weights[cat] = num;
      }
    }
  }

  return Object.keys(weights).length > 0 ? weights : undefined;
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}
