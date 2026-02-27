#!/usr/bin/env node
/**
 * Gate Calibration Benchmark Runner
 * 
 * Executes verify+gate on corpus fixtures and outputs metrics:
 * - Confusion matrix
 * - Per-rule precision/recall
 * - Top false positives/negatives
 * 
 * Usage:
 *   npx tsx bench/corpus/runner.ts [options]
 * 
 * Options:
 *   --threshold <score>  Gate threshold to test (default: 70)
 *   --verbose            Show detailed per-fixture results
 *   --json               Output JSON metrics
 *   --tune               Auto-tune thresholds to hit targets
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { parseArgs } from 'node:util';

// Gate function references (loaded in main)
let runGate: typeof import('../../packages/isl-gate/src/gate.js').runGate | undefined;
let gate: typeof import('../../packages/cli/src/commands/gate.js').gate | undefined;

// ============================================================================
// Types
// ============================================================================

interface CorpusFixture {
  id: string;
  path: string;
  specPath: string;
  implPath: string;
  metadata: FixtureMetadata;
}

interface FixtureMetadata {
  expectedVerdict: 'SHIP' | 'NO_SHIP';
  category: string;
  description: string;
  knownViolations?: Array<{
    ruleId: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }>;
  tags?: string[];
}

interface BenchmarkResult {
  fixture: CorpusFixture;
  gateResult: any; // GateResult from isl-gate
  cliGateResult?: any; // CliGateResult
  verifyResult?: any; // VerifyResult
  actualVerdict: 'SHIP' | 'NO_SHIP';
  correct: boolean;
  falsePositive: boolean;
  falseNegative: boolean;
}

interface BenchmarkMetrics {
  total: number;
  good: number;
  bad: number;
  correct: number;
  falsePositives: number;
  falseNegatives: number;
  confusionMatrix: {
    truePositive: number;
    trueNegative: number;
    falsePositive: number;
    falseNegative: number;
  };
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  perRuleMetrics: Record<string, {
    detected: number;
    missed: number;
    falseAlarms: number;
    precision: number;
    recall: number;
  }>;
  topFalsePositives: Array<{
    fixture: string;
    score: number;
    violations: string[];
  }>;
  topFalseNegatives: Array<{
    fixture: string;
    score: number;
    expectedViolations: string[];
  }>;
  scoreDistribution: {
    good: number[];
    bad: number[];
  };
}

// ============================================================================
// CLI Arguments
// ============================================================================

interface CLIOptions {
  threshold?: number;
  verbose: boolean;
  json: boolean;
  tune: boolean;
  help: boolean;
}

function parseCliArgs(): CLIOptions {
  try {
    const { values } = parseArgs({
      options: {
        threshold: { type: 'string' },
        verbose: { type: 'boolean', short: 'v', default: false },
        json: { type: 'boolean', short: 'j', default: false },
        tune: { type: 'boolean', short: 't', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
    });
    
    return {
      threshold: values.threshold ? parseFloat(values.threshold) : undefined,
      verbose: values.verbose ?? false,
      json: values.json ?? false,
      tune: values.tune ?? false,
      help: values.help ?? false,
    };
  } catch (error) {
    return { verbose: false, json: false, tune: false, help: true };
  }
}

// ============================================================================
// Corpus Loading
// ============================================================================

async function loadCorpus(baseDir: string): Promise<CorpusFixture[]> {
  const fixtures: CorpusFixture[] = [];
  const corpusDir = resolve(baseDir);
  
  for (const category of ['good', 'bad']) {
    const categoryDir = join(corpusDir, category);
    if (!existsSync(categoryDir)) {
      continue;
    }
    
    const entries = await readdir(categoryDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const fixtureDir = join(categoryDir, entry.name);
      const specPath = join(fixtureDir, 'spec.isl');
      const implPath = join(fixtureDir, 'impl.ts');
      const metadataPath = join(fixtureDir, 'metadata.json');
      
      if (!existsSync(specPath) || !existsSync(implPath)) {
        continue;
      }
      
      let metadata: FixtureMetadata;
      if (existsSync(metadataPath)) {
        const metadataContent = await readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } else {
        // Infer from category
        metadata = {
          expectedVerdict: category === 'good' ? 'SHIP' : 'NO_SHIP',
          category,
          description: entry.name,
        };
      }
      
      fixtures.push({
        id: `${category}/${entry.name}`,
        path: fixtureDir,
        specPath,
        implPath,
        metadata,
      });
    }
  }
  
  return fixtures;
}

// ============================================================================
// Benchmark Execution
// ============================================================================

async function runBenchmark(
  fixtures: CorpusFixture[],
  threshold: number
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  
  console.log(`Running benchmark on ${fixtures.length} fixtures (threshold: ${threshold})...\n`);
  
  for (const fixture of fixtures) {
    try {
      // Read files
      const specContent = await readFile(fixture.specPath, 'utf-8');
      const implContent = await readFile(fixture.implPath, 'utf-8');
      
      // Run gate (isl-gate version)
      let gateResult: GateResult;
      if (runGate) {
        gateResult = await runGate(
          [{ path: fixture.implPath, content: implContent }],
          { threshold }
        );
      } else {
        // Fallback: create minimal result
        gateResult = {
          verdict: 'NO_SHIP',
          score: 0,
          violations: [],
          fingerprint: '',
          policyBundleVersion: '0.0.0',
          rulepackVersions: [],
          summary: { filesChecked: 1, blockers: 0, warnings: 0 },
          timestamp: new Date().toISOString(),
        };
      }
      
      // Try CLI gate if available
      let cliGateResult: CliGateResult | undefined;
      if (gate) {
        try {
          cliGateResult = await gate(fixture.specPath, {
            impl: fixture.implPath,
            threshold,
            ci: true,
          });
        } catch (error) {
          // CLI gate may not be available, continue
        }
      }
      
      // Determine actual verdict
      const actualVerdict = gateResult.verdict === 'SHIP' ? 'SHIP' : 'NO_SHIP';
      const expectedVerdict = fixture.metadata.expectedVerdict;
      
      const correct = actualVerdict === expectedVerdict;
      const falsePositive = expectedVerdict === 'NO_SHIP' && actualVerdict === 'SHIP';
      const falseNegative = expectedVerdict === 'SHIP' && actualVerdict === 'NO_SHIP';
      
      results.push({
        fixture,
        gateResult,
        cliGateResult,
        actualVerdict,
        correct,
        falsePositive,
        falseNegative,
      });
      
      if (process.env.VERBOSE || false) {
        const status = correct ? '✓' : '✗';
        console.log(`${status} ${fixture.id}: ${actualVerdict} (expected: ${expectedVerdict}, score: ${gateResult.score})`);
      }
    } catch (error) {
      console.error(`Error processing ${fixture.id}:`, error);
      results.push({
        fixture,
        gateResult: {
          verdict: 'NO_SHIP',
          score: 0,
          violations: [],
          fingerprint: '',
          policyBundleVersion: '0.0.0',
          rulepackVersions: [],
          summary: { filesChecked: 0, blockers: 0, warnings: 0 },
          timestamp: new Date().toISOString(),
        },
        actualVerdict: 'NO_SHIP',
        correct: fixture.metadata.expectedVerdict === 'NO_SHIP',
        falsePositive: false,
        falseNegative: fixture.metadata.expectedVerdict === 'SHIP',
      });
    }
  }
  
  return results;
}

// ============================================================================
// Metrics Calculation
// ============================================================================

function calculateMetrics(results: BenchmarkResult[]): BenchmarkMetrics {
  const good = results.filter(r => r.fixture.metadata.expectedVerdict === 'SHIP');
  const bad = results.filter(r => r.fixture.metadata.expectedVerdict === 'NO_SHIP');
  
  const truePositive = bad.filter(r => r.actualVerdict === 'NO_SHIP').length;
  const trueNegative = good.filter(r => r.actualVerdict === 'SHIP').length;
  const falsePositive = good.filter(r => r.actualVerdict === 'NO_SHIP').length;
  const falseNegative = bad.filter(r => r.actualVerdict === 'SHIP').length;
  
  const precision = truePositive + falsePositive > 0
    ? truePositive / (truePositive + falsePositive)
    : 1;
  const recall = truePositive + falseNegative > 0
    ? truePositive / (truePositive + falseNegative)
    : 1;
  const f1Score = precision + recall > 0
    ? 2 * (precision * recall) / (precision + recall)
    : 0;
  const accuracy = results.length > 0
    ? (truePositive + trueNegative) / results.length
    : 0;
  
  // Per-rule metrics
  const perRuleMetrics: Record<string, {
    detected: number;
    missed: number;
    falseAlarms: number;
    precision: number;
    recall: number;
  }> = {};
  
  for (const result of results) {
    const violations = new Set(result.gateResult.violations.map(v => v.ruleId));
    const expectedViolations = new Set(
      result.fixture.metadata.knownViolations?.map(v => v.ruleId) || []
    );
    
    for (const ruleId of violations) {
      if (!perRuleMetrics[ruleId]) {
        perRuleMetrics[ruleId] = {
          detected: 0,
          missed: 0,
          falseAlarms: 0,
          precision: 0,
          recall: 0,
        };
      }
      
      if (expectedViolations.has(ruleId)) {
        perRuleMetrics[ruleId].detected++;
      } else {
        perRuleMetrics[ruleId].falseAlarms++;
      }
    }
    
    for (const ruleId of expectedViolations) {
      if (!violations.has(ruleId)) {
        if (!perRuleMetrics[ruleId]) {
          perRuleMetrics[ruleId] = {
            detected: 0,
            missed: 0,
            falseAlarms: 0,
            precision: 0,
            recall: 0,
          };
        }
        perRuleMetrics[ruleId].missed++;
      }
    }
  }
  
  // Calculate per-rule precision/recall
  for (const ruleId in perRuleMetrics) {
    const m = perRuleMetrics[ruleId];
    m.precision = m.detected + m.falseAlarms > 0
      ? m.detected / (m.detected + m.falseAlarms)
      : 1;
    m.recall = m.detected + m.missed > 0
      ? m.detected / (m.detected + m.missed)
      : 1;
  }
  
  // Top false positives
  const topFalsePositives = results
    .filter(r => r.falsePositive)
    .map(r => ({
      fixture: r.fixture.id,
      score: r.gateResult.score,
      violations: r.gateResult.violations.map(v => `${v.ruleId}: ${v.message}`),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);
  
  // Top false negatives
  const topFalseNegatives = results
    .filter(r => r.falseNegative)
    .map(r => ({
      fixture: r.fixture.id,
      score: r.gateResult.score,
      expectedViolations: r.fixture.metadata.knownViolations?.map(
        v => `${v.ruleId}: ${v.description}`
      ) || [],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  
  // Score distribution
  const scoreDistribution = {
    good: good.map(r => r.gateResult.score),
    bad: bad.map(r => r.gateResult.score),
  };
  
  return {
    total: results.length,
    good: good.length,
    bad: bad.length,
    correct: truePositive + trueNegative,
    falsePositives,
    falseNegatives,
    confusionMatrix: {
      truePositive,
      trueNegative,
      falsePositive,
      falseNegative,
    },
    precision,
    recall,
    f1Score,
    accuracy,
    perRuleMetrics,
    topFalsePositives,
    topFalseNegatives,
    scoreDistribution,
  };
}

// ============================================================================
// Output
// ============================================================================

function printMetrics(metrics: BenchmarkMetrics, threshold: number, verbose: boolean): void {
  console.log('\n' + '='.repeat(80));
  console.log('GATE CALIBRATION BENCHMARK RESULTS');
  console.log('='.repeat(80));
  console.log(`\nThreshold: ${threshold}`);
  console.log(`Total fixtures: ${metrics.total} (${metrics.good} good, ${metrics.bad} bad)\n`);
  
  console.log('Confusion Matrix:');
  console.log(`  True Positives (bad → NO_SHIP):  ${metrics.confusionMatrix.truePositive}`);
  console.log(`  True Negatives (good → SHIP):   ${metrics.confusionMatrix.trueNegative}`);
  console.log(`  False Positives (good → NO_SHIP): ${metrics.confusionMatrix.falsePositive}`);
  console.log(`  False Negatives (bad → SHIP):    ${metrics.confusionMatrix.falseNegative}\n`);
  
  console.log('Overall Metrics:');
  console.log(`  Accuracy:  ${(metrics.accuracy * 100).toFixed(2)}%`);
  console.log(`  Precision: ${(metrics.precision * 100).toFixed(2)}%`);
  console.log(`  Recall:    ${(metrics.recall * 100).toFixed(2)}%`);
  console.log(`  F1 Score:  ${(metrics.f1Score * 100).toFixed(2)}%\n`);
  
  const fpRate = metrics.good > 0 ? metrics.falsePositives / metrics.good : 0;
  const fnRate = metrics.bad > 0 ? metrics.falseNegatives / metrics.bad : 0;
  
  console.log('Target Compliance:');
  console.log(`  False Positive Rate: ${(fpRate * 100).toFixed(2)}% (target: <5%)`);
  console.log(`  False Negative Rate: ${(fnRate * 100).toFixed(2)}% (target: <10%)\n`);
  
  if (metrics.topFalsePositives.length > 0) {
    console.log('Top False Positives:');
    for (const fp of metrics.topFalsePositives.slice(0, 5)) {
      console.log(`  ${fp.fixture}: score=${fp.score}, violations=${fp.violations.length}`);
      if (verbose && fp.violations.length > 0) {
        fp.violations.slice(0, 2).forEach(v => console.log(`    - ${v}`));
      }
    }
    console.log();
  }
  
  if (metrics.topFalseNegatives.length > 0) {
    console.log('Top False Negatives:');
    for (const fn of metrics.topFalseNegatives.slice(0, 5)) {
      console.log(`  ${fn.fixture}: score=${fn.score}, expected=${fn.expectedViolations.length} violations`);
      if (verbose && fn.expectedViolations.length > 0) {
        fn.expectedViolations.slice(0, 2).forEach(v => console.log(`    - ${v}`));
      }
    }
    console.log();
  }
  
  if (verbose && Object.keys(metrics.perRuleMetrics).length > 0) {
    console.log('Per-Rule Metrics:');
    const sortedRules = Object.entries(metrics.perRuleMetrics)
      .sort((a, b) => b[1].detected - a[1].detected)
      .slice(0, 10);
    
    for (const [ruleId, ruleMetrics] of sortedRules) {
      console.log(`  ${ruleId}:`);
      console.log(`    Precision: ${(ruleMetrics.precision * 100).toFixed(1)}%`);
      console.log(`    Recall:    ${(ruleMetrics.recall * 100).toFixed(1)}%`);
      console.log(`    Detected:  ${ruleMetrics.detected}, Missed: ${ruleMetrics.missed}, False Alarms: ${ruleMetrics.falseAlarms}`);
    }
    console.log();
  }
}

// ============================================================================
// Threshold Tuning
// ============================================================================

async function tuneThresholds(
  fixtures: CorpusFixture[],
  targetFPRate: number = 0.05,
  targetFNRate: number = 0.10
): Promise<number> {
  console.log('Tuning thresholds to hit targets...\n');
  
  let bestThreshold = 70;
  let bestScore = Infinity;
  
  // Try thresholds from 50 to 95
  for (let threshold = 50; threshold <= 95; threshold += 5) {
    const results = await runBenchmark(fixtures, threshold);
    const metrics = calculateMetrics(results);
    
    const fpRate = metrics.good > 0 ? metrics.falsePositives / metrics.good : 0;
    const fnRate = metrics.bad > 0 ? metrics.falseNegatives / metrics.bad : 0;
    
    // Score: distance from targets (lower is better)
    const fpPenalty = Math.max(0, fpRate - targetFPRate) * 100;
    const fnPenalty = Math.max(0, fnRate - targetFNRate) * 100;
    const score = fpPenalty + fnPenalty;
    
    if (score < bestScore) {
      bestScore = score;
      bestThreshold = threshold;
    }
    
    if (process.env.VERBOSE) {
      console.log(`Threshold ${threshold}: FP=${(fpRate * 100).toFixed(1)}%, FN=${(fnRate * 100).toFixed(1)}%, score=${score.toFixed(2)}`);
    }
  }
  
  return bestThreshold;
}

// ============================================================================
// Main
// ============================================================================

async function loadGateFunctions(): Promise<void> {
  // Try to load gate functions
  try {
    const islGate = await import('../../packages/isl-gate/src/gate.js');
    runGate = islGate.runGate;
  } catch (error) {
    console.warn('Warning: isl-gate not available, using fallback');
  }

  try {
    const cliGate = await import('../../packages/cli/src/commands/gate.js');
    gate = cliGate.gate;
  } catch (error) {
    console.warn('Warning: CLI gate not available');
  }
}

async function main(): Promise<void> {
  const options = parseCliArgs();
  
  // Load gate functions
  await loadGateFunctions();
  
  if (options.help) {
    console.log(`
Gate Calibration Benchmark Runner

Usage:
  npx tsx bench/corpus/runner.ts [options]

Options:
  --threshold <score>  Gate threshold to test (default: 70)
  --verbose, -v        Show detailed per-fixture results
  --json, -j           Output JSON metrics
  --tune, -t           Auto-tune thresholds to hit targets
  --help, -h           Show this help
`);
    process.exit(0);
  }
  
  const corpusDir = resolve(__dirname);
  const fixtures = await loadCorpus(corpusDir);
  
  if (fixtures.length === 0) {
    console.error('No fixtures found in corpus. Create fixtures in bench/corpus/good/ and bench/corpus/bad/');
    process.exit(1);
  }
  
  let threshold = options.threshold ?? 70;
  
  if (options.tune) {
    threshold = await tuneThresholds(fixtures);
    console.log(`\nRecommended threshold: ${threshold}\n`);
  }
  
  const results = await runBenchmark(fixtures, threshold);
  const metrics = calculateMetrics(results);
  
  if (options.json) {
    console.log(JSON.stringify({ threshold, metrics }, null, 2));
  } else {
    printMetrics(metrics, threshold, options.verbose);
    
    // Check if targets are met
    const fpRate = metrics.good > 0 ? metrics.falsePositives / metrics.good : 0;
    const fnRate = metrics.bad > 0 ? metrics.falseNegatives / metrics.bad : 0;
    
    if (fpRate > 0.05) {
      console.log('⚠️  False positive rate exceeds 5% target');
      process.exit(1);
    }
    
    if (fnRate > 0.10) {
      console.log('⚠️  False negative rate exceeds 10% target');
      process.exit(1);
    }
    
    console.log('✓ All targets met!\n');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
