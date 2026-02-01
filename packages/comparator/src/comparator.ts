/**
 * Main Comparison Logic
 * 
 * Orchestrates comparison across multiple implementations.
 */

import type { DomainDeclaration } from '@intentos/isl-core';
import {
  checkAllEquivalence,
  type EquivalenceResult,
  type EquivalenceOptions,
  type ExecutionResult,
} from './equivalence.js';
import {
  benchmark,
  calculateMetrics,
  comparePerformance,
  type PerformanceResult,
  type PerformanceOptions,
  type PerformanceMetrics,
} from './performance.js';
import {
  compareCoverage,
  calculateCoverage,
  analyzeCoverageGaps,
  type CoverageResult,
  type CoverageOptions,
  type TestCaseResult,
  type TestCategory,
} from './coverage.js';
import {
  generateRecommendations,
  generateOverallRecommendation,
  type ComparisonResult,
  type ImplementationInfo,
  type Recommendation,
} from './reporter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single implementation to compare */
export interface Implementation {
  /** Unique name for this implementation */
  name: string;
  /** Version string */
  version?: string;
  /** Source file path */
  source?: string;
  /** The executable function */
  execute: ImplementationFunction;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Function signature for implementations */
export type ImplementationFunction = (input: unknown) => Promise<unknown> | unknown;

/** Test input for comparison */
export interface TestInput {
  /** Input data */
  input: unknown;
  /** Expected output (if known) */
  expectedOutput?: unknown;
  /** Category of this test */
  category?: TestCategory;
  /** Test name */
  name?: string;
}

/** Options for comparison */
export interface CompareOptions {
  /** Options for equivalence checking */
  equivalence?: EquivalenceOptions;
  /** Options for performance benchmarking */
  performance?: PerformanceOptions;
  /** Options for coverage analysis */
  coverage?: CoverageOptions;
  /** Skip equivalence checking */
  skipEquivalence?: boolean;
  /** Skip performance benchmarking */
  skipPerformance?: boolean;
  /** Skip coverage analysis */
  skipCoverage?: boolean;
  /** Timeout per execution in ms */
  timeout?: number;
  /** Progress callback */
  onProgress?: (message: string, progress: number) => void;
}

/** Internal execution context */
interface ExecutionContext {
  implementations: Implementation[];
  inputs: TestInput[];
  options: CompareOptions;
  results: ComparisonData;
}

/** Collected data during comparison */
interface ComparisonData {
  executions: Array<{ input: TestInput; results: Map<string, ExecutionResult> }>;
  testResults: Map<string, TestCaseResult[]>;
  timings: Map<string, number[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a single implementation with a single input
 */
async function executeOne(
  impl: Implementation,
  input: unknown,
  timeout: number
): Promise<ExecutionResult> {
  const start = performance.now();
  
  try {
    const result = await Promise.race([
      Promise.resolve(impl.execute(input)),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Execution timeout')), timeout)
      ),
    ]);
    
    return {
      output: result,
      duration: performance.now() - start,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      duration: performance.now() - start,
    };
  }
}

/**
 * Execute all implementations with a single input
 */
async function executeAll(
  implementations: Implementation[],
  input: unknown,
  timeout: number
): Promise<Map<string, ExecutionResult>> {
  const results = new Map<string, ExecutionResult>();
  
  // Execute all implementations in parallel
  const executions = await Promise.all(
    implementations.map(async (impl) => ({
      name: impl.name,
      result: await executeOne(impl, input, timeout),
    }))
  );
  
  for (const { name, result } of executions) {
    results.set(name, result);
  }
  
  return results;
}

/**
 * Convert execution result to test case result
 */
function toTestCaseResult(
  input: TestInput,
  implName: string,
  result: ExecutionResult
): TestCaseResult {
  let passed = !result.error;
  
  // If expected output is provided, check against it
  if (passed && input.expectedOutput !== undefined) {
    passed = JSON.stringify(result.output) === JSON.stringify(input.expectedOutput);
  }
  
  return {
    name: input.name ?? `Test ${JSON.stringify(input.input).slice(0, 30)}`,
    passed,
    duration: result.duration,
    error: result.error?.message,
    category: input.category ?? 'scenario',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare multiple implementations
 */
export async function compare(
  implementations: Implementation[],
  inputs: TestInput[],
  options: CompareOptions = {}
): Promise<ComparisonResult> {
  const startTime = performance.now();
  const timeout = options.timeout ?? 5000;
  
  const progress = options.onProgress ?? (() => {});
  
  // Initialize data collection
  const data: ComparisonData = {
    executions: [],
    testResults: new Map(),
    timings: new Map(),
  };
  
  // Initialize test results map
  for (const impl of implementations) {
    data.testResults.set(impl.name, []);
    data.timings.set(impl.name, []);
  }
  
  // Execute all inputs
  progress('Running tests...', 0);
  const totalInputs = inputs.length;
  
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    progress(`Testing input ${i + 1}/${totalInputs}`, (i / totalInputs) * 50);
    
    const results = await executeAll(implementations, input.input, timeout);
    data.executions.push({ input, results });
    
    // Collect test results and timings
    for (const impl of implementations) {
      const result = results.get(impl.name);
      if (result) {
        data.testResults.get(impl.name)!.push(toTestCaseResult(input, impl.name, result));
        data.timings.get(impl.name)!.push(result.duration);
      }
    }
  }
  
  // Equivalence check
  progress('Checking equivalence...', 50);
  let equivalence: EquivalenceResult;
  
  if (options.skipEquivalence) {
    equivalence = {
      equivalent: true,
      differences: [],
      inputsCovered: inputs.length,
      inputsMatched: inputs.length,
      equivalenceRate: 100,
      behaviorGroups: [],
    };
  } else {
    equivalence = checkAllEquivalence(
      implementations.map(i => i.name),
      data.executions.map(e => ({ input: e.input.input, results: e.results })),
      options.equivalence
    );
  }
  
  // Performance comparison
  progress('Analyzing performance...', 70);
  let performanceResult: PerformanceResult;
  
  if (options.skipPerformance) {
    const emptyMetrics: PerformanceMetrics = {
      latencyP50: 0, latencyP95: 0, latencyP99: 0,
      latencyMin: 0, latencyMax: 0, latencyMean: 0, latencyStdDev: 0,
      memoryMB: 0, memoryPeakMB: 0, throughputRPS: 0,
      invocations: 0, errors: 0, errorRate: 0,
    };
    performanceResult = {
      byImplementation: new Map(implementations.map(i => [i.name, emptyMetrics])),
      winner: implementations[0]?.name ?? '',
      margin: 0,
      rankings: {
        byLatencyP50: [], byLatencyP99: [], byThroughput: [], byMemory: [], overall: [],
      },
      summary: {
        fastestP50: { name: '', value: 0 },
        fastestP99: { name: '', value: 0 },
        highestThroughput: { name: '', value: 0 },
        lowestMemory: { name: '', value: 0 },
        performanceSpread: 1,
      },
    };
  } else {
    // Calculate metrics from collected timings
    const metricsMap = new Map<string, PerformanceMetrics>();
    for (const impl of implementations) {
      const timings = data.timings.get(impl.name)!;
      const timingData = timings.map(duration => ({ duration, error: false }));
      metricsMap.set(impl.name, calculateMetrics(timingData));
    }
    performanceResult = comparePerformance(metricsMap, options.performance);
  }
  
  // Coverage comparison
  progress('Analyzing coverage...', 85);
  let coverageResult: CoverageResult;
  
  if (options.skipCoverage) {
    coverageResult = {
      byImplementation: new Map(),
      universalPasses: [],
      universalFailures: [],
      divergentTests: [],
      comparison: {
        bestCoverage: { name: '', passRate: 100 },
        worstCoverage: { name: '', passRate: 100 },
        averagePassRate: 100,
        mostDivergentCategories: [],
        consensusTests: 0,
        totalUniqueTests: 0,
      },
    };
  } else {
    coverageResult = compareCoverage(data.testResults, options.coverage);
  }
  
  // Generate recommendations
  progress('Generating recommendations...', 95);
  const gaps = analyzeCoverageGaps(coverageResult, options.coverage);
  const recommendations = generateRecommendations(equivalence, performanceResult, coverageResult, gaps);
  const recommendation = generateOverallRecommendation(recommendations, equivalence, performanceResult, coverageResult);
  
  // Build implementation info
  const implementationInfos: ImplementationInfo[] = implementations.map(impl => ({
    name: impl.name,
    version: impl.version,
    source: impl.source,
  }));
  
  const duration = performance.now() - startTime;
  progress('Complete', 100);
  
  return {
    implementations: implementationInfos,
    equivalence,
    performance: performanceResult,
    coverage: coverageResult,
    recommendation,
    recommendations,
    timestamp: new Date(),
    duration,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quick comparison of two implementations
 */
export async function quickCompare(
  impl1: ImplementationFunction,
  impl2: ImplementationFunction,
  inputs: unknown[],
  options: CompareOptions = {}
): Promise<ComparisonResult> {
  const implementations: Implementation[] = [
    { name: 'Implementation A', execute: impl1 },
    { name: 'Implementation B', execute: impl2 },
  ];
  
  const testInputs: TestInput[] = inputs.map((input, i) => ({
    input,
    name: `Input ${i + 1}`,
    category: 'scenario' as TestCategory,
  }));
  
  return compare(implementations, testInputs, options);
}

/**
 * Compare with a reference implementation
 */
export async function compareWithReference(
  reference: Implementation,
  candidates: Implementation[],
  inputs: TestInput[],
  options: CompareOptions = {}
): Promise<ComparisonResult> {
  // Run comparison with reference first
  const implementations = [reference, ...candidates];
  const result = await compare(implementations, inputs, options);
  
  // Adjust recommendations to prefer reference if equivalent
  const adjustedRecommendations: Recommendation[] = [];
  
  // Check if all candidates are equivalent to reference
  const allEquivalent = result.equivalence.equivalent;
  
  if (allEquivalent) {
    // Find best performing candidate
    const candidateNames = candidates.map(c => c.name);
    const candidatePerformance = Array.from(result.performance.byImplementation.entries())
      .filter(([name]) => candidateNames.includes(name))
      .sort((a, b) => a[1].latencyP50 - b[1].latencyP50);
    
    if (candidatePerformance.length > 0) {
      const [bestCandidate, bestMetrics] = candidatePerformance[0];
      const referenceMetrics = result.performance.byImplementation.get(reference.name);
      
      if (referenceMetrics && bestMetrics.latencyP50 < referenceMetrics.latencyP50 * 0.9) {
        adjustedRecommendations.push({
          type: 'use',
          implementation: bestCandidate,
          reason: `10%+ faster than reference with equivalent behavior`,
          priority: 'high',
        });
      }
    }
  }
  
  return {
    ...result,
    recommendations: [...adjustedRecommendations, ...result.recommendations],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ComparisonResult,
  ImplementationInfo,
  Recommendation,
} from './reporter.js';
