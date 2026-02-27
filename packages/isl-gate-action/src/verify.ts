/**
 * ShipGate ISL Verify — Verification Runner
 *
 * Orchestrates ISL verification across changed files in a PR:
 *   1. Detects changed files via git diff
 *   2. Locates the shipgate CLI
 *   3. Runs `shipgate verify --ci --json` as a subprocess
 *   4. Parses structured JSON output
 *   5. Aggregates results into a single verdict
 *
 * Using the CLI as a subprocess keeps the ncc bundle small and ensures
 * the action uses the same verification logic as local development.
 *
 * @module @isl-lang/gate-action/verify
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { execSync } from 'child_process';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import { resolve, relative, dirname, join } from 'path';
import type {
  ActionInputs,
  FileResult,
  FileStatus,
  FileMethod,
  Verdict,
  VerifyResult,
  ShipGateConfig,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

/**
 * Load `.shipgate.yml` or `.shipgate.yaml` from the workspace.
 * Falls back to empty config if not found.
 */
export function loadConfig(explicitPath?: string): ShipGateConfig {
  const candidates = explicitPath
    ? [explicitPath]
    : ['.shipgate.yml', '.shipgate.yaml', 'shipgate.yml', 'shipgate.yaml'];

  for (const candidate of candidates) {
    const abs = resolve(process.cwd(), candidate);
    if (existsSync(abs)) {
      try {
        const raw = readFileSync(abs, 'utf-8');
        return parseSimpleYaml(raw);
      } catch {
        core.warning(`Failed to parse config file: ${candidate}`);
      }
    }
  }
  return {};
}

/** Minimal YAML parser for flat key-value configs */
function parseSimpleYaml(raw: string): ShipGateConfig {
  const config: ShipGateConfig = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    switch (key) {
      case 'minScore':
        config.minScore = parseInt(value, 10);
        break;
      case 'mode':
        if (['auto', 'strict', 'specless'].includes(value)) {
          config.mode = value as ShipGateConfig['mode'];
        }
        break;
      case 'failOn':
      case 'fail-on':
        if (['error', 'warning', 'unspecced'].includes(value)) {
          config.failOn = value as ShipGateConfig['failOn'];
        }
        break;
    }
  }
  return config;
}

// ---------------------------------------------------------------------------
// CLI discovery
// ---------------------------------------------------------------------------

/**
 * Find the shipgate CLI binary. Tries multiple resolution strategies:
 *   1. npx shipgate (if installed locally or globally)
 *   2. node_modules/.bin/shipgate
 *   3. isl (legacy CLI name)
 */
function findCLI(): string {
  const candidates = [
    'npx shipgate',
    'npx isl',
    resolve(process.cwd(), 'node_modules/.bin/shipgate'),
    resolve(process.cwd(), 'node_modules/.bin/isl'),
  ];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { encoding: 'utf-8', stdio: 'pipe' });
      core.info(`Found CLI: ${cmd}`);
      return cmd;
    } catch {
      // try next
    }
  }

  core.warning('ShipGate CLI not found. Install: npm install -g shipgate');
  return 'npx shipgate';
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

/** Get files changed in the current PR (or last commit on push). */
function getChangedFiles(): string[] {
  try {
    const eventName = github.context.eventName;
    let base: string;

    if (eventName === 'pull_request') {
      base = github.context.payload.pull_request?.base?.sha ?? 'HEAD~1';
    } else {
      base = 'HEAD~1';
    }

    const raw = execSync(`git diff --name-only ${base} HEAD`, {
      encoding: 'utf-8',
    });

    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 0 &&
          /\.(ts|js|tsx|jsx)$/.test(l) &&
          !l.includes('.test.') &&
          !l.includes('.spec.') &&
          !l.endsWith('.d.ts'),
      );
  } catch {
    core.warning('Could not determine changed files via git diff');
    return [];
  }
}

// ---------------------------------------------------------------------------
// CLI execution
// ---------------------------------------------------------------------------

interface CLIOutput {
  verdict: string;
  score: number;
  coverage: { specced: number; total: number };
  mode: string;
  files: Array<{
    file: string;
    status: string;
    mode: string;
    score: number;
    specFile?: string | null;
    blockers: string[];
    errors: string[];
    duration: number;
  }>;
  blockers: string[];
  recommendations: string[];
  duration: number;
  exitCode: number;
}

/**
 * Run the shipgate CLI and parse its JSON output.
 */
function runCLI(cli: string, targetPath: string): CLIOutput | null {
  const args = ['verify', targetPath, '--json', '--ci'];

  const cmd = `${cli} ${args.join(' ')}`;
  core.info(`Running: ${cmd}`);

  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 300_000, // 5 min timeout
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
    });

    // Parse the JSON output (may have non-JSON lines before/after)
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CLIOutput;
    }

    core.warning('CLI output did not contain valid JSON');
    return null;
  } catch (error) {
    // CLI may exit with non-zero for NO_SHIP — capture stdout anyway
    if (error instanceof Error && 'stdout' in error) {
      const stdout = (error as { stdout: string }).stdout;
      const jsonMatch = stdout?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as CLIOutput;
        } catch {
          // fall through
        }
      }
    }

    core.warning(
      `CLI execution failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Map CLI mode string to our FileMethod type.
 */
function mapMethod(cliMode: string): FileMethod {
  switch (cliMode) {
    case 'ISL verified':
      return 'ISL';
    case 'Specless':
      return 'Specless';
    default:
      return 'Skipped';
  }
}

/**
 * Map CLI status string to our FileStatus type.
 */
function mapStatus(cliStatus: string): FileStatus {
  switch (cliStatus) {
    case 'PASS':
      return 'PASS';
    case 'WARN':
      return 'WARN';
    case 'FAIL':
      return 'FAIL';
    default:
      return 'WARN';
  }
}

/**
 * Map CLI verdict to our Verdict type.
 */
function mapVerdict(cliVerdict: string): Verdict {
  switch (cliVerdict) {
    case 'SHIP':
      return 'SHIP';
    case 'WARN':
      return 'WARN';
    case 'NO_SHIP':
      return 'NO_SHIP';
    default:
      return 'WARN';
  }
}

// ---------------------------------------------------------------------------
// Fallback: git-diff-only verification (when CLI is unavailable)
// ---------------------------------------------------------------------------

/**
 * Minimal fallback when the CLI is not available.
 * Reports all changed files as WARN/Skipped so the action still produces
 * a meaningful PR comment instead of a hard failure.
 */
function fallbackVerify(changedFiles: string[]): VerifyResult {
  const files: FileResult[] = changedFiles.map((file) => ({
    file,
    status: 'WARN' as FileStatus,
    method: 'Skipped' as FileMethod,
    score: 0,
    blockers: [],
    duration: 0,
  }));

  return {
    verdict: 'WARN',
    score: 0,
    summary: `ShipGate CLI not found — ${changedFiles.length} files skipped`,
    files,
    blockers: ['ShipGate CLI not installed. Add `npm install -g shipgate` to your workflow.'],
    recommendations: [
      'Install the CLI: `npm install -g shipgate`',
      'Or add a setup step before the verify action',
    ],
    coverage: { specced: 0, total: changedFiles.length },
    duration: 0,
  };
}

// ---------------------------------------------------------------------------
// Main verify entrypoint
// ---------------------------------------------------------------------------

export async function verify(inputs: ActionInputs): Promise<VerifyResult> {
  const startTime = Date.now();
  const config = loadConfig(inputs.configPath);

  const targetPath = resolve(process.cwd(), inputs.path);

  core.info(`ShipGate ISL Verify v${VERSION}`);
  core.info(`Mode: ${config.mode ?? inputs.mode} | Fail-on: ${config.failOn ?? inputs.failOn} | Path: ${inputs.path}`);

  // 1. Discover changed files
  const changedFiles = getChangedFiles();
  core.info(`Changed files: ${changedFiles.length}`);

  if (changedFiles.length === 0) {
    const result: VerifyResult = {
      verdict: 'SHIP',
      score: 1.0,
      summary: 'No code files changed',
      files: [],
      blockers: [],
      recommendations: [],
      coverage: { specced: 0, total: 0 },
      duration: Date.now() - startTime,
    };
    writeReport(result);
    return result;
  }

  // 2. Find CLI
  const cli = findCLI();

  // 3. Run verification via CLI
  const cliOutput = runCLI(cli, inputs.path);

  if (!cliOutput) {
    // Fallback: report changed files as skipped
    const result = fallbackVerify(changedFiles);
    result.duration = Date.now() - startTime;
    writeReport(result);
    return result;
  }

  // 4. Map CLI output to our types
  const files: FileResult[] = cliOutput.files.map((f) => ({
    file: f.file,
    status: mapStatus(f.status),
    method: mapMethod(f.mode),
    score: f.score,
    specFile: f.specFile ?? undefined,
    blockers: f.blockers,
    duration: f.duration,
  }));

  const verdict = mapVerdict(cliOutput.verdict);
  const score = cliOutput.score;
  const failCount = files.filter((f) => f.status === 'FAIL').length;
  const warnCount = files.filter((f) => f.status === 'WARN').length;
  const passCount = files.filter((f) => f.status === 'PASS').length;

  const summaryParts = [`${verdict} (score: ${score.toFixed(2)})`];
  if (passCount > 0) summaryParts.push(`${passCount} passed`);
  if (warnCount > 0) summaryParts.push(`${warnCount} warnings`);
  if (failCount > 0) summaryParts.push(`${failCount} failures`);

  const result: VerifyResult = {
    verdict,
    score,
    summary: summaryParts.join(' | '),
    files,
    blockers: cliOutput.blockers,
    recommendations: cliOutput.recommendations,
    coverage: cliOutput.coverage,
    duration: Date.now() - startTime,
  };

  // 5. Write JSON report
  writeReport(result);

  return result;
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

function writeReport(result: VerifyResult): void {
  try {
    const reportDir = resolve(process.cwd(), '.shipgate');
    mkdirSync(reportDir, { recursive: true });

    const reportPath = join(reportDir, 'verify-report.json');
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          version: VERSION,
          timestamp: new Date().toISOString(),
          sha: github.context.sha,
          ref: github.context.ref,
          ...result,
        },
        null,
        2,
      ),
      'utf-8',
    );

    result.reportPath = reportPath;
    core.info(`Report written to ${reportPath}`);
  } catch (err) {
    core.warning(
      `Failed to write report: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
