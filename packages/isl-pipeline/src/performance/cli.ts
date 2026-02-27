#!/usr/bin/env node
/**
 * Performance CLI
 * 
 * Commands:
 *   benchmark    - Run performance benchmarks
 *   profile      - Generate hotspot profiling report
 *   regression   - Run regression tests
 *   report       - Generate comprehensive report
 * 
 * @module @isl-lang/pipeline/performance
 */

import { runBenchmarkSuite } from './benchmark.js';
import { PerformanceProfiler } from './profiler.js';
import { runRegressionTests, DEFAULT_BUDGETS } from './regression.js';
import { PerformanceReportGenerator } from './report.js';
import { getParseCache, getGateCache } from './cache.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'benchmark':
      await handleBenchmark(args.slice(1));
      break;
    case 'profile':
      await handleProfile(args.slice(1));
      break;
    case 'regression':
      await handleRegression(args.slice(1));
      break;
    case 'report':
      await handleReport(args.slice(1));
      break;
    default:
      printHelp();
  }
}

function printHelp() {
  console.log(`
Performance CLI

Usage:
  isl-performance benchmark [options]     Run performance benchmarks
  isl-performance profile [options]      Generate hotspot profiling report
  isl-performance regression [options]   Run regression tests
  isl-performance report [options]       Generate comprehensive report

Options:
  --output <file>     Output file path (default: stdout)
  --iterations <n>    Number of benchmark iterations (default: 5)
  --warmup <n>        Number of warmup runs (default: 2)
  --budgets <file>    Custom budgets file (JSON)

Examples:
  isl-performance benchmark --iterations 10
  isl-performance regression --output regression.json
  isl-performance report --output report.txt
`);
}

// ============================================================================
// Benchmark Command
// ============================================================================

async function handleBenchmark(args: string[]) {
  const iterations = parseInt(getFlag(args, '--iterations') || '5', 10);
  const warmupRuns = parseInt(getFlag(args, '--warmup') || '2', 10);
  const outputFile = getFlag(args, '--output');

  console.log('Running performance benchmarks...');
  console.log(`Iterations: ${iterations}, Warmup: ${warmupRuns}`);
  console.log('');

  const results = await runBenchmarkSuite({
    iterations,
    warmupRuns,
  });

  const generator = new PerformanceReportGenerator();
  const report = generator.generateBenchmarkReport(results);

  if (outputFile) {
    await fs.writeFile(outputFile, report, 'utf-8');
    console.log(`Report written to ${outputFile}`);
  } else {
    console.log(report);
  }

  // Also write JSON
  if (outputFile) {
    const jsonFile = outputFile.replace(/\.txt$/, '.json');
    await fs.writeFile(jsonFile, JSON.stringify(results, null, 2), 'utf-8');
  }
}

// ============================================================================
// Profile Command
// ============================================================================

async function handleProfile(args: string[]) {
  const outputFile = getFlag(args, '--output');

  console.log('Running performance profiling...');
  console.log('');

  const profiler = new PerformanceProfiler();
  profiler.start();

  // Profile parse/check
  profiler.startSection('parse-check');
  // Would integrate with actual parse/check code
  profiler.endSection('parse-check');

  // Profile gate
  profiler.startSection('gate');
  // Would integrate with actual gate code
  profiler.endSection('gate');

  // Profile heal
  profiler.startSection('heal');
  // Would integrate with actual heal code
  profiler.endSection('heal');

  const report = profiler.generateReport();

  const generator = new PerformanceReportGenerator();
  const reportText = generator.generateHotspotReport(report);

  if (outputFile) {
    await fs.writeFile(outputFile, reportText, 'utf-8');
    console.log(`Report written to ${outputFile}`);
  } else {
    console.log(reportText);
  }
}

// ============================================================================
// Regression Command
// ============================================================================

async function handleRegression(args: string[]) {
  const outputFile = getFlag(args, '--output');
  const budgetsFile = getFlag(args, '--budgets');

  let budgets = DEFAULT_BUDGETS;
  if (budgetsFile) {
    const content = await fs.readFile(budgetsFile, 'utf-8');
    budgets = JSON.parse(content);
  }

  console.log('Running performance regression tests...');
  console.log('');

  const result = await runRegressionTests(budgets);

  const generator = new PerformanceReportGenerator();
  const report = generator.generateRegressionReport(result);

  if (outputFile) {
    await fs.writeFile(outputFile, report, 'utf-8');
    console.log(`Report written to ${outputFile}`);
  } else {
    console.log(report);
  }

  // Exit with error code if tests failed
  if (!result.passed) {
    process.exit(1);
  }
}

// ============================================================================
// Report Command
// ============================================================================

async function handleReport(args: string[]) {
  const outputFile = getFlag(args, '--output');

  console.log('Generating comprehensive performance report...');
  console.log('');

  // Run all tests
  const benchmarkResults = await runBenchmarkSuite();
  const regressionResult = await runRegressionTests();
  
  // Get cache stats
  const parseStats = getParseCache().getStats();
  const gateStats = getGateCache().getStats();

  // Profile (would need actual integration)
  const profileReport: unknown = null;

  const generator = new PerformanceReportGenerator();
  const report = generator.generateComprehensiveReport(
    benchmarkResults,
    profileReport as any,
    parseStats,
    gateStats,
    regressionResult
  );

  if (outputFile) {
    await fs.writeFile(outputFile, report, 'utf-8');
    console.log(`Report written to ${outputFile}`);
  } else {
    console.log(report);
  }
}

// ============================================================================
// Utilities
// ============================================================================

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx < args.length - 1) {
    return args[idx + 1];
  }
  return undefined;
}

// Run
main().catch(console.error);
