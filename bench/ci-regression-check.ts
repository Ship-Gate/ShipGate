#!/usr/bin/env node
/**
 * CI Performance Regression Check
 * 
 * Compares current benchmark results against baseline and fails if regression exceeds tolerance.
 * 
 * Usage:
 *   pnpm bench:ci                    # Run benchmarks and check for regressions
 *   pnpm bench:ci --baseline <path>   # Use custom baseline file
 *   pnpm bench:ci --tolerance 0.20   # Use 20% tolerance
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runBenchmarks, BUDGETS, REGRESSION_TOLERANCE, type BenchmarkReport, type BenchmarkResult } from './performance-runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASELINE_PATH = join(ROOT, '.test-temp', 'performance-baseline.json');

interface Regression {
  name: string;
  baseline: number;
  current: number;
  regression: number;
  percentage: number;
  tolerance: number;
  exceeded: boolean;
}

function loadBaseline(): BenchmarkReport | null {
  if (!existsSync(BASELINE_PATH)) {
    return null;
  }
  
  try {
    const content = readFileSync(BASELINE_PATH, 'utf-8');
    return JSON.parse(content) as BenchmarkReport;
  } catch {
    return null;
  }
}

function saveBaseline(report: BenchmarkReport): void {
  const dir = join(ROOT, '.test-temp');
  mkdirSync(dir, { recursive: true });
  writeFileSync(BASELINE_PATH, JSON.stringify(report, null, 2));
  console.log(`Baseline saved to: ${BASELINE_PATH}`);
}

function findResult(report: BenchmarkReport, name: string): BenchmarkResult | undefined {
  return report.results.find(r => r.name === name);
}

function detectRegressions(
  baseline: BenchmarkReport,
  current: BenchmarkReport,
  tolerance: number = REGRESSION_TOLERANCE
): Regression[] {
  const regressions: Regression[] = [];
  
  for (const currentResult of current.results) {
    const baselineResult = findResult(baseline, currentResult.name);
    
    if (!baselineResult) {
      // New benchmark, no baseline to compare
      continue;
    }
    
    // Normalize to same unit for comparison
    const baselineValue = baselineResult.unit === 's' 
      ? baselineResult.actual * 1000 
      : baselineResult.actual;
    const currentValue = currentResult.unit === 's'
      ? currentResult.actual * 1000
      : currentResult.actual;
    
    const regression = currentValue - baselineValue;
    const percentage = baselineValue > 0 ? (regression / baselineValue) * 100 : 0;
    const exceeded = percentage > tolerance * 100;
    
    regressions.push({
      name: currentResult.name,
      baseline: baselineValue,
      current: currentValue,
      regression,
      percentage,
      tolerance: tolerance * 100,
      exceeded,
    });
  }
  
  return regressions;
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let baselinePath = BASELINE_PATH;
  let tolerance = REGRESSION_TOLERANCE;
  let updateBaseline = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--baseline' && args[i + 1]) {
      baselinePath = args[i + 1];
      i++;
    } else if (args[i] === '--tolerance' && args[i + 1]) {
      tolerance = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--update-baseline') {
      updateBaseline = true;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('  CI Performance Regression Check');
  console.log('='.repeat(70));
  console.log(`  Tolerance: ${(tolerance * 100).toFixed(1)}%`);
  console.log(`  Baseline: ${baselinePath}`);
  console.log('');
  
  // Run benchmarks
  console.log('Running benchmarks...');
  const currentReport = await runBenchmarks();
  
  // Load baseline
  const baseline = loadBaseline();
  
  if (!baseline) {
    console.log('⚠️  No baseline found. Saving current results as baseline.');
    saveBaseline(currentReport);
    console.log('✓ Baseline created. Future runs will compare against this baseline.');
    process.exit(0);
  }
  
  // Detect regressions
  const regressions = detectRegressions(baseline, currentReport, tolerance);
  
  console.log('\n' + '='.repeat(70));
  console.log('  Regression Analysis');
  console.log('='.repeat(70));
  console.log('');
  
  if (regressions.length === 0) {
    console.log('  ✓ No regressions detected');
  } else {
    console.log('  Benchmark'.padEnd(25) + 'Baseline'.padStart(12) + 'Current'.padStart(12) + 'Change'.padStart(12) + 'Status'.padStart(12));
    console.log('  ' + '-'.repeat(73));
    
    let hasExceeded = false;
    
    for (const reg of regressions) {
      const status = reg.exceeded ? '❌ EXCEEDED' : '✓ OK';
      const change = `${reg.percentage >= 0 ? '+' : ''}${reg.percentage.toFixed(1)}%`;
      
      console.log(
        `  ${reg.name.padEnd(23)}` +
        `${reg.baseline.toFixed(2)}ms`.padStart(12) +
        `${reg.current.toFixed(2)}ms`.padStart(12) +
        change.padStart(12) +
        status.padStart(12)
      );
      
      if (reg.exceeded) {
        hasExceeded = true;
      }
    }
    
    console.log('');
    
    if (hasExceeded) {
      console.log('  ❌ Performance regression detected!');
      console.log(`  Some benchmarks exceeded the ${(tolerance * 100).toFixed(1)}% tolerance threshold.`);
      console.log('');
      
      if (updateBaseline) {
        console.log('  Updating baseline with current results...');
        saveBaseline(currentReport);
        console.log('  ✓ Baseline updated');
      } else {
        console.log('  To update baseline, run with --update-baseline flag');
      }
      
      process.exit(1);
    } else {
      console.log('  ✓ All benchmarks within tolerance');
    }
  }
  
  // Update baseline if requested
  if (updateBaseline) {
    saveBaseline(currentReport);
    console.log('  ✓ Baseline updated');
  }
  
  console.log('');
}

main().catch((error) => {
  console.error('Regression check failed:', error);
  process.exit(1);
});
