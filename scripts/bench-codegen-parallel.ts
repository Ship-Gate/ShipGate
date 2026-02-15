#!/usr/bin/env npx tsx
/**
 * Benchmark: Parallel vs Sequential Codegen
 *
 * Measures time saved by parallel codegen on the todo app dogfood prompt.
 * Runs: isl vibe "Build me a todo app with auth" --parallel and --no-parallel,
 * reports duration and % improvement.
 *
 * Usage:
 *   pnpm exec tsx scripts/bench-codegen-parallel.ts
 *   pnpm exec tsx scripts/bench-codegen-parallel.ts --runs 3
 *   pnpm exec tsx scripts/bench-codegen-parallel.ts --dry-run
 */

import { spawn } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const DOGFOOD_PROMPT = 'Build me a todo app with auth';
const DEFAULT_RUNS = 2;

interface BenchResult {
  mode: 'parallel' | 'sequential';
  durationMs: number;
  success: boolean;
  exitCode: number;
}

async function runVibe(mode: 'parallel' | 'sequential', outputDir: string): Promise<BenchResult> {
  const start = Date.now();
  const args = [
    'vibe',
    DOGFOOD_PROMPT,
    '--output', outputDir,
    '--format', 'quiet',
    mode === 'parallel' ? '--parallel' : '--no-parallel',
    '--max-concurrent', '3',
  ];

  return new Promise((resolve) => {
    const isl = spawn('node', [join(process.cwd(), 'packages/cli/dist/cli.cjs'), ...args], {
      stdio: 'pipe',
      env: { ...process.env, CI: '1' },
    });

    let stderr = '';
    isl.stderr?.on('data', (d) => { stderr += d.toString(); });

    isl.on('close', (code) => {
      const durationMs = Date.now() - start;
      resolve({
        mode,
        durationMs,
        success: code === 0,
        exitCode: code ?? -1,
      });
    });

    isl.on('error', () => {
      resolve({
        mode: 'sequential',
        durationMs: Date.now() - start,
        success: false,
        exitCode: -1,
      });
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const runsIdx = args.indexOf('--runs');
  const runs = runsIdx >= 0 ? parseInt(args[runsIdx + 1] ?? String(DEFAULT_RUNS), 10) : DEFAULT_RUNS;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Parallel Codegen Benchmark');
  console.log('  Prompt:', DOGFOOD_PROMPT);
  console.log('  Runs per mode:', runs);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('Dry run — skipping actual execution');
    process.exit(0);
  }

  const parallelResults: number[] = [];
  const sequentialResults: number[] = [];

  for (let i = 0; i < runs; i++) {
    const dir = await mkdtemp(join(tmpdir(), 'bench-codegen-'));
    try {
      console.log(`Run ${i + 1}/${runs}...`);
      const seq = await runVibe('sequential', join(dir, 'seq'));
      if (seq.success) sequentialResults.push(seq.durationMs);
      console.log(`  Sequential: ${seq.durationMs}ms ${seq.success ? '✓' : '✗'}`);

      const par = await runVibe('parallel', join(dir, 'par'));
      if (par.success) parallelResults.push(par.durationMs);
      console.log(`  Parallel:   ${par.durationMs}ms ${par.success ? '✓' : '✗'}`);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  if (sequentialResults.length === 0 || parallelResults.length === 0) {
    console.error('\nInsufficient successful runs. Check API keys and network.');
    process.exit(1);
  }

  const avgSeq = sequentialResults.reduce((a, b) => a + b, 0) / sequentialResults.length;
  const avgPar = parallelResults.reduce((a, b) => a + b, 0) / parallelResults.length;
  const saved = avgSeq - avgPar;
  const pct = avgSeq > 0 ? ((saved / avgSeq) * 100).toFixed(1) : '0';

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Results');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Sequential avg: ${(avgSeq / 1000).toFixed(1)}s`);
  console.log(`  Parallel avg:   ${(avgPar / 1000).toFixed(1)}s`);
  console.log(`  Time saved:     ${(saved / 1000).toFixed(1)}s (~${pct}%)`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
