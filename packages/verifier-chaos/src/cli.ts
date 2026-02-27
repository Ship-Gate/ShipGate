#!/usr/bin/env node
/**
 * Chaos Verifier CLI
 *
 * Usage:
 *   isl-chaos run <domain.isl> [--behavior <name>] [--output <dir>]
 *   isl-chaos report <chaos-report.json>
 *   isl-chaos verify-proof <proof-bundle.json>
 *
 * The CLI is intentionally self-contained so it can be invoked
 * standalone or composed into the main `isl` CLI as a sub-command.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ChaosEngine, type EngineConfig } from './engine.js';
import { verifyProofIntegrity, type ChaosProofBundle } from './proof.js';
import type { ChaosReport } from './report.js';
import type { BehaviorImplementation } from './executor.js';

/* ------------------------------------------------------------------ */
/*  Arg parsing (no external deps)                                    */
/* ------------------------------------------------------------------ */

interface CliArgs {
  command: 'run' | 'report' | 'verify-proof' | 'help';
  domainPath?: string;
  behavior?: string;
  output?: string;
  implementation?: string;
  filter?: string[];
  parallel?: boolean;
  verbose?: boolean;
  timeout?: number;
  continueOnFailure?: boolean;
  jsonPath?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const command = (args[0] ?? 'help') as CliArgs['command'];

  const result: CliArgs = { command };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    switch (arg) {
      case '--behavior':
      case '-b':
        result.behavior = args[++i];
        break;
      case '--output':
      case '-o':
        result.output = args[++i];
        break;
      case '--impl':
      case '-i':
        result.implementation = args[++i];
        break;
      case '--filter':
      case '-f':
        result.filter = (result.filter ?? []);
        result.filter.push(args[++i]!);
        break;
      case '--parallel':
        result.parallel = true;
        break;
      case '--verbose':
      case '-v':
        result.verbose = true;
        break;
      case '--timeout':
      case '-t':
        result.timeout = parseInt(args[++i]!, 10);
        break;
      case '--continue-on-failure':
        result.continueOnFailure = true;
        break;
      default:
        // positional
        if (!result.domainPath && !arg.startsWith('-')) {
          result.domainPath = arg;
        } else if (!result.jsonPath && !arg.startsWith('-')) {
          result.jsonPath = arg;
        }
        break;
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Commands                                                          */
/* ------------------------------------------------------------------ */

async function runCommand(args: CliArgs): Promise<number> {
  if (!args.domainPath) {
    process.stderr.write('Error: domain file path is required\n');
    return 1;
  }

  const domainPath = path.resolve(args.domainPath);
  if (!fs.existsSync(domainPath)) {
    process.stderr.write(`Error: domain file not found: ${domainPath}\n`);
    return 1;
  }

  // Load domain JSON
  const domainRaw = fs.readFileSync(domainPath, 'utf-8');
  const domain = JSON.parse(domainRaw);

  // Load implementation
  const implementation = await loadImplementation(args.implementation);

  // Build engine config
  const config: EngineConfig = {
    timeoutMs: args.timeout ?? 30_000,
    continueOnFailure: args.continueOnFailure ?? true,
    verbose: args.verbose ?? false,
    scenarioFilter: args.filter ?? [],
    parallel: args.parallel ?? false,
    outputDir: args.output ?? '.chaos-output',
  };

  const engine = new ChaosEngine(config);

  process.stderr.write('Chaos verification starting...\n');
  const startTime = Date.now();

  const result = await engine.run(domain, implementation, args.behavior);

  const elapsed = Date.now() - startTime;

  // Write outputs
  const outputDir = path.resolve(config.outputDir!);
  fs.mkdirSync(outputDir, { recursive: true });

  // Write report
  const reportPath = path.join(outputDir, 'chaos-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(result.report, null, 2));

  // Write proof bundle
  const proofPath = path.join(outputDir, 'chaos-proof.json');
  fs.writeFileSync(proofPath, JSON.stringify(result.proof, null, 2));

  // Write timeline
  const timelinePath = path.join(outputDir, 'chaos-timeline.json');
  fs.writeFileSync(
    timelinePath,
    JSON.stringify(result.timeline, null, 2),
  );

  // Print summary
  renderSummary(result.report, elapsed);

  process.stderr.write(`\nOutputs written to ${outputDir}/\n`);
  process.stderr.write(`  - chaos-report.json\n`);
  process.stderr.write(`  - chaos-proof.json\n`);
  process.stderr.write(`  - chaos-timeline.json\n`);

  return result.success ? 0 : 1;
}

async function reportCommand(args: CliArgs): Promise<number> {
  const jsonPath = args.domainPath ?? args.jsonPath;
  if (!jsonPath) {
    process.stderr.write('Error: report JSON path is required\n');
    return 1;
  }

  const filePath = path.resolve(jsonPath);
  if (!fs.existsSync(filePath)) {
    process.stderr.write(`Error: file not found: ${filePath}\n`);
    return 1;
  }

  const report: ChaosReport = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  renderSummary(report, report.timing.totalMs);

  // Detailed scenario output
  process.stdout.write('\n--- Scenario Details ---\n\n');
  for (const scenario of report.scenarios) {
    const icon = scenario.passed ? '[PASS]' : '[FAIL]';
    process.stdout.write(`${icon} ${scenario.name} (${scenario.durationMs}ms)\n`);
    for (const assertion of scenario.assertions) {
      const aIcon = assertion.passed ? '  +' : '  -';
      process.stdout.write(`${aIcon} ${assertion.type}: ${assertion.message ?? ''}\n`);
    }
    if (scenario.error) {
      process.stdout.write(`  ! Error: ${scenario.error.message}\n`);
    }
    process.stdout.write('\n');
  }

  return 0;
}

async function verifyProofCommand(args: CliArgs): Promise<number> {
  const jsonPath = args.domainPath ?? args.jsonPath;
  if (!jsonPath) {
    process.stderr.write('Error: proof bundle JSON path is required\n');
    return 1;
  }

  const filePath = path.resolve(jsonPath);
  if (!fs.existsSync(filePath)) {
    process.stderr.write(`Error: file not found: ${filePath}\n`);
    return 1;
  }

  const bundle: ChaosProofBundle = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  const valid = verifyProofIntegrity(bundle);

  process.stdout.write(`Bundle ID:    ${bundle.bundleId}\n`);
  process.stdout.write(`Generated:    ${bundle.generatedAt}\n`);
  process.stdout.write(`Verdict:      ${bundle.verdict}\n`);
  process.stdout.write(`Evidence:     ${bundle.evidence.length} scenario(s)\n`);
  process.stdout.write(`Integrity:    ${valid ? 'VALID' : 'INVALID'}\n`);

  if (!valid) {
    process.stderr.write(
      '\nWARNING: Bundle integrity check failed. The bundle may have been tampered with.\n',
    );
    return 1;
  }

  process.stdout.write('\nProof bundle integrity verified.\n');
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Rendering                                                         */
/* ------------------------------------------------------------------ */

function renderSummary(report: ChaosReport, elapsedMs: number): void {
  const verdictColors: Record<string, string> = {
    verified: '\x1b[32m',  // green
    risky: '\x1b[33m',     // yellow
    unsafe: '\x1b[31m',    // red
  };
  const reset = '\x1b[0m';
  const verdictColor = verdictColors[report.summary.verdict] ?? '';

  process.stdout.write('\n=== Chaos Verification Report ===\n\n');
  process.stdout.write(`Domain:    ${report.domainName}\n`);
  process.stdout.write(
    `Verdict:   ${verdictColor}${report.summary.verdict.toUpperCase()}${reset}\n`,
  );
  process.stdout.write(`Score:     ${report.summary.score}/100\n`);
  process.stdout.write(`Duration:  ${elapsedMs}ms\n`);
  process.stdout.write('\n');
  process.stdout.write(`Scenarios: ${report.summary.totalScenarios}\n`);
  process.stdout.write(`  Passed:  ${report.summary.passed}\n`);
  process.stdout.write(`  Failed:  ${report.summary.failed}\n`);
  process.stdout.write(`  Skipped: ${report.summary.skipped}\n`);
  process.stdout.write('\n');
  process.stdout.write('Coverage:\n');
  process.stdout.write(
    `  Injection types: ${report.coverage.injectionTypeCoverage}%\n`,
  );
  process.stdout.write(
    `  Scenarios:       ${report.coverage.scenarioCoverage}%\n`,
  );
  process.stdout.write(
    `  Behaviors:       ${report.coverage.behaviorCoverage}%\n`,
  );
  process.stdout.write(
    `  Overall:         ${report.coverage.overallCoverage}%\n`,
  );
}

/* ------------------------------------------------------------------ */
/*  Implementation loader                                             */
/* ------------------------------------------------------------------ */

async function loadImplementation(
  implPath?: string,
): Promise<BehaviorImplementation> {
  if (implPath) {
    const resolved = path.resolve(implPath);
    const mod = await import(resolved);
    if (typeof mod.execute === 'function') {
      return { execute: mod.execute };
    }
    if (typeof mod.default?.execute === 'function') {
      return mod.default;
    }
    throw new Error(
      `Implementation at ${resolved} must export an execute() function`,
    );
  }

  // Return a stub that always succeeds (useful for dry-run / spec validation)
  return {
    async execute() {
      return { success: true, stub: true };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Help                                                              */
/* ------------------------------------------------------------------ */

function printHelp(): void {
  process.stdout.write(`
isl-chaos - Chaos engineering verifier for ISL

Usage:
  isl-chaos run <domain.json>     Run chaos scenarios against a domain
  isl-chaos report <report.json>  Display a chaos report
  isl-chaos verify-proof <proof.json>  Verify proof bundle integrity

Options:
  -b, --behavior <name>      Only verify a specific behavior
  -o, --output <dir>         Output directory (default: .chaos-output)
  -i, --impl <path>          Path to implementation module
  -f, --filter <pattern>     Filter scenarios by name pattern (repeatable)
  -t, --timeout <ms>         Timeout per scenario (default: 30000)
  -v, --verbose              Enable verbose logging
  --parallel                 Run scenarios in parallel
  --continue-on-failure      Continue after scenario failure

Examples:
  isl-chaos run ./domain.json -b CreateOrder -o ./reports
  isl-chaos run ./domain.json --impl ./impl.js --parallel
  isl-chaos report ./reports/chaos-report.json
  isl-chaos verify-proof ./reports/chaos-proof.json
`);
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

export async function main(argv: string[] = process.argv): Promise<number> {
  const args = parseArgs(argv);

  switch (args.command) {
    case 'run':
      return runCommand(args);
    case 'report':
      return reportCommand(args);
    case 'verify-proof':
      return verifyProofCommand(args);
    case 'help':
    default:
      printHelp();
      return 0;
  }
}

// Direct invocation
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'));

if (isDirectRun) {
  main().then((code) => process.exit(code));
}
