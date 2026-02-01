/**
 * Verify Command
 * 
 * Verify code against ISL specifications and print evidence score.
 * 
 * Usage:
 *   isl verify --impl <file>                    # Auto-discover specs
 *   isl verify --spec <path> --impl <file>      # Specific spec
 *   isl verify --report <path>                  # Write evidence report
 *   isl verify --json                           # JSON output
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, relative, dirname, basename, join } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL } from '@isl-lang/parser';
import { verify as verifyDomain, type VerificationResult, type TrustScore, type TestResult } from '@isl-lang/isl-verify';
import { output } from '../output.js';
import { loadConfig } from '../config.js';

// Re-export types for use
export type { VerificationResult, TrustScore, TestResult };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VerifyOptions {
  /** ISL spec file path (optional - auto-discovers if not provided) */
  spec?: string;
  /** Implementation file path */
  impl?: string;
  /** Report output path */
  report?: string;
  /** JSON output */
  json?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Test timeout in milliseconds */
  timeout?: number;
  /** Minimum trust score to pass */
  minScore?: number;
  /** Show detailed breakdown */
  detailed?: boolean;
  /** Output format (legacy support) */
  format?: 'text' | 'json';
}

export interface VerifyResult {
  success: boolean;
  specFile: string;
  implFile: string;
  verification?: VerificationResult;
  trustScore?: number;
  evidenceScore?: EvidenceScore;
  errors: string[];
  duration: number;
}

export interface EvidenceScore {
  /** Overall evidence score (0-100) */
  overall: number;
  /** Confidence level (0-100) */
  confidence: number;
  /** Categories breakdown */
  categories: {
    postconditions: CategoryEvidence;
    invariants: CategoryEvidence;
    scenarios: CategoryEvidence;
    temporal: CategoryEvidence;
  };
  /** Human-readable recommendation */
  recommendation: string;
  /** Number of passing checks */
  passedChecks: number;
  /** Number of failing checks */
  failedChecks: number;
  /** Total checks */
  totalChecks: number;
}

export interface CategoryEvidence {
  score: number;
  passed: number;
  failed: number;
  total: number;
  weight: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec Discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Auto-discover ISL spec files
 * Searches in .vibecheck/specs/*.isl, specs/*.isl, and *.isl in cwd
 */
async function discoverSpecs(cwd: string = process.cwd()): Promise<string[]> {
  const searchPaths = [
    '.vibecheck/specs/**/*.isl',
    'specs/**/*.isl',
    '*.isl',
  ];

  const specs: string[] = [];

  for (const pattern of searchPaths) {
    const matches = await glob(pattern, {
      cwd,
      ignore: ['node_modules/**', 'dist/**'],
      absolute: true,
    });
    specs.push(...matches);
  }

  // Deduplicate
  return [...new Set(specs)];
}

/**
 * Resolve spec file path
 * If not provided, auto-discovers specs
 */
async function resolveSpec(specPath?: string): Promise<string[]> {
  if (specPath) {
    const resolved = resolve(specPath);
    
    // Check if it's a glob pattern
    if (specPath.includes('*')) {
      const matches = await glob(specPath, {
        cwd: process.cwd(),
        absolute: true,
      });
      return matches;
    }
    
    // Check if it's a directory
    if (existsSync(resolved)) {
      const stat = await import('fs').then(fs => fs.promises.stat(resolved));
      if (stat.isDirectory()) {
        const matches = await glob('**/*.isl', {
          cwd: resolved,
          absolute: true,
        });
        return matches;
      }
    }
    
    return [resolved];
  }

  // Auto-discover
  return discoverSpecs();
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Score Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate evidence score from trust score
 * Evidence score represents how much empirical evidence supports the implementation
 */
function calculateEvidenceScore(trustScore: TrustScore): EvidenceScore {
  const { breakdown } = trustScore;
  
  // Weight definitions (should match TrustCalculator)
  const weights = {
    postconditions: 40,
    invariants: 30,
    scenarios: 20,
    temporal: 10,
  };

  const categories = {
    postconditions: {
      ...breakdown.postconditions,
      weight: weights.postconditions,
    },
    invariants: {
      ...breakdown.invariants,
      weight: weights.invariants,
    },
    scenarios: {
      ...breakdown.scenarios,
      weight: weights.scenarios,
    },
    temporal: {
      ...breakdown.temporal,
      weight: weights.temporal,
    },
  };

  // Count totals
  const passedChecks = 
    breakdown.postconditions.passed +
    breakdown.invariants.passed +
    breakdown.scenarios.passed +
    breakdown.temporal.passed;
  
  const failedChecks =
    breakdown.postconditions.failed +
    breakdown.invariants.failed +
    breakdown.scenarios.failed +
    breakdown.temporal.failed;

  const totalChecks = passedChecks + failedChecks;

  // Map recommendation to human-readable string
  const recommendationMap: Record<string, string> = {
    production_ready: 'Production Ready - High confidence in implementation',
    staging_recommended: 'Staging Recommended - Good coverage, minor gaps',
    shadow_mode: 'Shadow Mode - Monitor in production shadow',
    not_ready: 'Not Ready - Significant evidence gaps',
    critical_issues: 'Critical Issues - Failing critical checks',
  };

  return {
    overall: trustScore.overall,
    confidence: trustScore.confidence,
    categories,
    recommendation: recommendationMap[trustScore.recommendation] ?? trustScore.recommendation,
    passedChecks,
    failedChecks,
    totalChecks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Report Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate evidence report content
 */
function generateEvidenceReport(result: VerifyResult): string {
  const timestamp = new Date().toISOString();
  const evidence = result.evidenceScore!;
  const verification = result.verification!;

  return JSON.stringify({
    metadata: {
      timestamp,
      specFile: result.specFile,
      implFile: result.implFile,
      duration: result.duration,
      version: '1.0.0',
    },
    evidenceScore: {
      overall: evidence.overall,
      confidence: evidence.confidence,
      recommendation: evidence.recommendation,
      summary: {
        passed: evidence.passedChecks,
        failed: evidence.failedChecks,
        total: evidence.totalChecks,
        passRate: evidence.totalChecks > 0 
          ? Math.round((evidence.passedChecks / evidence.totalChecks) * 100) 
          : 0,
      },
    },
    breakdown: {
      postconditions: {
        score: evidence.categories.postconditions.score,
        weight: evidence.categories.postconditions.weight,
        passed: evidence.categories.postconditions.passed,
        failed: evidence.categories.postconditions.failed,
        total: evidence.categories.postconditions.total,
      },
      invariants: {
        score: evidence.categories.invariants.score,
        weight: evidence.categories.invariants.weight,
        passed: evidence.categories.invariants.passed,
        failed: evidence.categories.invariants.failed,
        total: evidence.categories.invariants.total,
      },
      scenarios: {
        score: evidence.categories.scenarios.score,
        weight: evidence.categories.scenarios.weight,
        passed: evidence.categories.scenarios.passed,
        failed: evidence.categories.scenarios.failed,
        total: evidence.categories.scenarios.total,
      },
      temporal: {
        score: evidence.categories.temporal.score,
        weight: evidence.categories.temporal.weight,
        passed: evidence.categories.temporal.passed,
        failed: evidence.categories.temporal.failed,
        total: evidence.categories.temporal.total,
      },
    },
    testResults: {
      passed: verification.testResult.passed,
      failed: verification.testResult.failed,
      skipped: verification.testResult.skipped,
      duration: verification.testResult.duration,
      details: verification.trustScore.details.map(d => ({
        category: d.category,
        name: d.name,
        status: d.status,
        impact: d.impact,
        message: d.message ?? null,
      })),
    },
    failures: verification.trustScore.details
      .filter(d => d.status === 'failed')
      .map(d => ({
        category: d.category,
        name: d.name,
        impact: d.impact,
        error: d.message ?? 'Unknown error',
      })),
  }, null, 2);
}

/**
 * Write evidence report to file
 */
async function writeEvidenceReport(result: VerifyResult, reportPath: string): Promise<void> {
  const resolvedPath = resolve(reportPath);
  const dir = dirname(resolvedPath);
  
  // Ensure directory exists
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const content = generateEvidenceReport(result);
  await writeFile(resolvedPath, content, 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify an implementation against a spec file
 */
export async function verify(specFile: string, options: VerifyOptions): Promise<VerifyResult> {
  const startTime = Date.now();
  const spinner = ora('Loading files...').start();
  const errors: string[] = [];

  // Load config for defaults
  const { config } = await loadConfig();
  const timeout = options.timeout ?? config?.verify?.timeout ?? 30000;
  const minScore = options.minScore ?? config?.verify?.minTrustScore ?? 70;

  // Resolve paths
  const specPath = resolve(specFile);
  const implPath = options.impl ? resolve(options.impl) : '';

  // Validate impl path is provided
  if (!options.impl) {
    spinner.fail('Implementation file required');
    return {
      success: false,
      specFile: specPath,
      implFile: implPath,
      errors: ['Implementation file path is required (--impl <file>)'],
      duration: Date.now() - startTime,
    };
  }

  try {
    // Read spec file
    spinner.text = 'Parsing ISL spec...';
    const specSource = await readFile(specPath, 'utf-8');
    const { domain: ast, errors: parseErrors } = parseISL(specSource, specPath);

    if (parseErrors.length > 0 || !ast) {
      spinner.fail('Failed to parse ISL spec');
      return {
        success: false,
        specFile: specPath,
        implFile: implPath,
        errors: parseErrors.map(e => `Parse error: ${e.message}`),
        duration: Date.now() - startTime,
      };
    }

    // Read implementation
    spinner.text = 'Loading implementation...';
    const implSource = await readFile(implPath, 'utf-8');

    // Run verification
    spinner.text = 'Running verification tests...';
    const verification = await verifyDomain(ast, implSource, {
      runner: {
        timeout,
        verbose: options.verbose,
      },
    });

    const duration = Date.now() - startTime;
    const passed = verification.trustScore.overall >= minScore;

    // Calculate evidence score
    const evidenceScore = calculateEvidenceScore(verification.trustScore);

    if (passed) {
      spinner.succeed(`Verification passed (${duration}ms)`);
    } else {
      spinner.fail(`Verification failed - trust score ${verification.trustScore.overall} < ${minScore}`);
    }

    const result: VerifyResult = {
      success: passed,
      specFile: specPath,
      implFile: implPath,
      verification,
      trustScore: verification.trustScore.overall,
      evidenceScore,
      errors,
      duration,
    };

    // Write report if requested
    if (options.report) {
      try {
        await writeEvidenceReport(result, options.report);
        if (!options.json && options.format !== 'json') {
          console.log(chalk.gray(`\nEvidence report written to: ${relative(process.cwd(), resolve(options.report))}`));
        }
      } catch (err) {
        const reportError = err instanceof Error ? err.message : String(err);
        console.error(chalk.yellow(`Warning: Failed to write report: ${reportError}`));
      }
    }

    return result;
  } catch (err) {
    spinner.fail('Verification failed');
    errors.push(err instanceof Error ? err.message : String(err));
    
    return {
      success: false,
      specFile: specPath,
      implFile: implPath,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Verify with auto-discovery of specs
 * Main entry point that handles --spec option and auto-discovery
 */
export async function verifyWithDiscovery(options: VerifyOptions): Promise<VerifyResult[]> {
  const specs = await resolveSpec(options.spec);

  if (specs.length === 0) {
    console.error(chalk.red('No ISL spec files found'));
    console.log(chalk.gray('Searched in: .vibecheck/specs/*.isl, specs/*.isl, *.isl'));
    console.log(chalk.gray('Use --spec <path> to specify a spec file'));
    return [{
      success: false,
      specFile: '',
      implFile: options.impl ?? '',
      errors: ['No ISL spec files found'],
      duration: 0,
    }];
  }

  const results: VerifyResult[] = [];
  
  for (const spec of specs) {
    const result = await verify(spec, options);
    results.push(result);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a recommendation string
 */
function formatRecommendation(rec: string): string {
  const map: Record<string, string> = {
    production_ready: 'Production Ready',
    staging_recommended: 'Staging Recommended',
    shadow_mode: 'Shadow Mode',
    not_ready: 'Not Ready',
    critical_issues: 'Critical Issues',
  };
  return map[rec] ?? rec;
}

/**
 * Print a category score bar
 */
function printCategoryBar(name: string, score: { score: number; passed: number; total: number }): void {
  const color = score.score >= 100 ? chalk.green
    : score.score >= 80 ? chalk.cyan
    : score.score >= 60 ? chalk.yellow
    : chalk.red;
  
  const barWidth = 20;
  const filled = Math.floor((score.score / 100) * barWidth);
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(barWidth - filled));
  
  console.log(`  ${name.padEnd(15)} ${bar} ${color(`${score.passed}/${score.total}`)}`);
}

/**
 * Print evidence score summary
 */
function printEvidenceScore(evidence: EvidenceScore): void {
  console.log('');
  console.log(chalk.bold.cyan('┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('│           EVIDENCE SCORE SUMMARY            │'));
  console.log(chalk.bold.cyan('└─────────────────────────────────────────────┘'));
  console.log('');
  
  // Overall score with color
  const scoreColor = evidence.overall >= 95 ? chalk.green
    : evidence.overall >= 85 ? chalk.cyan
    : evidence.overall >= 70 ? chalk.yellow
    : chalk.red;
  
  console.log(chalk.bold('  Evidence Score: ') + scoreColor.bold(`${evidence.overall}/100`));
  console.log(chalk.bold('  Confidence:     ') + chalk.gray(`${evidence.confidence}%`));
  console.log('');
  
  // Pass rate
  const passRate = evidence.totalChecks > 0 
    ? Math.round((evidence.passedChecks / evidence.totalChecks) * 100) 
    : 0;
  console.log(chalk.bold('  Checks: ') + 
    chalk.green(`${evidence.passedChecks} passed`) + 
    chalk.gray(' / ') +
    (evidence.failedChecks > 0 ? chalk.red(`${evidence.failedChecks} failed`) : chalk.gray('0 failed')) +
    chalk.gray(` (${passRate}% pass rate)`));
  console.log('');
  
  // Recommendation
  const recColor = evidence.recommendation.includes('Production Ready') ? chalk.green
    : evidence.recommendation.includes('Staging') ? chalk.cyan
    : evidence.recommendation.includes('Shadow') ? chalk.yellow
    : chalk.red;
  
  console.log(chalk.bold('  Recommendation: ') + recColor(evidence.recommendation));
}

/**
 * Print verify results to console
 */
export function printVerifyResult(result: VerifyResult, options?: { detailed?: boolean; format?: string; json?: boolean }): void {
  // JSON output
  if (options?.json || options?.format === 'json') {
    console.log(JSON.stringify({
      success: result.success,
      specFile: result.specFile,
      implFile: result.implFile,
      evidenceScore: result.evidenceScore ? {
        overall: result.evidenceScore.overall,
        confidence: result.evidenceScore.confidence,
        recommendation: result.evidenceScore.recommendation,
        passedChecks: result.evidenceScore.passedChecks,
        failedChecks: result.evidenceScore.failedChecks,
        totalChecks: result.evidenceScore.totalChecks,
        categories: result.evidenceScore.categories,
      } : null,
      trustScore: result.trustScore,
      duration: result.duration,
      verification: result.verification ? {
        trustScore: result.verification.trustScore,
        testResult: result.verification.testResult,
      } : null,
      errors: result.errors,
    }, null, 2));
    return;
  }

  console.log('');

  // Print files
  console.log(chalk.gray('Spec:') + ` ${relative(process.cwd(), result.specFile)}`);
  console.log(chalk.gray('Impl:') + ` ${relative(process.cwd(), result.implFile)}`);
  console.log('');

  // Handle errors
  if (result.errors.length > 0) {
    console.log(chalk.red('✗ Verification failed'));
    console.log('');
    for (const error of result.errors) {
      console.log(chalk.red(`  ${error}`));
    }
    return;
  }

  if (!result.verification) {
    return;
  }

  const { trustScore, testResult } = result.verification;

  // Print evidence score summary
  if (result.evidenceScore) {
    printEvidenceScore(result.evidenceScore);
    console.log('');
  }

  // Trust Score Header
  const scoreColor = trustScore.overall >= 95 ? chalk.green
    : trustScore.overall >= 85 ? chalk.cyan
    : trustScore.overall >= 70 ? chalk.yellow
    : chalk.red;

  console.log(chalk.bold('Trust Score: ') + scoreColor(`${trustScore.overall}/100`));
  console.log(chalk.gray(`Confidence: ${trustScore.confidence}%`));
  console.log('');

  // Recommendation
  const recColor = trustScore.recommendation === 'production_ready' ? chalk.green
    : trustScore.recommendation === 'staging_recommended' ? chalk.cyan
    : trustScore.recommendation === 'shadow_mode' ? chalk.yellow
    : chalk.red;
  
  console.log(chalk.bold('Recommendation: ') + recColor(formatRecommendation(trustScore.recommendation)));
  console.log('');

  // Breakdown
  if (trustScore.breakdown) {
    console.log(chalk.bold('Breakdown:'));
    printCategoryBar('Postconditions', trustScore.breakdown.postconditions);
    printCategoryBar('Invariants', trustScore.breakdown.invariants);
    printCategoryBar('Scenarios', trustScore.breakdown.scenarios);
    printCategoryBar('Temporal', trustScore.breakdown.temporal);
    console.log('');
  }

  // Test Summary
  console.log(chalk.bold('Test Results:'));
  console.log(chalk.green(`  ✓ ${testResult.passed} passed`));
  if (testResult.failed > 0) {
    console.log(chalk.red(`  ✗ ${testResult.failed} failed`));
  }
  if (testResult.skipped > 0) {
    console.log(chalk.yellow(`  ○ ${testResult.skipped} skipped`));
  }
  console.log(chalk.gray(`  Duration: ${testResult.duration}ms`));

  // Detailed failures
  if (options?.detailed && trustScore.details) {
    const failures = trustScore.details.filter(d => d.status === 'failed');
    if (failures.length > 0) {
      console.log('');
      console.log(chalk.bold.red('Failures:'));
      for (const failure of failures) {
        const impactColor = failure.impact === 'critical' ? chalk.red
          : failure.impact === 'high' ? chalk.yellow
          : chalk.gray;
        console.log(`  ${chalk.red('✗')} ${failure.name}`);
        console.log(`    ${impactColor(`[${failure.impact}]`)} ${failure.message ?? ''}`);
      }
    }
  }

  // Summary line
  console.log('');
  if (result.success) {
    console.log(chalk.green(`✓ Verification passed`));
  } else {
    console.log(chalk.red(`✗ Verification failed`));
  }
  console.log(chalk.gray(`  Completed in ${result.duration}ms`));
}

/**
 * Get exit code for verify result
 */
export function getVerifyExitCode(result: VerifyResult): number {
  return result.success ? 0 : 1;
}

export default verify;
