// ============================================================================
// ISL Coverage Command
// ============================================================================

import { analyzeCoverage } from '@isl-lang/isl-coverage';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { glob } from 'glob';
import chalk from 'chalk';
import type {
  CoverageReport,
  CoverageOptions,
  UnboundBehavior,
  UnknownConstraint,
} from '@isl-lang/isl-coverage';

export interface CoverageCommandOptions {
  /** Spec files or patterns */
  specs?: string[];
  /** Bindings file path */
  bindingsFile?: string;
  /** Verification traces directory */
  tracesDir?: string;
  /** Output format */
  format?: 'text' | 'json';
  /** Verbose output */
  verbose?: boolean;
  /** Detailed constraint breakdown */
  detailed?: boolean;
}

export interface CoverageCommandResult {
  success: boolean;
  report?: CoverageReport;
  error?: string;
}

/**
 * Run coverage analysis
 */
export async function coverage(
  options: CoverageCommandOptions
): Promise<CoverageCommandResult> {
  const {
    specs = ['**/*.isl'],
    bindingsFile,
    tracesDir,
    format = 'text',
    verbose = false,
    detailed = false,
  } = options;

  try {
    // Resolve spec files
    const specFiles: string[] = [];
    for (const pattern of Array.isArray(specs) ? specs : [specs]) {
      const matches = await glob(pattern, {
        ignore: ['node_modules/**', '.git/**', 'dist/**'],
      });
      specFiles.push(...matches);
    }

    if (specFiles.length === 0) {
      return {
        success: false,
        error: 'No ISL spec files found',
      };
    }

    // Resolve paths
    const resolvedBindingsFile = bindingsFile
      ? resolve(bindingsFile)
      : resolve('.shipgate.bindings.json');

    const resolvedTracesDir = tracesDir ? resolve(tracesDir) : undefined;

    // Analyze coverage
    const report = await analyzeCoverage({
      specFiles: specFiles.map((f) => resolve(f)),
      bindingsFile: existsSync(resolvedBindingsFile)
        ? resolvedBindingsFile
        : undefined,
      verificationTracesDir: resolvedTracesDir,
      detailed,
    });

    return {
      success: true,
      report,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Print coverage report
 */
export function printCoverageResult(
  result: CoverageCommandResult,
  options: { format?: 'text' | 'json'; verbose?: boolean } = {}
): void {
  const { format = 'text', verbose = false } = options;

  if (!result.success) {
    if (format === 'json') {
      console.log(JSON.stringify({ success: false, error: result.error }, null, 2));
    } else {
      console.error(chalk.red(`\n✗ Coverage analysis failed: ${result.error}\n`));
    }
    return;
  }

  if (!result.report) {
    return;
  }

  const report = result.report;

  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Text output
  console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold.cyan('  ISL Coverage Report'));
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════\n'));

  // Summary
  console.log(chalk.bold('Summary:'));
  console.log(`  Domains: ${report.summary.totalDomains}`);
  console.log(`  Behaviors: ${report.summary.totalBehaviors}`);
  console.log(
    `  Bound: ${report.summary.boundBehaviors} (${percentage(
      report.summary.boundBehaviors,
      report.summary.totalBehaviors
    )}%)`
  );
  console.log(
    `  Exercised: ${report.summary.exercisedBehaviors} (${percentage(
      report.summary.exercisedBehaviors,
      report.summary.totalBehaviors
    )}%)`
  );
  console.log(`  Constraints: ${report.summary.totalConstraints}`);
  console.log(
    `  Evaluated: ${report.summary.evaluatedConstraints} (${percentage(
      report.summary.evaluatedConstraints,
      report.summary.totalConstraints
    )}%)`
  );
  console.log(
    `  Always Unknown: ${chalk.yellow(report.summary.alwaysUnknownConstraints)}`
  );
  console.log('');

  // Per-domain breakdown
  if (report.domains.length > 0) {
    console.log(chalk.bold('Per-Domain Breakdown:\n'));
    for (const domain of report.domains) {
      console.log(`  ${chalk.cyan(domain.domain)}`);
      console.log(`    Behaviors: ${domain.totalBehaviors}`);
      console.log(
        `      Bound: ${domain.boundBehaviors} (${percentage(
          domain.boundBehaviors,
          domain.totalBehaviors
        )}%)`
      );
      console.log(
        `      Exercised: ${domain.exercisedBehaviors} (${percentage(
          domain.exercisedBehaviors,
          domain.totalBehaviors
        )}%)`
      );
      console.log(`    Constraints: ${domain.totalConstraints}`);
      console.log(
        `      Evaluated: ${domain.evaluatedConstraints} (${percentage(
          domain.evaluatedConstraints,
          domain.totalConstraints
        )}%)`
      );
      console.log(
        `      Always Unknown: ${chalk.yellow(domain.alwaysUnknownConstraints)}`
      );
      console.log('');
    }
  }

  // Unbound behaviors
  if (report.unboundBehaviors.length > 0) {
    console.log(
      chalk.bold.yellow(
        `\n⚠️  Unbound Behaviors (${report.unboundBehaviors.length}):\n`
      )
    );
    for (const behavior of report.unboundBehaviors.slice(0, 20)) {
      console.log(
        `  ${chalk.cyan(behavior.name)} (${chalk.gray(behavior.domain)})`
      );
      console.log(
        `    ${chalk.gray(`${behavior.file}:${behavior.line}`)}`
      );
    }
    if (report.unboundBehaviors.length > 20) {
      console.log(
        chalk.gray(`  ... and ${report.unboundBehaviors.length - 20} more`)
      );
    }
    console.log('');
  }

  // Always-unknown constraints
  if (report.unknownConstraints.length > 0) {
    console.log(
      chalk.bold.yellow(
        `\n⚠️  Always-Unknown Constraints (${report.unknownConstraints.length}):\n`
      )
    );
    for (const constraint of report.unknownConstraints.slice(0, 20)) {
      console.log(
        `  ${chalk.cyan(constraint.behavior)} → ${chalk.yellow(constraint.type)}`
      );
      console.log(`    ${chalk.gray(constraint.expression)}`);
      console.log(
        `    ${chalk.gray(`${constraint.file}:${constraint.line}`)}`
      );
      if (constraint.unknownReasons.length > 0) {
        console.log(
          `    Reasons: ${chalk.gray(constraint.unknownReasons.join(', '))}`
        );
      }
      console.log(
        `    Evaluations: ${constraint.evaluationCount} (all unknown)`
      );
      console.log('');
    }
    if (report.unknownConstraints.length > 20) {
      console.log(
        chalk.gray(`  ... and ${report.unknownConstraints.length - 20} more`)
      );
    }
    console.log('');
  }

  // Detailed breakdown (if verbose)
  if (verbose && report.domains.length > 0) {
    console.log(chalk.bold('\nDetailed Breakdown:\n'));
    for (const domain of report.domains) {
      console.log(chalk.bold(`  ${domain.domain}:\n`));
      for (const behavior of domain.behaviors) {
        console.log(`    ${chalk.cyan(behavior.name)}`);
        console.log(
          `      Binding: ${behavior.hasBinding ? chalk.green('✓') : chalk.red('✗')}`
        );
        if (behavior.hasBinding && behavior.bindingFile) {
          console.log(`        ${chalk.gray(behavior.bindingFile)}`);
          if (behavior.bindingConfidence !== undefined) {
            console.log(
              `        Confidence: ${(behavior.bindingConfidence * 100).toFixed(1)}%`
            );
          }
        }
        console.log(
          `      Exercised: ${behavior.exercisedInVerification ? chalk.green('✓') : chalk.red('✗')} (${behavior.exerciseCount}x)`
        );
        console.log(`      Preconditions: ${behavior.preconditions.length}`);
        console.log(`      Postconditions: ${behavior.postconditions.length}`);
        console.log(`      Invariants: ${behavior.invariants.length}`);
        console.log('');
      }
    }
  }

  console.log(chalk.gray(`\nGenerated: ${report.timestamp}\n`));
}

/**
 * Calculate percentage
 */
function percentage(value: number, total: number): string {
  if (total === 0) return '0.0';
  return ((value / total) * 100).toFixed(1);
}

/**
 * Get exit code for coverage command
 */
export function getCoverageExitCode(result: CoverageCommandResult): number {
  if (!result.success) return 1;
  if (!result.report) return 1;

  const report = result.report;

  // Exit with error if:
  // - More than 20% behaviors are unbound
  // - More than 10% constraints are always unknown
  const unboundRatio =
    report.summary.totalBehaviors > 0
      ? report.summary.totalBehaviors - report.summary.boundBehaviors
      : 0 / report.summary.totalBehaviors;
  const unknownRatio =
    report.summary.totalConstraints > 0
      ? report.summary.alwaysUnknownConstraints / report.summary.totalConstraints
      : 0;

  if (unboundRatio > 0.2 || unknownRatio > 0.1) {
    return 1;
  }

  return 0;
}
