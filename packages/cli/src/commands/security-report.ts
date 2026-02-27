/**
 * Security Report Command
 *
 * Standalone security scanning of any project.
 * Runs SQL injection, auth bypass, secret exposure, XSS, SSRF,
 * dependency audit, and OWASP headers checks.
 *
 * Usage:
 *   isl security-report
 *   isl security-report ./my-project
 *   isl security-report --json
 *   isl security-report --include-audit
 */

import { resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  runVerificationSecurityScan,
  type VerificationSecurityScanResult,
  type SecurityCheckResult,
  type SecurityFinding,
} from '@isl-lang/security-scanner';
import { ExitCode } from '../exit-codes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SecurityReportOptions {
  /** Project root (default: cwd) */
  path?: string;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** Include npm audit (can be slow) */
  includeAudit?: boolean;
  /** ISL spec path for auth-bypass check */
  spec?: string;
  /** Verbose */
  verbose?: boolean;
}

export interface SecurityReportResult {
  success: boolean;
  hasBlockingFindings: boolean;
  hasWarnings: boolean;
  summary: VerificationSecurityScanResult['summary'];
  checks: SecurityCheckResult[];
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export async function securityReport(
  projectPath?: string,
  options: SecurityReportOptions = {}
): Promise<SecurityReportResult> {
  const start = Date.now();
  const rootDir = resolve(projectPath ?? process.cwd());
  const isJson = options.format === 'json';
  const spinner = !isJson ? ora('Running security scan...').start() : null;

  try {
    const result = await runVerificationSecurityScan({
      rootDir,
      islSpecPath: options.spec,
      skipDependencyAudit: !options.includeAudit,
    });

    spinner?.succeed(`Security scan completed in ${result.durationMs}ms`);

    return {
      success: !result.hasBlockingFindings,
      hasBlockingFindings: result.hasBlockingFindings,
      hasWarnings: result.hasWarnings,
      summary: result.summary,
      checks: result.checks,
      duration: result.durationMs,
    };
  } catch (err) {
    spinner?.fail('Security scan failed');
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Print
// ─────────────────────────────────────────────────────────────────────────────

export function printSecurityReportResult(
  result: SecurityReportResult,
  opts: { format?: string; verbose?: boolean } = {}
): void {
  if (opts.format === 'json') {
    console.log(
      JSON.stringify(
        {
          success: result.success,
          hasBlockingFindings: result.hasBlockingFindings,
          hasWarnings: result.hasWarnings,
          summary: result.summary,
          checks: result.checks.map((c) => ({
            check: c.check,
            severity: c.severity,
            passed: c.passed,
            findingCount: c.findings.length,
            findings: c.findings,
          })),
          duration: result.duration,
        },
        null,
        2
      )
    );
    return;
  }

  if (opts.format === 'quiet') return;

  const { summary, checks } = result;

  console.log('\n' + chalk.bold('Security Scan Report'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(
    `  Critical: ${summary.critical}  High: ${summary.high}  Medium: ${summary.medium}  Low: ${summary.low}`
  );
  console.log(`  Total: ${summary.total} findings`);
  console.log(`  Duration: ${result.duration}ms`);
  console.log('');

  if (result.hasBlockingFindings) {
    console.log(chalk.red('  ✗ BLOCKING: Critical or high findings → NO_SHIP'));
  } else if (result.hasWarnings) {
    console.log(chalk.yellow('  ⚠ Passed with warnings (medium/low)'));
  } else {
    console.log(chalk.green('  ✓ Passed: No critical/high findings'));
  }
  console.log('');

  for (const check of checks) {
    const icon = check.passed ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${icon} ${check.check}: ${check.findings.length} finding(s)`);
    if (opts.verbose && check.findings.length > 0) {
      for (const f of check.findings.slice(0, 5)) {
        printFinding(f);
      }
      if (check.findings.length > 5) {
        console.log(chalk.gray(`    ... and ${check.findings.length - 5} more`));
      }
    }
  }

  if (result.hasBlockingFindings || opts.verbose) {
    console.log('\n' + chalk.bold('Findings'));
    console.log(chalk.gray('─'.repeat(50)));
    for (const check of checks) {
      if (check.findings.length > 0) {
        for (const f of check.findings) {
          printFinding(f);
        }
      }
    }
  }
}

function printFinding(f: SecurityFinding): void {
  const sevColor =
    f.severity === 'critical'
      ? chalk.red
      : f.severity === 'high'
        ? chalk.red
        : f.severity === 'medium'
          ? chalk.yellow
          : chalk.gray;
  console.log(
    `  ${sevColor(`[${f.severity}]`)} ${f.title}`
  );
  console.log(chalk.gray(`    ${f.file}:${f.line}`));
  console.log(chalk.gray(`    ${f.description}`));
}

export function getSecurityReportExitCode(result: SecurityReportResult): number {
  return result.hasBlockingFindings ? ExitCode.ISL_ERROR : ExitCode.SUCCESS;
}
