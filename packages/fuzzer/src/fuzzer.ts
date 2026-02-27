// ============================================================================
// Main Fuzzing Engine
// Orchestrates fuzzing strategies and manages execution
// ============================================================================

import {
  FuzzConfig,
  FuzzResult,
  FuzzTarget,
  FuzzContext,
  FuzzCategory,
  Crash,
  Hang,
  CrashCategory,
  CoverageInfo,
  GeneratedValue,
  ISLTypeInfo,
  ISLBehaviorInfo,
  createRng,
  generateCrashId,
} from './types.js';
import { Corpus } from './corpus.js';
import { minimize } from './minimizer.js';
// reporter.js imports available for future use
import { generateRandom } from './strategies/random.js';
import { generateBoundaryValues } from './strategies/boundary.js';
import { generateMutations } from './strategies/mutation.js';
import { 
  generateCoverageGuided, 
  createCoverageState, 
  simulateCoverage,
  type CoverageState,
} from './strategies/coverage.js';
import { generateForType, generateBehaviorInputs } from './generators/semantic.js';

/**
 * Main fuzzer class
 */
export class Fuzzer<T = unknown, R = unknown> {
  private config: FuzzConfig;
  private corpus: Corpus;
  private crashes: Map<string, Crash> = new Map();
  private hangs: Map<string, Hang> = new Map();
  private coverageState: CoverageState;
  private rng: () => number;
  private startTime: number = 0;
  private iterations: number = 0;

  constructor(config: FuzzConfig = {}) {
    this.config = {
      maxIterations: 10000,
      inputTimeout: 5000,
      totalTimeout: 60000,
      maxCorpusSize: 10000,
      includeSecurityPayloads: true,
      strategies: ['boundary', 'random', 'mutation'],
      trackCoverage: true,
      minimizeCrashes: true,
      ...config,
    };

    this.corpus = new Corpus({
      maxSize: this.config.maxCorpusSize,
      seed: this.config.seed,
    });

    this.rng = createRng(this.config.seed ?? Date.now().toString());
    this.coverageState = createCoverageState();
  }

  /**
   * Run fuzzing against a target function
   */
  async fuzz(target: FuzzTarget<T, R>): Promise<FuzzResult> {
    this.startTime = Date.now();
    this.iterations = 0;
    this.crashes.clear();
    this.hangs.clear();

    const ctx: FuzzContext = {
      rng: this.rng,
      iterations: this.config.maxIterations,
      includeSecurityPayloads: this.config.includeSecurityPayloads,
    };

    // Run fuzzing strategies
    for (const strategy of this.config.strategies ?? []) {
      if (this.shouldStop()) break;

      switch (strategy) {
        case 'boundary':
          await this.runGenerator(
            generateBoundaryValues({ kind: 'PrimitiveType', name: 'String' }, ctx),
            target
          );
          break;

        case 'random':
          await this.runGenerator(
            generateRandom(ctx),
            target
          );
          break;

        case 'mutation':
          await this.runGenerator(
            generateMutations(this.corpus.getAll(), ctx),
            target
          );
          break;

        case 'coverage':
          await this.runGenerator(
            generateCoverageGuided(this.corpus.getAll(), this.coverageState, ctx),
            target
          );
          break;
      }
    }

    // Minimize crashes if configured
    if (this.config.minimizeCrashes) {
      await this.minimizeCrashes(target);
    }

    return this.buildResult();
  }

  /**
   * Fuzz with ISL type information
   */
  async fuzzType(
    typeInfo: ISLTypeInfo,
    target: FuzzTarget<T, R>
  ): Promise<FuzzResult> {
    this.startTime = Date.now();
    this.iterations = 0;
    this.crashes.clear();
    this.hangs.clear();

    const ctx: FuzzContext = {
      rng: this.rng,
      iterations: this.config.maxIterations,
      includeSecurityPayloads: this.config.includeSecurityPayloads,
      constraints: typeInfo.constraints,
    };

    // Generate type-specific inputs
    await this.runGenerator(generateForType(typeInfo, ctx), target);

    // Run boundary strategy with type constraints
    await this.runGenerator(generateBoundaryValues(typeInfo, ctx), target);

    // Run mutations
    await this.runGenerator(
      generateMutations(this.corpus.getAll(), ctx),
      target
    );

    if (this.config.minimizeCrashes) {
      await this.minimizeCrashes(target);
    }

    return this.buildResult();
  }

  /**
   * Fuzz ISL behavior inputs
   */
  async fuzzBehavior(
    behavior: ISLBehaviorInfo,
    target: FuzzTarget<Record<string, unknown>, R>
  ): Promise<FuzzResult> {
    this.startTime = Date.now();
    this.iterations = 0;
    this.crashes.clear();
    this.hangs.clear();

    const ctx: FuzzContext = {
      rng: this.rng,
      iterations: this.config.maxIterations,
      includeSecurityPayloads: this.config.includeSecurityPayloads,
    };

    // Generate behavior-specific inputs
    await this.runGenerator(
      generateBehaviorInputs(behavior, ctx) as Generator<GeneratedValue<T>>,
      target as FuzzTarget<T, R>
    );

    // Run mutations on corpus
    await this.runGenerator(
      generateMutations(this.corpus.getAll(), ctx),
      target as FuzzTarget<T, R>
    );

    if (this.config.minimizeCrashes) {
      await this.minimizeCrashes(target as FuzzTarget<T, R>);
    }

    return this.buildResult();
  }

  /**
   * Add seed inputs to corpus
   */
  addSeeds(seeds: T[]): void {
    for (const seed of seeds) {
      this.corpus.add(seed, 'valid');
    }
  }

  /**
   * Run a generator and test each input
   */
  private async runGenerator(
    generator: Generator<GeneratedValue<unknown>>,
    target: FuzzTarget<T, R>
  ): Promise<void> {
    for (const generated of generator) {
      if (this.shouldStop()) break;

      await this.testInput(
        generated.value as T,
        generated.category,
        generated.description,
        target
      );
    }
  }

  /**
   * Test a single input
   */
  private async testInput(
    input: T,
    category: FuzzCategory,
    _description: string,
    target: FuzzTarget<T, R>
  ): Promise<void> {
    this.iterations++;

    // Simulate coverage (in real implementation, this would use instrumentation)
    const coverageBits = this.config.trackCoverage 
      ? simulateCoverage(input) 
      : undefined;

    try {
      // Run with timeout
      await this.runWithTimeout(
        () => target(input),
        this.config.inputTimeout ?? 5000
      );

      // Success - add to corpus if it provides new coverage
      this.corpus.add(input, category, coverageBits, false);

    } catch (error) {
      // Crash detected
      this.recordCrash(input, error, category);
      this.corpus.add(input, category, coverageBits, true);
    }
  }

  /**
   * Run a function with timeout
   */
  private async runWithTimeout<R>(
    fn: () => R | Promise<R>,
    timeout: number
  ): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout'));
      }, timeout);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Record a crash
   */
  private recordCrash(
    input: T,
    error: unknown,
    fuzzCategory: FuzzCategory
  ): Crash {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? '' : '';
    const uniqueId = generateCrashId(errorMessage, stack);
    const category = this.categorizeCrash(error, errorMessage);

    // Check if we've seen this crash before
    const existing = this.crashes.get(uniqueId);
    if (existing) {
      existing.count++;
      return existing;
    }

    const crash: Crash = {
      input,
      error: errorMessage,
      stack,
      category,
      reproducible: true,
      uniqueId,
      timestamp: Date.now(),
      fuzzCategory,
      count: 1,
    };

    this.crashes.set(uniqueId, crash);
    return crash;
  }

  /**
   * Categorize a crash
   */
  private categorizeCrash(_error: unknown, message: string): CrashCategory {
    if (message.includes('Timeout')) return 'timeout';
    if (message.includes('heap') || message.includes('memory')) return 'oom';
    if (message.includes('assert') || message.includes('Assert')) return 'assertion';
    if (
      message.includes('injection') ||
      message.includes('XSS') ||
      message.includes('SQL')
    ) {
      return 'security';
    }
    return 'exception';
  }

  /**
   * Minimize all crashes
   */
  private async minimizeCrashes(target: FuzzTarget<T, R>): Promise<void> {
    for (const [, crash] of this.crashes) {
      try {
        const result = await minimize(
          crash.input as T,
          target,
          { maxSteps: 50, verifyFirst: true }
        );
        crash.minimized = result.minimized;
      } catch {
        // Minimization failed, keep original
      }
    }
  }

  /**
   * Check if fuzzing should stop
   */
  private shouldStop(): boolean {
    const elapsed = Date.now() - this.startTime;
    
    if (elapsed >= (this.config.totalTimeout ?? 60000)) {
      return true;
    }
    
    if (this.iterations >= (this.config.maxIterations ?? 10000)) {
      return true;
    }

    return false;
  }

  /**
   * Build final result
   */
  private buildResult(): FuzzResult {
    const duration = Date.now() - this.startTime;
    const corpusStats = this.corpus.getStats();

    const coverage: CoverageInfo = {
      totalBranches: 100, // Simulated
      coveredBranches: this.coverageState.discoveredBranches.size,
      percentage: this.coverageState.discoveredBranches.size, // Simulated percentage
      newBranches: this.coverageState.discoveredBranches.size,
      coverageMap: this.coverageState.branchHitCounts,
    };

    return {
      duration,
      iterations: this.iterations,
      crashes: Array.from(this.crashes.values()),
      hangs: Array.from(this.hangs.values()),
      coverage,
      corpus: corpusStats,
      seed: this.config.seed ?? 'random',
      config: this.config,
    };
  }
}

/**
 * Simple fuzz function for quick usage
 */
export async function fuzz<T, R>(
  target: FuzzTarget<T, R>,
  options: FuzzConfig = {}
): Promise<FuzzResult> {
  const fuzzer = new Fuzzer<T, R>(options);
  return fuzzer.fuzz(target);
}

/**
 * Fuzz with type information
 */
export async function fuzzWithType<T, R>(
  target: FuzzTarget<T, R>,
  typeInfo: ISLTypeInfo,
  options: FuzzConfig = {}
): Promise<FuzzResult> {
  const fuzzer = new Fuzzer<T, R>(options);
  return fuzzer.fuzzType(typeInfo, target);
}

/**
 * Fuzz a behavior
 */
export async function fuzzBehavior<R>(
  target: FuzzTarget<Record<string, unknown>, R>,
  behavior: ISLBehaviorInfo,
  options: FuzzConfig = {}
): Promise<FuzzResult> {
  const fuzzer = new Fuzzer<Record<string, unknown>, R>(options);
  return fuzzer.fuzzBehavior(behavior, target);
}
