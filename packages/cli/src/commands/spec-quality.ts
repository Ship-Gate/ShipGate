/**
 * Spec Quality Command
 *
 * Score ISL specification files across five quality dimensions
 * and show actionable suggestions for improvement.
 *
 * Usage:
 *   isl spec-quality <file>
 *   isl spec-quality <file> --min-score 80
 *   isl spec-quality <file> --fix
 *   isl spec-quality <file> --json
 */

import { readFile, access } from 'fs/promises';
import { resolve, relative, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL } from '@isl-lang/parser';
import { ExitCode } from '../exit-codes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SpecQualityCommandOptions {
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** Minimum score to pass */
  minScore?: number;
  /** Show fix suggestions with ISL examples */
  fix?: boolean;
}

export interface SpecQualityCommandResult {
  success: boolean;
  file: string;
  overallScore: number;
  dimensions: Record<
    string,
    { score: number; findings: string[] }
  >;
  suggestions: Array<{
    dimension: string;
    severity: string;
    message: string;
    example?: string;
  }>;
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function renderBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return chalk.green('\u2588'.repeat(filled)) + chalk.gray('\u2591'.repeat(empty));
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical':
      return chalk.red('!!');
    case 'warning':
      return chalk.yellow('\u26A0');
    case 'info':
      return chalk.blue('\u2139');
    default:
      return ' ';
  }
}

function scoreColor(score: number): typeof chalk {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  return chalk.red;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score an ISL spec file on quality dimensions.
 */
export async function specQuality(
  file: string,
  options: SpecQualityCommandOptions = {},
): Promise<SpecQualityCommandResult> {
  const startTime = Date.now();
  const filePath = resolve(file);
  const minScore = options.minScore ?? 0;
  const isJson = options.format === 'json';
  const spinner = !isJson ? ora('Scoring spec quality...').start() : null;

  // Check file exists
  if (!(await fileExists(filePath))) {
    spinner?.fail(`File not found: ${file}`);
    return {
      success: false,
      file: filePath,
      overallScore: 0,
      dimensions: {},
      suggestions: [],
      duration: Date.now() - startTime,
    };
  }

  try {
    const source = await readFile(filePath, 'utf-8');
    spinner && (spinner.text = 'Parsing...');

    const parseResult = parseISL(source, filePath);

    if (parseResult.errors.length > 0 || !parseResult.domain) {
      spinner?.fail('Parse failed — cannot score invalid ISL');
      return {
        success: false,
        file: filePath,
        overallScore: 0,
        dimensions: {},
        suggestions: [
          {
            dimension: 'completeness',
            severity: 'critical',
            message: `Parse error: ${parseResult.errors[0]?.message ?? 'unknown error'}`,
          },
        ],
        duration: Date.now() - startTime,
      };
    }

    spinner && (spinner.text = 'Running quality checks...');

    // Dynamic import to avoid circular / startup cost
    const { scoreSpec } = await import(
      /* webpackIgnore: true */ '@isl-lang/core/spec-quality'
    );

    const report = scoreSpec(parseResult.domain, filePath);

    const passesMinScore = report.overallScore >= minScore;
    spinner?.stop();

    return {
      success: passesMinScore,
      file: filePath,
      overallScore: report.overallScore,
      dimensions: report.dimensions,
      suggestions: report.suggestions,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    spinner?.fail('Spec quality scoring failed');
    return {
      success: false,
      file: filePath,
      overallScore: 0,
      dimensions: {},
      suggestions: [
        {
          dimension: 'completeness',
          severity: 'critical',
          message: err instanceof Error ? err.message : String(err),
        },
      ],
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print a formatted quality report to the console.
 */
export function printSpecQualityResult(
  result: SpecQualityCommandResult,
  options?: SpecQualityCommandOptions,
): void {
  // JSON output
  if (options?.format === 'json') {
    console.log(
      JSON.stringify(
        {
          success: result.success,
          file: result.file,
          overallScore: result.overallScore,
          dimensions: result.dimensions,
          suggestions: result.suggestions,
          duration: result.duration,
        },
        null,
        2,
      ),
    );
    return;
  }

  // Quiet output
  if (options?.format === 'quiet') {
    const verdict = result.success ? 'PASS' : 'FAIL';
    console.log(`${verdict} ${result.overallScore}/100 ${result.file}`);
    return;
  }

  // Pretty output
  const fileName = basename(result.file);
  console.log('');
  console.log(chalk.bold(`ISL Spec Quality Report: ${fileName}`));
  console.log(chalk.gray('\u2500'.repeat(40)));
  console.log(
    `Overall Score: ${scoreColor(result.overallScore).bold(`${result.overallScore}/100`)}`,
  );
  console.log('');

  const dimensionLabels: Record<string, string> = {
    completeness: 'Completeness',
    specificity: 'Specificity',
    security: 'Security',
    testability: 'Testability',
    consistency: 'Consistency',
  };

  const dims = ['completeness', 'specificity', 'security', 'testability', 'consistency'];

  for (const dim of dims) {
    const d = result.dimensions[dim];
    if (!d) continue;
    if (d.score < 0) {
      console.log(`${chalk.bold(padRight(dimensionLabels[dim] + ':', 16))} ${chalk.gray('skipped')}`);
      continue;
    }

    const bar = renderBar(d.score);
    console.log(
      `${chalk.bold(padRight(dimensionLabels[dim] + ':', 16))} ${bar}  ${scoreColor(d.score)(`${d.score}`)}`,
    );

    // Show findings as checkmarks
    for (const finding of d.findings) {
      console.log(chalk.green(`  \u2713 ${finding}`));
    }

    // Show per-dimension suggestions
    const dimSuggestions = result.suggestions.filter(
      s => s.dimension === dim,
    );
    for (const s of dimSuggestions) {
      console.log(`  ${severityIcon(s.severity)} ${s.message}`);
      if (s.example && options?.fix) {
        console.log(chalk.cyan(`    \u2192 ${s.example.split('\n')[0]}`));
      }
    }

    console.log('');
  }

  // Aggregated suggestions section
  if (result.suggestions.length > 0 && options?.fix) {
    console.log(chalk.bold('Suggestions:'));
    const seen = new Set<string>();
    for (const s of result.suggestions) {
      if (seen.has(s.message)) continue;
      seen.add(s.message);
      console.log(`  ${severityIcon(s.severity)} ${s.message}`);
      if (s.example) {
        const lines = s.example.split('\n');
        for (const line of lines) {
          console.log(chalk.cyan(`    ${line}`));
        }
      }
    }
    console.log('');
  }

  console.log(chalk.gray(`Scored in ${result.duration}ms`));
  console.log('');
}

/**
 * Get exit code for spec quality result.
 */
export function getSpecQualityExitCode(result: SpecQualityCommandResult): number {
  if (result.success) return ExitCode.SUCCESS;
  return ExitCode.ISL_ERROR;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function padRight(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}
