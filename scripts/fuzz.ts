#!/usr/bin/env tsx
/**
 * ShipGate Fuzzing Runner
 *
 * Unified CLI to run any fuzzer for a configurable duration.
 *
 * Usage:
 *   pnpm fuzz --target parser --duration 300
 *   pnpm fuzz --target evaluator --seed 12345
 *   pnpm fuzz --target all --duration 60
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Argument Parsing ────────────────────────────────────────────────────────

interface FuzzOptions {
  target: string;
  duration: number;
  seed: number;
  inputTimeout: number;
}

function parseArgs(): FuzzOptions {
  const args = process.argv.slice(2);
  const options: FuzzOptions = {
    target: 'all',
    duration: 60,
    seed: Date.now(),
    inputTimeout: 5000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--target':
      case '-t':
        options.target = args[++i] ?? 'all';
        break;
      case '--duration':
      case '-d':
        options.duration = parseInt(args[++i] ?? '60', 10);
        break;
      case '--seed':
      case '-s':
        options.seed = parseInt(args[++i] ?? String(Date.now()), 10);
        break;
      case '--input-timeout':
        options.inputTimeout = parseInt(args[++i] ?? '5000', 10);
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }

  return options;
}

function printUsage(): void {
  console.log(`
ShipGate Fuzzing Runner

Usage: pnpm fuzz [options]

Options:
  --target, -t <name>   Fuzzer target: parser, evaluator, smt, scanner, all (default: all)
  --duration, -d <sec>  Duration in seconds (default: 60)
  --seed, -s <number>   Random seed for reproducibility (default: current timestamp)
  --input-timeout <ms>  Per-input timeout in ms (default: 5000)
  --help, -h            Show this help message

Examples:
  pnpm fuzz --target parser --duration 300
  pnpm fuzz --target all --duration 60 --seed 42
  pnpm fuzz -t evaluator -d 120
`);
}

// ─── Runner ──────────────────────────────────────────────────────────────────

interface FuzzerResult {
  name: string;
  totalInputs: number;
  crashes: number;
  hangs: number;
  inputsPerSecond: number;
  durationMs: number;
}

const TARGETS = ['parser', 'evaluator', 'smt', 'scanner'] as const;
type Target = typeof TARGETS[number];

function resolveTargets(target: string): Target[] {
  if (target === 'all') return [...TARGETS];
  if (TARGETS.includes(target as Target)) return [target as Target];
  console.error(`Unknown target: ${target}. Valid targets: ${TARGETS.join(', ')}, all`);
  process.exit(1);
}

async function runFuzzer(target: Target, options: FuzzOptions): Promise<FuzzerResult> {
  const durationMs = options.duration * 1000;
  const fuzzOpts = {
    durationMs,
    seed: options.seed,
    inputTimeoutMs: options.inputTimeout,
    onProgress(count: number) {
      process.stdout.write(`\r  [${target}] ${count} inputs tested...`);
    },
  };

  switch (target) {
    case 'parser': {
      const { fuzzParser } = await import(
        '../packages/parser/tests/fuzz/fuzz-parser.js'
      );
      const result = await fuzzParser(fuzzOpts);
      return {
        name: 'parser',
        totalInputs: result.totalInputs,
        crashes: result.crashes.length,
        hangs: result.hangs.length,
        inputsPerSecond: result.inputsPerSecond,
        durationMs: result.durationMs,
      };
    }

    case 'evaluator': {
      const { fuzzEvaluator } = await import(
        '../packages/isl-expression-evaluator/tests/fuzz/fuzz-evaluator.js'
      );
      const result = await fuzzEvaluator(fuzzOpts);
      return {
        name: 'evaluator',
        totalInputs: result.totalInputs,
        crashes: result.crashes.length,
        hangs: result.hangs.length,
        inputsPerSecond: result.inputsPerSecond,
        durationMs: result.durationMs,
      };
    }

    case 'smt': {
      const { fuzzEncoder } = await import(
        '../packages/isl-smt/tests/fuzz/fuzz-encoder.js'
      );
      const result = await fuzzEncoder(fuzzOpts);
      return {
        name: 'smt',
        totalInputs: result.totalInputs,
        crashes: result.crashes.length,
        hangs: result.hangs.length,
        inputsPerSecond: result.inputsPerSecond,
        durationMs: result.durationMs,
      };
    }

    case 'scanner': {
      const { fuzzScanner } = await import(
        '../packages/security-scanner/tests/fuzz/fuzz-scanner.js'
      );
      const result = await fuzzScanner(fuzzOpts);
      return {
        name: 'scanner',
        totalInputs: result.totalInputs,
        crashes: result.crashes.length,
        hangs: result.hangs.length,
        inputsPerSecond: result.inputsPerSecond,
        durationMs: result.durationMs,
      };
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs();
  const targets = resolveTargets(options.target);

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║           ShipGate Fuzzing Runner                ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Targets:   ${targets.join(', ')}`);
  console.log(`  Duration:  ${options.duration}s per target`);
  console.log(`  Seed:      ${options.seed}`);
  console.log(`  Timeout:   ${options.inputTimeout}ms per input`);
  console.log('');

  const results: FuzzerResult[] = [];
  let hasFailures = false;

  for (const target of targets) {
    console.log(`▸ Running ${target} fuzzer...`);
    try {
      const result = await runFuzzer(target, options);
      results.push(result);
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
      const status = result.crashes > 0 || result.hangs > 0 ? 'FAIL' : 'PASS';
      if (status === 'FAIL') hasFailures = true;
      console.log(
        `  [${status}] ${target}: ${result.totalInputs} inputs, ` +
        `${result.inputsPerSecond} inputs/sec, ` +
        `${result.crashes} crashes, ${result.hangs} hangs`
      );
    } catch (err) {
      console.error(`  [ERROR] ${target} fuzzer failed to run:`, err);
      hasFailures = true;
    }
    console.log('');
  }

  // Summary
  console.log('────────────────────────────────────────────────────');
  console.log('Summary:');
  const totalInputs = results.reduce((sum, r) => sum + r.totalInputs, 0);
  const totalCrashes = results.reduce((sum, r) => sum + r.crashes, 0);
  const totalHangs = results.reduce((sum, r) => sum + r.hangs, 0);
  console.log(`  Total inputs:  ${totalInputs}`);
  console.log(`  Total crashes: ${totalCrashes}`);
  console.log(`  Total hangs:   ${totalHangs}`);
  console.log(`  Overall:       ${hasFailures ? 'FAIL' : 'PASS'}`);
  console.log('');

  // Save results
  const reportPath = path.join(process.cwd(), `fuzz-report-${options.seed}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    seed: options.seed,
    duration: options.duration,
    timestamp: new Date().toISOString(),
    results,
    summary: { totalInputs, totalCrashes, totalHangs, passed: !hasFailures },
  }, null, 2));
  console.log(`  Report saved: ${reportPath}`);

  process.exit(hasFailures ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
