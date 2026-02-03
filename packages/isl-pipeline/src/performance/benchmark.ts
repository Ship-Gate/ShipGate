/**
 * Performance Benchmarking Infrastructure
 * 
 * Measures:
 * - parse/check time
 * - gate time
 * - heal iterations time
 * 
 * @module @isl-lang/pipeline/performance
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parseISL, type DomainDeclaration } from '@isl-lang/isl-core';
import { runSemanticRules, type SemanticViolation } from '../semantic-rules.js';
import { SemanticHealer, type SemanticHealResult } from '../semantic-healer.js';
import type { RepoContext } from '@isl-lang/translator';

// ============================================================================
// Types
// ============================================================================

export interface BenchmarkResult {
  repoSize: RepoSize;
  metrics: {
    parseCheckTime: number; // ms
    gateTime: number; // ms
    healIterationsTime: number; // ms
    totalTime: number; // ms
    memoryUsed: number; // MB
    iterations: number;
  };
  breakdown: {
    parseTime: number;
    checkTime: number;
    gateViolations: number;
    healIterations: number;
  };
}

export type RepoSize = 'small' | 'medium' | 'large';

export interface BenchmarkConfig {
  repoSize: RepoSize;
  iterations: number;
  warmupRuns: number;
  outputDir?: string;
}

export interface PerformanceMetrics {
  parseTime: number;
  checkTime: number;
  gateTime: number;
  healIterations: Array<{ iteration: number; duration: number }>;
  memoryBefore: number;
  memoryAfter: number;
}

// ============================================================================
// Repo Size Definitions
// ============================================================================

const REPO_SIZE_CONFIGS: Record<RepoSize, { files: number; linesPerFile: number; violations: number }> = {
  small: {
    files: 5,
    linesPerFile: 50,
    violations: 3,
  },
  medium: {
    files: 20,
    linesPerFile: 150,
    violations: 10,
  },
  large: {
    files: 50,
    linesPerFile: 300,
    violations: 25,
  },
};

// ============================================================================
// Benchmark Runner
// ============================================================================

export class PerformanceBenchmark {
  private config: BenchmarkConfig;

  constructor(config: BenchmarkConfig) {
    this.config = config;
  }

  /**
   * Run benchmark for a specific repo size
   */
  async run(): Promise<BenchmarkResult> {
    const { repoSize } = this.config;
    const sizeConfig = REPO_SIZE_CONFIGS[repoSize];

    // Generate test fixtures
    const fixtures = await this.generateFixtures(sizeConfig);

    // Warmup runs
    for (let i = 0; i < this.config.warmupRuns; i++) {
      await this.runSingleBenchmark(fixtures);
    }

    // Actual benchmark runs
    const results: PerformanceMetrics[] = [];
    for (let i = 0; i < this.config.iterations; i++) {
      const result = await this.runSingleBenchmark(fixtures);
      results.push(result);
    }

    // Calculate averages
    const avg = this.calculateAverages(results);

    return {
      repoSize,
      metrics: {
        parseCheckTime: avg.parseTime + avg.checkTime,
        gateTime: avg.gateTime,
        healIterationsTime: avg.healIterations.reduce((sum, it) => sum + it.duration, 0),
        totalTime: avg.parseTime + avg.checkTime + avg.gateTime + avg.healIterations.reduce((sum, it) => sum + it.duration, 0),
        memoryUsed: avg.memoryAfter - avg.memoryBefore,
        iterations: avg.healIterations.length,
      },
      breakdown: {
        parseTime: avg.parseTime,
        checkTime: avg.checkTime,
        gateViolations: 0, // Would need to track this
        healIterations: avg.healIterations.length,
      },
    };
  }

  /**
   * Run a single benchmark iteration
   */
  private async runSingleBenchmark(fixtures: TestFixtures): Promise<PerformanceMetrics> {
    const memoryBefore = this.getMemoryUsage();

    // 1. Parse/Check
    const parseStart = Date.now();
    const { domain: ast, errors: parseErrors } = parseISL(fixtures.islSpec, 'test.isl');
    const parseTime = Date.now() - parseStart;

    const checkStart = Date.now();
    // Type checking would happen here
    const checkTime = Date.now() - checkStart;

    // 2. Gate (semantic rules)
    const gateStart = performance.now();
    const violations = runSemanticRules(fixtures.codeMap);
    const gateTime = performance.now() - gateStart;

    // 3. Heal iterations
    const healIterations: Array<{ iteration: number; duration: number }> = [];
    
    if (violations.length > 0) {
      const repoContext: RepoContext = {
        framework: 'nextjs',
        validationLib: 'zod',
        routingStyle: 'file-based',
        conventions: { apiPrefix: '/api' },
      };

      const healer = new SemanticHealer(ast, repoContext, fixtures.codeMap, {
        maxIterations: 5, // Limit for benchmarking
        verbose: false,
      });

      const healStart = Date.now();
      const healResult = await healer.heal();
      const healTotalTime = Date.now() - healStart;

      // Extract iteration times from history
      for (const iter of healResult.history) {
        healIterations.push({
          iteration: iter.iteration,
          duration: iter.duration,
        });
      }
    }

    const memoryAfter = this.getMemoryUsage();

    return {
      parseTime,
      checkTime,
      gateTime,
      healIterations,
      memoryBefore,
      memoryAfter,
    };
  }

  /**
   * Calculate averages from multiple runs
   */
  private calculateAverages(results: PerformanceMetrics[]): PerformanceMetrics {
    const avg: PerformanceMetrics = {
      parseTime: 0,
      checkTime: 0,
      gateTime: 0,
      healIterations: [],
      memoryBefore: 0,
      memoryAfter: 0,
    };

    for (const result of results) {
      avg.parseTime += result.parseTime;
      avg.checkTime += result.checkTime;
      avg.gateTime += result.gateTime;
      avg.memoryBefore += result.memoryBefore;
      avg.memoryAfter += result.memoryAfter;
    }

    const count = results.length;
    avg.parseTime /= count;
    avg.checkTime /= count;
    avg.gateTime /= count;
    avg.memoryBefore /= count;
    avg.memoryAfter /= count;

    // Average heal iterations (take max length and average)
    const maxIterations = Math.max(...results.map(r => r.healIterations.length));
    for (let i = 0; i < maxIterations; i++) {
      const durations = results
        .map(r => r.healIterations[i]?.duration || 0)
        .filter(d => d > 0);
      if (durations.length > 0) {
        avg.healIterations.push({
          iteration: i + 1,
          duration: durations.reduce((a, b) => a + b, 0) / durations.length,
        });
      }
    }

    return avg;
  }

  /**
   * Generate test fixtures for benchmarking
   */
  private async generateFixtures(config: typeof REPO_SIZE_CONFIGS[RepoSize]): Promise<TestFixtures> {
    // Generate ISL spec
    const islSpec = this.generateISLSpec(config);

    // Generate code files
    const codeMap = new Map<string, string>();
    for (let i = 0; i < config.files; i++) {
      const fileName = `route-${i}.ts`;
      const code = this.generateCodeFile(config.linesPerFile, config.violations);
      codeMap.set(fileName, code);
    }

    return { islSpec, codeMap };
  }

  /**
   * Generate a simple ISL spec
   */
  private generateISLSpec(config: typeof REPO_SIZE_CONFIGS[RepoSize]): string {
    const behaviors = Array.from({ length: Math.min(config.files, 10) }, (_, i) => `behavior UserAction${i} {
  intents {
    rate-limit-required
    audit-required
    input-validation
  }
}`).join('\n\n');

    return `domain TestDomain {
  version: "1.0.0"
  
  ${behaviors}
}`;
  }

  /**
   * Generate a code file with violations
   */
  private generateCodeFile(lines: number, violations: number): string {
    const linesArray: string[] = [];
    
    // Add imports
    linesArray.push("import { NextResponse } from 'next/server';");
    linesArray.push("");

    // Add function
    linesArray.push("export async function POST(request: Request) {");
    
    // Add some code with violations
    const violationLines = Math.floor(lines * 0.3);
    for (let i = 0; i < violationLines; i++) {
      if (i % 5 === 0 && violations > 0) {
        linesArray.push("  console.log('Debug info'); // Violation: console.log");
        violations--;
      } else {
        linesArray.push(`  // Line ${i}`);
      }
    }

    linesArray.push("  return NextResponse.json({ success: true });");
    linesArray.push("}");

    return linesArray.join('\n');
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024;
    }
    return 0;
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

interface TestFixtures {
  islSpec: string;
  codeMap: Map<string, string>;
}

// ============================================================================
// Benchmark Suite Runner
// ============================================================================

export async function runBenchmarkSuite(config?: Partial<BenchmarkConfig>): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (const repoSize of ['small', 'medium', 'large'] as RepoSize[]) {
    const benchmark = new PerformanceBenchmark({
      repoSize,
      iterations: config?.iterations || 5,
      warmupRuns: config?.warmupRuns || 2,
      outputDir: config?.outputDir,
    });

    const result = await benchmark.run();
    results.push(result);
  }

  return results;
}
