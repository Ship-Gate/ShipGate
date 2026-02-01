/**
 * Mutation Test Runner
 * 
 * Runs tests against each mutant to determine if tests catch the mutation.
 */

import {
  Mutant,
  MutantStatus,
  MutationConfig,
  MutationResult,
  TestResult,
} from './types';
import { applyMutant, revertMutant } from './mutator';

/**
 * Run mutation tests
 */
export class MutationRunner {
  private config: MutationConfig;
  private testRunner: TestRunnerFn;
  private sourceLoader: SourceLoaderFn;

  constructor(
    config: Partial<MutationConfig>,
    options: {
      testRunner: TestRunnerFn;
      sourceLoader: SourceLoaderFn;
    }
  ) {
    this.config = {
      files: [],
      timeout: 30000,
      parallel: true,
      workers: 4,
      ...config,
    };
    this.testRunner = options.testRunner;
    this.sourceLoader = options.sourceLoader;
  }

  /**
   * Run tests against all mutants
   */
  async runAll(mutants: Mutant[]): Promise<MutationResult[]> {
    const results: MutationResult[] = [];

    if (this.config.parallel) {
      // Run in parallel batches
      const batches = this.createBatches(mutants, this.config.workers || 4);
      
      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map((mutant) => this.runMutant(mutant))
        );
        results.push(...batchResults);
      }
    } else {
      // Run sequentially
      for (const mutant of mutants) {
        const result = await this.runMutant(mutant);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Run tests against a single mutant
   */
  async runMutant(mutant: Mutant): Promise<MutationResult> {
    const startTime = Date.now();
    
    try {
      // Load original source
      const originalSource = await this.sourceLoader(mutant.location.file);
      
      // Apply mutation
      const mutatedSource = applyMutant(originalSource, mutant);
      
      // Run tests with timeout
      const testResults = await this.runTestsWithTimeout(
        mutatedSource,
        mutant.location.file,
        this.config.timeout || 30000
      );
      
      // Analyze results
      const status = this.determineStatus(testResults);
      const killedBy = testResults.find((t) => !t.passed);

      // Update mutant status
      mutant.status = status;
      if (killedBy) {
        mutant.killedBy = killedBy.name;
      }

      return {
        mutant,
        status,
        testsRun: testResults.length,
        testsPassed: testResults.filter((t) => t.passed).length,
        testsFailed: testResults.filter((t) => !t.passed).length,
        duration: Date.now() - startTime,
        killedBy: killedBy,
      };
    } catch (error) {
      mutant.status = 'error';
      
      return {
        mutant,
        status: 'error',
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run tests with a timeout
   */
  private async runTestsWithTimeout(
    mutatedSource: string,
    file: string,
    timeout: number
  ): Promise<TestResult[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Test timeout'));
      }, timeout);

      this.testRunner(mutatedSource, file)
        .then((results) => {
          clearTimeout(timer);
          resolve(results);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Determine mutant status from test results
   */
  private determineStatus(testResults: TestResult[]): MutantStatus {
    if (testResults.length === 0) {
      return 'survived'; // No tests = survived
    }

    const anyFailed = testResults.some((t) => !t.passed);
    
    if (anyFailed) {
      return 'killed'; // At least one test caught the mutation
    }
    
    return 'survived'; // All tests passed = mutation not caught
  }

  /**
   * Create batches for parallel execution
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }
}

/**
 * Simple mutation test runner function
 */
export async function runMutations(
  mutants: Mutant[],
  options: {
    testRunner: TestRunnerFn;
    sourceLoader: SourceLoaderFn;
    config?: Partial<MutationConfig>;
  }
): Promise<MutationResult[]> {
  const runner = new MutationRunner(options.config || {}, {
    testRunner: options.testRunner,
    sourceLoader: options.sourceLoader,
  });

  return runner.runAll(mutants);
}

/**
 * Function type for running tests
 */
export type TestRunnerFn = (
  source: string,
  file: string
) => Promise<TestResult[]>;

/**
 * Function type for loading source files
 */
export type SourceLoaderFn = (file: string) => Promise<string>;

/**
 * Create a simple file-based source loader
 */
export function createFileLoader(fs: {
  readFile: (path: string) => Promise<string>;
}): SourceLoaderFn {
  return async (file: string) => {
    return fs.readFile(file);
  };
}

/**
 * Create a vitest-compatible test runner
 */
export function createVitestRunner(vitest: {
  run: (files: string[], options?: { inline?: boolean }) => Promise<{
    results: Array<{
      name: string;
      file: string;
      status: 'pass' | 'fail';
      duration: number;
      error?: string;
    }>;
  }>;
}): TestRunnerFn {
  return async (source: string, file: string) => {
    // In real implementation, would inject source and run tests
    const result = await vitest.run([file], { inline: true });
    
    return result.results.map((r) => ({
      name: r.name,
      file: r.file,
      passed: r.status === 'pass',
      duration: r.duration,
      error: r.error,
    }));
  };
}

/**
 * Progress callback for mutation testing
 */
export interface MutationProgress {
  total: number;
  completed: number;
  killed: number;
  survived: number;
  currentMutant: Mutant | null;
}

/**
 * Runner with progress reporting
 */
export class MutationRunnerWithProgress extends MutationRunner {
  private onProgress?: (progress: MutationProgress) => void;

  setProgressCallback(callback: (progress: MutationProgress) => void): void {
    this.onProgress = callback;
  }

  async runAll(mutants: Mutant[]): Promise<MutationResult[]> {
    const results: MutationResult[] = [];
    let killed = 0;
    let survived = 0;

    for (let i = 0; i < mutants.length; i++) {
      const mutant = mutants[i];
      
      // Report progress
      if (this.onProgress) {
        this.onProgress({
          total: mutants.length,
          completed: i,
          killed,
          survived,
          currentMutant: mutant,
        });
      }

      const result = await this.runMutant(mutant);
      results.push(result);

      if (result.status === 'killed') {
        killed++;
      } else if (result.status === 'survived') {
        survived++;
      }
    }

    // Final progress report
    if (this.onProgress) {
      this.onProgress({
        total: mutants.length,
        completed: mutants.length,
        killed,
        survived,
        currentMutant: null,
      });
    }

    return results;
  }
}
