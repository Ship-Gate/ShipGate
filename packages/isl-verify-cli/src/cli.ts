#!/usr/bin/env node
/**
 * isl-verify CLI — Instant verification for any project
 *
 * Usage:
 *   isl-verify .              # Scan current directory
 *   isl-verify scan <path>    # Scan specified path
 *   isl-verify init           # Setup .isl-verify/
 *   isl-verify diff           # Show changes since last scan
 *   isl-verify explain <id>   # Deep dive on a finding
 *   isl-verify --json         # Machine-readable output
 *   isl-verify --fix          # Auto-fix simple findings
 *   isl-verify --watch        # Re-scan on file changes
 */

import { Command } from 'commander';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import chalk from 'chalk';
import { runScan } from './scan.js';
import { formatScanOutput } from './output.js';
import { runInit, formatInitOutput } from './init.js';
import { runDiff, formatDiffOutput } from './diff.js';
import { runExplain, formatExplainOutput } from './explain.js';
import { getReportPath, loadConfig } from './config.js';

const program = new Command();

program
  .name('isl-verify')
  .description('ISL Verify — Instant verification for any project. Infer specs from code, verify implementation, detect hallucinations.')
  .version('0.1.0');

// Global options
const globalOpts = {
  json: false,
  fix: false,
  watch: false,
  verbose: false,
};

program
  .option('--json', 'Machine-readable output for CI')
  .option('--fix', 'Auto-fix simple findings (unused imports, missing null checks)')
  .option('--watch', 'Re-scan on file changes')
  .option('--verbose', 'Show medium/low findings');

// Primary: isl-verify . or isl-verify scan <path>
program
  .argument('[path]', 'Path to scan (default: .)')
  .action(async (pathArg: string) => {
    const opts = program.opts();
    const path = pathArg || '.';
    const projectRoot = resolve(path);

    if (opts.watch) {
      await runWatch(projectRoot, opts);
      return;
    }

    const report = await runScan({
      path: projectRoot,
      verbose: opts.verbose,
    });

    // Save report for diff
    const reportPath = getReportPath(projectRoot);
    const reportDir = join(projectRoot, '.isl-verify');
    if (!existsSync(reportDir)) {
      await mkdir(reportDir, { recursive: true });
    }
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.verdict === 'NO_SHIP' ? 1 : 0);
      return;
    }

    if (opts.fix && report.findings.length > 0) {
      await runFix(report, projectRoot);
    }

    console.log(formatScanOutput(report, { verbose: opts.verbose }));
    process.exit(report.verdict === 'NO_SHIP' ? 1 : 0);
  });

// Explicit scan command
program
  .command('scan [path]')
  .description('Scan project for verification (default: .)')
  .option('--json', 'Machine-readable output')
  .option('--verbose', 'Show medium/low findings')
  .action(async (pathArg: string, cmdOpts: { json?: boolean; verbose?: boolean }) => {
    const path = pathArg || '.';
    const projectRoot = resolve(path);

    const report = await runScan({
      path: projectRoot,
      verbose: cmdOpts.verbose ?? false,
    });

    const reportPath = getReportPath(projectRoot);
    const reportDir = join(projectRoot, '.isl-verify');
    if (!existsSync(reportDir)) {
      await mkdir(reportDir, { recursive: true });
    }
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    if (cmdOpts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatScanOutput(report, { verbose: cmdOpts.verbose ?? false }));
    }

    process.exit(report.verdict === 'NO_SHIP' ? 1 : 0);
  });

// Init command
program
  .command('init')
  .description('Setup .isl-verify/ directory, config, and inferred specs')
  .option('-f, --force', 'Overwrite existing config')
  .action(async (cmdOpts: { force?: boolean }) => {
    const result = await runInit({ force: cmdOpts.force });
    console.log(formatInitOutput(result));
    process.exit(result.success ? 0 : 1);
  });

// Diff command
program
  .command('diff')
  .description('Show what changed since last scan')
  .option('[path]', 'Project path (default: .)')
  .action(async () => {
    const projectRoot = resolve(process.cwd());
    const report = await runScan({ path: projectRoot });
    const diffResult = await runDiff(report, projectRoot);
    console.log(formatDiffOutput(diffResult));
  });

// Explain command
program
  .command('explain <finding-id>')
  .description('Deep dive on a specific finding')
  .action(async (findingId: string) => {
    const projectRoot = resolve(process.cwd());
    const result = await runExplain(findingId, projectRoot);
    console.log(formatExplainOutput(result));
    process.exit(result.found ? 0 : 1);
  });

async function runWatch(projectRoot: string, opts: { verbose?: boolean }): Promise<void> {
  const chokidar = await import('chokidar');
  const config = await loadConfig(projectRoot);
  const sourceDirs = config.sourceDirs ?? ['src', 'app', 'lib', 'pages'];
  let watchPaths = sourceDirs
    .map((d) => join(projectRoot, d))
    .filter((p) => existsSync(p));

  if (watchPaths.length === 0) {
    watchPaths = [projectRoot];
  }

  process.stderr.write(chalk.cyan('Watching for changes...') + '\n');

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const debounceMs = 300;

  const run = async () => {
    process.stderr.write(chalk.gray('Re-scanning...') + '\n');
    const report = await runScan({ path: projectRoot, verbose: opts.verbose });
    const reportPath = getReportPath(projectRoot);
    const reportDir = join(projectRoot, '.isl-verify');
    if (!existsSync(reportDir)) {
      await mkdir(reportDir, { recursive: true });
    }
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(formatScanOutput(report, { verbose: opts.verbose }));
  };

  const watcher = chokidar.watch(watchPaths, {
    ignored: /node_modules|\.next|dist|coverage/,
    ignoreInitial: true,
  });

  watcher.on('change', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      run().catch((err) => {
        process.stderr.write(chalk.red(String(err)) + '\n');
      });
    }, debounceMs);
  });

  await run();
}

async function runFix(report: import('./types.js').ScanReport, projectRoot: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runShipgateFix } = await import('@isl-lang/autofix');
    const { writeFile } = await import('fs/promises');
    const { join } = await import('path');

    const fixable = report.findings.filter(
      (f) =>
        f.ruleId?.includes('unused') ||
        f.ruleId?.includes('import') ||
        (f.recommendation?.toLowerCase().includes('null') ?? false)
    );
    if (fixable.length === 0) {
      process.stderr.write(chalk.gray('No auto-fixable findings.') + '\n');
      return;
    }

    const evidencePath = join(projectRoot, '.isl-verify', 'fix-evidence.json');
    await writeFile(
      evidencePath,
      JSON.stringify({ results: { findings: fixable } }),
      'utf-8'
    );

    await runShipgateFix({
      projectRoot,
      evidencePath: '.isl-verify/fix-evidence.json',
      dryRun: false,
      apply: true,
    });
    process.stderr.write(chalk.green(`Attempted fixes for ${fixable.length} finding(s).`) + '\n');
  } catch (err) {
    process.stderr.write(
      chalk.yellow('Autofix not available or failed. Install @isl-lang/autofix for --fix support.') + '\n'
    );
  }
}

program.parse();
