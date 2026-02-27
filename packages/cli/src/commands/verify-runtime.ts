/**
 * Verify Runtime Command
 *
 * CLI command implementation for `shipgate verify runtime`.
 * Probes a running application against the Truthpack route/env index,
 * detects fake-success patterns, builds claims, and produces a
 * machine-readable report + human summary.
 */

import * as path from 'path';
import chalk from 'chalk';

// ── Types ──────────────────────────────────────────────────────────────────

export interface VerifyRuntimeOptions {
  /** Base URL of the running application (e.g. http://localhost:3000). */
  baseUrl: string;
  /** Path to truthpack directory (default: .guardrail/truthpack). */
  truthpackDir?: string;
  /** Output directory for report artifacts. */
  outputDir?: string;
  /** Timeout per route probe in ms. */
  timeout?: number;
  /** Only probe routes with these path prefixes. */
  routeFilter?: string[];
  /** Skip routes requiring auth. */
  skipAuth?: boolean;
  /** Use Playwright browser probing for UI routes. */
  browser?: boolean;
  /** Extra headers as key=value pairs. */
  headers?: string[];
  /** Bearer token for authenticated routes. */
  authToken?: string;
  /** Number of concurrent probes. */
  concurrency?: number;
  /** Verbose logging. */
  verbose?: boolean;
  /** JSON output mode. */
  json?: boolean;
  /** Output format. */
  format?: string;
}

export interface VerifyRuntimeResult {
  success: boolean;
  verdict: string;
  score: number;
  summary: {
    routesTotal: number;
    routesPassed: number;
    routesFailed: number;
    envTotal: number;
    envPassed: number;
    envFailed: number;
    fakeSuccessCount: number;
    totalClaims: number;
    durationMs: number;
  };
  reportPath?: string;
  artifactPath?: string;
  summaryPath?: string;
  errors: string[];
}

// ── Command Implementation ─────────────────────────────────────────────────

export async function verifyRuntime(
  options: VerifyRuntimeOptions,
): Promise<VerifyRuntimeResult> {
  try {
    const { runRuntimeProbe } = await import(
      '@isl-lang/verifier-runtime/probe'
    );

    const truthpackDir = options.truthpackDir
      ?? path.join(process.cwd(), '.guardrail', 'truthpack');

    const outputDir = options.outputDir
      ?? path.join(process.cwd(), '.shipgate', 'artifacts', 'runtime-probe');

    // Parse headers from key=value pairs
    const headers: Record<string, string> = {};
    if (options.headers) {
      for (const h of options.headers) {
        const eqIdx = h.indexOf('=');
        if (eqIdx > 0) {
          headers[h.slice(0, eqIdx)] = h.slice(eqIdx + 1);
        }
      }
    }

    const result = await runRuntimeProbe({
      baseUrl: options.baseUrl,
      truthpackDir,
      outputDir,
      timeoutMs: options.timeout,
      routeFilter: options.routeFilter,
      skipAuthRoutes: options.skipAuth,
      browserProbe: options.browser,
      verbose: options.verbose,
      concurrency: options.concurrency,
      headers,
      authToken: options.authToken,
    });

    const { report } = result;

    return {
      success: report.verdict === 'PROVEN',
      verdict: report.verdict,
      score: report.score,
      summary: {
        routesTotal: report.summary.routes.total,
        routesPassed: report.summary.routes.passed,
        routesFailed: report.summary.routes.failed,
        envTotal: report.summary.envVars.total,
        envPassed: report.summary.envVars.passed,
        envFailed: report.summary.envVars.failed,
        fakeSuccessCount: report.summary.fakeSuccessDetections,
        totalClaims: report.summary.totalClaims,
        durationMs: report.summary.durationMs,
      },
      reportPath: result.paths?.reportPath,
      artifactPath: result.paths?.artifactPath,
      summaryPath: result.paths?.summaryPath,
      errors: [],
    };
  } catch (err) {
    return {
      success: false,
      verdict: 'FAILED',
      score: 0,
      summary: {
        routesTotal: 0,
        routesPassed: 0,
        routesFailed: 0,
        envTotal: 0,
        envPassed: 0,
        envFailed: 0,
        fakeSuccessCount: 0,
        totalClaims: 0,
        durationMs: 0,
      },
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

// ── Output Formatting ──────────────────────────────────────────────────────

export function printVerifyRuntimeResult(
  result: VerifyRuntimeResult,
  options: { json?: boolean; verbose?: boolean; format?: string } = {},
): void {
  if (options.json || options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const { summary } = result;
  const icon = result.verdict === 'PROVEN' ? chalk.green('[PASS]')
    : result.verdict === 'INCOMPLETE' ? chalk.yellow('[WARN]')
    : chalk.red('[FAIL]');

  console.log('');
  console.log(chalk.bold('Runtime Probe Results'));
  console.log('─'.repeat(50));
  console.log(`  Verdict:       ${icon} ${chalk.bold(result.verdict)}`);
  console.log(`  Score:         ${colorScore(result.score)}/100`);
  console.log(`  Duration:      ${summary.durationMs.toFixed(0)}ms`);
  console.log('');

  // Routes
  console.log(chalk.bold('  Routes'));
  console.log(`    Total:       ${summary.routesTotal}`);
  console.log(`    Passed:      ${chalk.green(String(summary.routesPassed))}`);
  if (summary.routesFailed > 0) {
    console.log(`    Failed:      ${chalk.red(String(summary.routesFailed))}`);
  }
  if (summary.fakeSuccessCount > 0) {
    console.log(`    Fake-success: ${chalk.yellow(String(summary.fakeSuccessCount))}`);
  }
  console.log('');

  // Env
  console.log(chalk.bold('  Environment Variables'));
  console.log(`    Total:       ${summary.envTotal}`);
  console.log(`    Passed:      ${chalk.green(String(summary.envPassed))}`);
  if (summary.envFailed > 0) {
    console.log(`    Failed:      ${chalk.red(String(summary.envFailed))}`);
  }
  console.log('');

  // Claims
  console.log(`  Claims:        ${summary.totalClaims}`);
  console.log('');

  // Artifacts
  if (result.reportPath) {
    console.log(chalk.gray(`  Report:   ${result.reportPath}`));
  }
  if (result.artifactPath) {
    console.log(chalk.gray(`  Artifact: ${result.artifactPath}`));
  }
  if (result.summaryPath) {
    console.log(chalk.gray(`  Summary:  ${result.summaryPath}`));
  }

  // Errors
  if (result.errors.length > 0) {
    console.log('');
    console.log(chalk.red('  Errors:'));
    for (const err of result.errors) {
      console.log(chalk.red(`    - ${err}`));
    }
  }

  console.log('─'.repeat(50));
}

export function getVerifyRuntimeExitCode(result: VerifyRuntimeResult): number {
  if (result.errors.length > 0) return 3; // Internal error
  if (result.verdict === 'PROVEN') return 0;
  if (result.verdict === 'INCOMPLETE') return 0; // Warn but don't fail
  return 1; // FAILED
}

// ── Helpers ────────────────────────────────────────────────────────────────

function colorScore(score: number): string {
  if (score >= 85) return chalk.green(String(score));
  if (score >= 50) return chalk.yellow(String(score));
  return chalk.red(String(score));
}
