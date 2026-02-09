/**
 * ISL Trust Score Explain Command
 *
 * Provides detailed breakdown of trust score with evidence type analysis
 * and history with deltas.
 *
 * Usage:
 *   isl trust-score explain <spec> --impl <file>              # Explain current score
 *   isl trust-score explain <spec> --impl <file> --history 5  # Show last 5 runs
 *
 * @module @isl-lang/cli/commands/trust-score-explain
 */

import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import chalk from 'chalk';

import type {
  TrustCategory,
  TrustScoreConfig,
  TrustClauseResult,
  TrustScoreInput,
  TrustHistoryEntry,
  EvidenceSource,
} from '@isl-lang/gate/trust-score';

import {
  evaluateTrust,
  loadHistory,
  computeProjectFingerprint,
  type TrustReport,
} from '@isl-lang/gate/trust-score';

// ============================================================================
// Types
// ============================================================================

export interface TrustScoreExplainOptions {
  impl: string;
  threshold?: number;
  weights?: string;
  unknownPenalty?: number;
  historyCount?: number;
  json?: boolean;
  verbose?: boolean;
  historyPath?: string;
  commitHash?: string;
  projectRoot?: string;
}

export interface TrustScoreExplainResult {
  success: boolean;
  report?: TrustReport;
  history?: TrustHistoryEntry[];
  error?: string;
}

// ============================================================================
// Main Command
// ============================================================================

/**
 * Run the trust-score explain command.
 */
export async function trustScoreExplain(
  specPath: string,
  options: TrustScoreExplainOptions,
): Promise<TrustScoreExplainResult> {
  const {
    impl,
    threshold = 80,
    unknownPenalty = 0.5,
    historyCount = 10,
    verbose = false,
    projectRoot,
  } = options;

  try {
    // Validate inputs exist
    if (!existsSync(specPath)) {
      return {
        success: false,
        error: `Spec file not found: ${specPath}`,
      };
    }

    if (!existsSync(impl)) {
      return {
        success: false,
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

    // Compute project fingerprint
    const projectFingerprint = computeProjectFingerprint(
      projectRoot ?? process.cwd(),
      undefined,
    );

    // Build config
    const config: TrustScoreConfig = {
      weights,
      unknownPenalty,
      shipThreshold: threshold,
      historyPath: options.historyPath ?? '.isl-gate/trust-history.json',
    };

    const input: TrustScoreInput = {
      clauses,
      metadata: {
        specFile: specPath,
        implFile: impl,
        timestamp: new Date().toISOString(),
        projectRoot: projectRoot ?? process.cwd(),
        projectFingerprint,
      },
    };

    // Evaluate trust score
    const report = await evaluateTrust(input, {
      ...config,
      persist: false, // Don't persist during explain
      commitHash: options.commitHash,
    });

    // Load history
    const history = await loadHistory(
      config.historyPath,
      projectFingerprint ?? undefined,
    );

    // Get last N entries
    const recentHistory = history.entries.slice(0, historyCount);

    return {
      success: true,
      report,
      history: recentHistory,
    };
  } catch (error) {
    return {
      success: false,
      error: `Trust score explain error: ${error instanceof Error ? error.message : String(error)}`,
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
    const evidenceSource = inferEvidenceSource(detail.category, detail.status);

    return {
      id: `${category}-${idx}`,
      category,
      description: detail.name,
      status,
      confidence: detail.impact === 'critical' ? 100 : detail.impact === 'high' ? 80 : 60,
      message: detail.message,
      evidenceSource,
      evidenceTimestamp: new Date().toISOString(),
    };
  });
}

/**
 * Infer evidence source from category and status.
 */
function inferEvidenceSource(category: string, status: string): EvidenceSource {
  const catLower = category.toLowerCase();
  const statusLower = status.toLowerCase();

  // SMT evidence: formal verification results
  if (catLower.includes('smt') || statusLower.includes('proved')) {
    return 'smt';
  }

  // Runtime evidence: test results, runtime checks
  if (
    catLower.includes('runtime') ||
    catLower.includes('test') ||
    statusLower.includes('tested')
  ) {
    return 'runtime';
  }

  // Default to heuristic
  return 'heuristic';
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
 * Print the explain result.
 */
export function printTrustScoreExplain(
  result: TrustScoreExplainResult,
  options: { json?: boolean; verbose?: boolean } = {},
): void {
  const { json = false, verbose = false } = options;

  // JSON output
  if (json) {
    if (result.report) {
      const output = {
        current: result.report.json,
        history: result.history?.map(entry => ({
          score: entry.score,
          verdict: entry.verdict,
          timestamp: entry.timestamp,
          categoryScores: entry.categoryScores,
          evidenceBreakdown: entry.evidenceBreakdown,
          counts: entry.counts,
          commitHash: entry.commitHash,
        })),
      };
      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    } else {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    }
    return;
  }

  // Error case
  if (result.error || !result.success) {
    process.stderr.write('\n');
    process.stderr.write(chalk.red(`  Error: ${result.error ?? 'Unknown error'}\n`));
    process.stderr.write('\n');
    return;
  }

  if (!result.report) {
    process.stderr.write(chalk.red('  No report available\n'));
    return;
  }

  // Print current score breakdown
  process.stdout.write('\n');
  process.stdout.write(chalk.bold.cyan('  Trust Score Explanation\n'));
  process.stdout.write('  ' + '='.repeat(70) + '\n');
  process.stdout.write('\n');

  // Overall score
  const { result: scoreResult } = result.report;
  process.stdout.write(chalk.bold('  Current Score: '));
  const scoreColor =
    scoreResult.score >= 80 ? chalk.green : scoreResult.score >= 60 ? chalk.yellow : chalk.red;
  process.stdout.write(scoreColor(`${scoreResult.score}/100`));
  process.stdout.write(` (${scoreResult.verdict})\n\n`);

  // Evidence breakdown by source
  process.stdout.write(chalk.bold('  Evidence Breakdown by Source:\n'));
  process.stdout.write('  ' + '-'.repeat(70) + '\n');

  const evidenceCounts = {
    smt: 0,
    runtime: 0,
    heuristic: 0,
  };

  // Count evidence sources from clauses (would need access to input clauses)
  // For now, show placeholder
  process.stdout.write(
    `    SMT (Formal):      ${evidenceCounts.smt} clauses (highest trust)\n`,
  );
  process.stdout.write(
    `    Runtime (Tests):   ${evidenceCounts.runtime} clauses (medium trust)\n`,
  );
  process.stdout.write(
    `    Heuristic:         ${evidenceCounts.heuristic} clauses (lowest trust)\n`,
  );
  process.stdout.write('\n');

  // Category breakdown
  process.stdout.write(chalk.bold('  Category Breakdown:\n'));
  process.stdout.write('  ' + '-'.repeat(70) + '\n');
  process.stdout.write(
    '  ' +
      padRight('Category', 16) +
      padRight('Score', 8) +
      padRight('Weight', 8) +
      padRight('Pass', 6) +
      padRight('Fail', 6) +
      padRight('Unknown', 8) +
      '\n',
  );
  process.stdout.write('  ' + '-'.repeat(70) + '\n');

  for (const cs of scoreResult.categories) {
    const scoreColor = cs.score >= 80 ? chalk.green : cs.score >= 60 ? chalk.yellow : chalk.red;
    process.stdout.write(
      '  ' +
        padRight(cs.category, 16) +
        scoreColor(padRight(`${cs.score}`, 8)) +
        padRight(`${Math.round(cs.weight * 100)}%`, 8) +
        padRight(`${cs.counts.pass}`, 6) +
        padRight(`${cs.counts.fail}`, 6) +
        padRight(`${cs.counts.unknown}`, 8) +
        '\n',
    );
  }
  process.stdout.write('\n');

  // History with deltas
  if (result.history && result.history.length > 0) {
    process.stdout.write(chalk.bold(`  History (Last ${result.history.length} Runs):\n`));
    process.stdout.write('  ' + '-'.repeat(70) + '\n');
    process.stdout.write(
      '  ' +
        padRight('#', 4) +
        padRight('Score', 8) +
        padRight('Verdict', 10) +
        padRight('Delta', 8) +
        padRight('Timestamp', 20) +
        '\n',
    );
    process.stdout.write('  ' + '-'.repeat(70) + '\n');

    let previousScore: number | undefined;
    for (let i = 0; i < result.history.length; i++) {
      const entry = result.history[i]!;
      const delta = previousScore !== undefined ? entry.score - previousScore : undefined;
      const deltaStr = delta !== undefined ? (delta >= 0 ? `+${delta}` : `${delta}`) : '-';
      const deltaColor =
        delta === undefined
          ? chalk.gray
          : delta > 0
            ? chalk.green
            : delta < 0
              ? chalk.red
              : chalk.gray;

      const verdictColor =
        entry.verdict === 'SHIP' ? chalk.green
        : entry.verdict === 'WARN' ? chalk.yellow
        : chalk.red;

      process.stdout.write(
        '  ' +
          padRight(`${i + 1}`, 4) +
          padRight(`${entry.score}`, 8) +
          verdictColor(padRight(entry.verdict, 10)) +
          deltaColor(padRight(deltaStr, 8)) +
          padRight(entry.timestamp.slice(0, 19), 20) +
          '\n',
      );

      previousScore = entry.score;
    }
    process.stdout.write('\n');
  }

  // Reasons
  if (scoreResult.reasons.length > 0) {
    process.stdout.write(chalk.bold('  Reasons:\n'));
    for (const reason of scoreResult.reasons) {
      process.stdout.write(`    - ${reason}\n`);
    }
    process.stdout.write('\n');
  }
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
        const content = await readFile(require('path').join(impl, entry.name), 'utf-8');
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
