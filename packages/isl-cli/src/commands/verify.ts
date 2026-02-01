/**
 * Verify Command
 * 
 * Verifies an implementation against an ISL spec.
 */

import { readFile } from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { parseISL } from '@isl-lang/isl-core';
import { verify as verifyImpl, type VerificationResult } from '@isl-lang/isl-verify';

export interface VerifyOptions {
  implementation?: string;
  verbose?: boolean;
  timeout?: number;
}

export interface VerifyResult {
  success: boolean;
  verification?: VerificationResult;
  errors: string[];
}

export async function verify(specPath: string, options: VerifyOptions = {}): Promise<VerifyResult> {
  const errors: string[] = [];
  const spinner = ora('Loading files...').start();

  try {
    // Read ISL spec
    const specSource = await readFile(specPath, 'utf-8');
    const { ast, errors: parseErrors } = parseISL(specSource, specPath);

    if (parseErrors.length > 0 || !ast) {
      spinner.fail('Failed to parse ISL spec');
      return {
        success: false,
        errors: parseErrors.map(e => 'message' in e ? e.message : String(e)),
      };
    }

    // Read implementation
    if (!options.implementation) {
      spinner.fail('Implementation file required');
      return {
        success: false,
        errors: ['--impl flag is required'],
      };
    }

    const implSource = await readFile(options.implementation, 'utf-8');

    spinner.text = 'Running verification...';

    // Run verification
    const verification = await verifyImpl(ast, implSource, {
      runner: {
        timeout: options.timeout ?? 30000,
        verbose: options.verbose,
      },
    });

    spinner.succeed('Verification complete');

    return {
      success: verification.trustScore.overall >= 70,
      verification,
      errors,
    };
  } catch (error) {
    spinner.fail('Verification failed');
    if (error instanceof Error) {
      errors.push(error.message);
    } else {
      errors.push(String(error));
    }
    return { success: false, errors };
  }
}

export function printVerifyResult(result: VerifyResult): void {
  if (!result.verification) {
    console.log(chalk.red('✗') + ' Verification failed');
    for (const error of result.errors) {
      console.log(chalk.red(`  Error: ${error}`));
    }
    return;
  }

  const { trustScore, testResult } = result.verification;

  // Print trust score header
  const scoreColor = trustScore.overall >= 95 ? chalk.green
    : trustScore.overall >= 85 ? chalk.cyan
    : trustScore.overall >= 70 ? chalk.yellow
    : chalk.red;

  console.log('');
  console.log(chalk.bold('Trust Score: ') + scoreColor(`${trustScore.overall}/100`));
  console.log(chalk.gray(`Confidence: ${trustScore.confidence}%`));
  console.log('');

  // Print recommendation
  const recColor = trustScore.recommendation === 'production_ready' ? chalk.green
    : trustScore.recommendation === 'staging_recommended' ? chalk.cyan
    : trustScore.recommendation === 'shadow_mode' ? chalk.yellow
    : chalk.red;
  
  console.log(chalk.bold('Recommendation: ') + recColor(formatRecommendation(trustScore.recommendation)));
  console.log('');

  // Print breakdown
  console.log(chalk.bold('Breakdown:'));
  printCategory('Postconditions', trustScore.breakdown.postconditions);
  printCategory('Invariants', trustScore.breakdown.invariants);
  printCategory('Scenarios', trustScore.breakdown.scenarios);
  printCategory('Temporal', trustScore.breakdown.temporal);
  console.log('');

  // Print test summary
  console.log(chalk.bold('Test Results:'));
  console.log(chalk.green(`  ✓ ${testResult.passed} passed`));
  if (testResult.failed > 0) {
    console.log(chalk.red(`  ✗ ${testResult.failed} failed`));
  }
  if (testResult.skipped > 0) {
    console.log(chalk.yellow(`  ○ ${testResult.skipped} skipped`));
  }
  console.log(chalk.gray(`  Duration: ${testResult.duration}ms`));

  // Print failures
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

function printCategory(name: string, score: { score: number; passed: number; failed: number; total: number }): void {
  const color = score.score >= 100 ? chalk.green
    : score.score >= 80 ? chalk.cyan
    : score.score >= 60 ? chalk.yellow
    : chalk.red;
  
  const bar = '█'.repeat(Math.floor(score.score / 10)) + '░'.repeat(10 - Math.floor(score.score / 10));
  console.log(`  ${name.padEnd(15)} ${color(bar)} ${score.passed}/${score.total}`);
}

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
