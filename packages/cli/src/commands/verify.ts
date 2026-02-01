/**
 * Verify Command
 * 
 * Verify an implementation against an ISL specification.
 * Usage: isl verify --impl <file>
 */

import { readFile } from 'fs/promises';
import { resolve, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parseISL } from '@intentos/isl-core';
import { verify as verifyImpl, type VerificationResult, type TrustScore } from '@intentos/isl-verify';
import { output } from '../output.js';
import { loadConfig } from '../config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VerifyOptions {
  /** Implementation file path */
  impl: string;
  /** Verbose output */
  verbose?: boolean;
  /** Test timeout in milliseconds */
  timeout?: number;
  /** Minimum trust score to pass */
  minScore?: number;
  /** Show detailed breakdown */
  detailed?: boolean;
  /** Output format */
  format?: 'text' | 'json';
}

export interface VerifyResult {
  success: boolean;
  specFile: string;
  implFile: string;
  verification?: VerificationResult;
  trustScore?: number;
  errors: string[];
  duration: number;
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

  const specPath = resolve(specFile);
  const implPath = resolve(options.impl);

  try {
    // Read spec file
    spinner.text = 'Parsing ISL spec...';
    const specSource = await readFile(specPath, 'utf-8');
    const { ast, errors: parseErrors } = parseISL(specSource, specPath);

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
    const verification = await verifyImpl(ast, implSource, {
      runner: {
        timeout,
        verbose: options.verbose,
      },
    });

    const duration = Date.now() - startTime;
    const passed = verification.trustScore.overall >= minScore;

    if (passed) {
      spinner.succeed(`Verification passed (${duration}ms)`);
    } else {
      spinner.fail(`Verification failed - trust score ${verification.trustScore.overall} < ${minScore}`);
    }

    return {
      success: passed,
      specFile: specPath,
      implFile: implPath,
      verification,
      trustScore: verification.trustScore.overall,
      errors,
      duration,
    };
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

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a recommendation string
 */
function formatRecommendation(rec: string): string {
  const map: Record<string, string> = {
    production_ready: '🚀 Production Ready',
    staging_recommended: '🧪 Staging Recommended',
    shadow_mode: '👁️ Shadow Mode',
    not_ready: '⚠️ Not Ready',
    critical_issues: '🚨 Critical Issues',
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
 * Print verify results to console
 */
export function printVerifyResult(result: VerifyResult, options?: { detailed?: boolean; format?: string }): void {
  // JSON output
  if (options?.format === 'json') {
    console.log(JSON.stringify({
      success: result.success,
      specFile: result.specFile,
      implFile: result.implFile,
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
  console.log(chalk.bold('Breakdown:'));
  printCategoryBar('Postconditions', trustScore.breakdown.postconditions);
  printCategoryBar('Invariants', trustScore.breakdown.invariants);
  printCategoryBar('Scenarios', trustScore.breakdown.scenarios);
  printCategoryBar('Temporal', trustScore.breakdown.temporal);
  console.log('');

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
  if (options?.detailed) {
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

export default verify;
