// ============================================================================
// CLI Integration for PBT
// ============================================================================
//
// Provides integration with `isl verify --pbt` command.
// Runs property-based tests against ISL specifications and implementations.
//
// Usage:
//   isl verify --spec auth.isl --impl auth.ts --pbt
//   isl verify --spec auth.isl --impl auth.ts --pbt --pbt-tests 200
//   isl verify --spec auth.isl --impl auth.ts --pbt --pbt-seed 12345
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { PBTConfig, PBTReport, BehaviorProperties } from './types.js';
import { DEFAULT_PBT_CONFIG } from './types.js';
import { runPBT, createPBTSuite, formatReport } from './runner.js';
import type { BehaviorImplementation, ExecutionResult } from './runner.js';
import { extractProperties } from './property.js';
import { createInputGenerator } from './generator.js';
import { shrinkLoginInput } from './precondition-shrinker.js';
import { createPRNG } from './random.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for PBT verification via CLI
 */
export interface PBTVerifyOptions {
  /** Number of test iterations (default: 100) */
  numTests?: number;
  
  /** Random seed for reproducibility */
  seed?: number;
  
  /** Maximum shrinking iterations (default: 100) */
  maxShrinks?: number;
  
  /** Timeout per test in ms (default: 5000) */
  timeout?: number;
  
  /** Enable verbose output */
  verbose?: boolean;
  
  /** Specific behavior to test (default: all behaviors) */
  behavior?: string;
  
  /** Output format */
  format?: 'text' | 'json';
}

/**
 * Result of PBT verification
 */
export interface PBTVerifyResult {
  /** Overall success */
  success: boolean;
  
  /** Results per behavior */
  behaviors: BehaviorPBTResult[];
  
  /** Total duration */
  duration: number;
  
  /** Configuration used */
  config: PBTConfig;
  
  /** Summary statistics */
  summary: {
    totalBehaviors: number;
    passedBehaviors: number;
    failedBehaviors: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
  };
}

/**
 * PBT result for a single behavior
 */
export interface BehaviorPBTResult {
  /** Behavior name */
  behaviorName: string;
  
  /** Whether all tests passed */
  success: boolean;
  
  /** Full PBT report */
  report: PBTReport;
  
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// MAIN VERIFICATION FUNCTION
// ============================================================================

/**
 * Run PBT verification against an ISL domain and implementation
 * 
 * This is the main entry point for CLI integration.
 * It extracts behaviors from the domain, runs property-based tests,
 * and returns aggregated results.
 * 
 * @example
 * ```typescript
 * import { parse } from '@isl-lang/parser';
 * import { runPBTVerification } from '@isl-lang/pbt';
 * 
 * const { domain } = parse(islSource);
 * const result = await runPBTVerification(domain, implementationModule, {
 *   numTests: 100,
 *   seed: 12345,
 *   verbose: true,
 * });
 * 
 * if (result.success) {
 *   console.log('All PBT tests passed!');
 * } else {
 *   console.log('PBT failures:', result.summary.failedTests);
 * }
 * ```
 */
export async function runPBTVerification(
  domain: AST.Domain,
  implementationLoader: (behaviorName: string) => BehaviorImplementation | Promise<BehaviorImplementation>,
  options: PBTVerifyOptions = {}
): Promise<PBTVerifyResult> {
  const startTime = Date.now();
  
  const config: PBTConfig = {
    ...DEFAULT_PBT_CONFIG,
    numTests: options.numTests ?? DEFAULT_PBT_CONFIG.numTests,
    seed: options.seed,
    maxShrinks: options.maxShrinks ?? DEFAULT_PBT_CONFIG.maxShrinks,
    timeout: options.timeout ?? DEFAULT_PBT_CONFIG.timeout,
    verbose: options.verbose ?? false,
  };

  const behaviors = options.behavior
    ? domain.behaviors.filter(b => b.name.name === options.behavior)
    : domain.behaviors;

  if (behaviors.length === 0) {
    return {
      success: false,
      behaviors: [],
      duration: Date.now() - startTime,
      config,
      summary: {
        totalBehaviors: 0,
        passedBehaviors: 0,
        failedBehaviors: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
      },
    };
  }

  const results: BehaviorPBTResult[] = [];
  let totalTests = 0;
  let passedTests = 0;

  for (const behavior of behaviors) {
    try {
      const impl = await implementationLoader(behavior.name.name);
      const report = await runPBT(domain, behavior.name.name, impl, config);

      results.push({
        behaviorName: behavior.name.name,
        success: report.success,
        report,
      });

      totalTests += report.testsRun;
      passedTests += report.testsPassed;

      if (options.verbose) {
        console.log(formatReport(report));
      }
    } catch (error) {
      results.push({
        behaviorName: behavior.name.name,
        success: false,
        report: {
          behaviorName: behavior.name.name,
          success: false,
          testsRun: 0,
          testsPassed: 0,
          config,
          totalDuration: 0,
          violations: [],
          stats: {
            iterations: 0,
            successes: 0,
            failures: 0,
            filtered: 0,
            shrinkAttempts: 0,
            avgDuration: 0,
            sizeDistribution: new Map(),
          },
        },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const passedBehaviors = results.filter(r => r.success).length;
  const failedBehaviors = results.length - passedBehaviors;

  return {
    success: failedBehaviors === 0,
    behaviors: results,
    duration: Date.now() - startTime,
    config,
    summary: {
      totalBehaviors: results.length,
      passedBehaviors,
      failedBehaviors,
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
    },
  };
}

// ============================================================================
// VERIFIER FACTORY
// ============================================================================

/**
 * Create a reusable PBT verifier for a domain
 * 
 * @example
 * ```typescript
 * const verifier = createPBTVerifier(domain, {
 *   numTests: 100,
 *   seed: 12345,
 * });
 * 
 * // Test a specific behavior
 * const result = await verifier.testBehavior('Login', loginImpl);
 * 
 * // Generate inputs for manual testing
 * const inputs = verifier.generateInputs('Login', 10);
 * 
 * // Run all behaviors
 * const fullResult = await verifier.testAll(implLoader);
 * ```
 */
export function createPBTVerifier(
  domain: AST.Domain,
  options: PBTVerifyOptions = {}
) {
  const config: PBTConfig = {
    ...DEFAULT_PBT_CONFIG,
    numTests: options.numTests ?? DEFAULT_PBT_CONFIG.numTests,
    seed: options.seed,
    maxShrinks: options.maxShrinks ?? DEFAULT_PBT_CONFIG.maxShrinks,
    timeout: options.timeout ?? DEFAULT_PBT_CONFIG.timeout,
    verbose: options.verbose ?? false,
  };

  return {
    /**
     * Test a specific behavior
     */
    async testBehavior(
      behaviorName: string,
      implementation: BehaviorImplementation
    ): Promise<PBTReport> {
      return runPBT(domain, behaviorName, implementation, config);
    },

    /**
     * Test all behaviors
     */
    async testAll(
      implementationLoader: (name: string) => BehaviorImplementation | Promise<BehaviorImplementation>
    ): Promise<PBTVerifyResult> {
      return runPBTVerification(domain, implementationLoader, options);
    },

    /**
     * Generate random inputs for a behavior
     */
    generateInputs(
      behaviorName: string,
      count: number,
      seed?: number
    ): Record<string, unknown>[] {
      const behavior = domain.behaviors.find(b => b.name.name === behaviorName);
      if (!behavior) {
        throw new Error(`Behavior '${behaviorName}' not found`);
      }

      const properties = extractProperties(behavior, domain);
      const generator = createInputGenerator(properties, config);
      const prng = createPRNG(seed ?? config.seed);

      const inputs: Record<string, unknown>[] = [];
      for (let i = 0; i < count; i++) {
        inputs.push(generator.generate(prng.fork(), config.maxSize));
      }

      return inputs;
    },

    /**
     * Get extracted properties for a behavior
     */
    getProperties(behaviorName: string): BehaviorProperties {
      const behavior = domain.behaviors.find(b => b.name.name === behaviorName);
      if (!behavior) {
        throw new Error(`Behavior '${behaviorName}' not found`);
      }
      return extractProperties(behavior, domain);
    },

    /**
     * Create a quick check runner
     */
    quickCheck(behaviorName: string, implementation: BehaviorImplementation, numTests = 10) {
      return runPBT(domain, behaviorName, implementation, {
        ...config,
        numTests,
      });
    },
  };
}

// ============================================================================
// RESULT FORMATTING
// ============================================================================

/**
 * Format PBT verification result for CLI output
 */
export function formatPBTResult(result: PBTVerifyResult, format: 'text' | 'json' = 'text'): string {
  if (format === 'json') {
    return JSON.stringify({
      success: result.success,
      summary: result.summary,
      behaviors: result.behaviors.map(b => ({
        name: b.behaviorName,
        success: b.success,
        testsRun: b.report.testsRun,
        testsPassed: b.report.testsPassed,
        violations: b.report.violations.map(v => ({
          property: v.property.name,
          type: v.property.type,
          error: v.error,
        })),
        error: b.error,
      })),
      duration: result.duration,
      config: {
        numTests: result.config.numTests,
        seed: result.config.seed,
        maxShrinks: result.config.maxShrinks,
        timeout: result.config.timeout,
      },
    }, null, 2);
  }

  // Text format
  const lines: string[] = [];
  
  lines.push('');
  lines.push('┌─────────────────────────────────────────────────┐');
  lines.push('│          PROPERTY-BASED TEST RESULTS            │');
  lines.push('└─────────────────────────────────────────────────┘');
  lines.push('');

  // Summary
  const icon = result.success ? '✓' : '✗';
  const status = result.success ? 'PASSED' : 'FAILED';
  lines.push(`${icon} Overall: ${status}`);
  lines.push('');
  lines.push('Summary:');
  lines.push(`  Behaviors:  ${result.summary.passedBehaviors}/${result.summary.totalBehaviors} passed`);
  lines.push(`  Tests:      ${result.summary.passedTests}/${result.summary.totalTests} passed`);
  lines.push(`  Duration:   ${result.duration}ms`);
  
  if (result.config.seed !== undefined) {
    lines.push(`  Seed:       ${result.config.seed}`);
  }

  // Per-behavior results
  lines.push('');
  lines.push('Behaviors:');
  
  for (const behavior of result.behaviors) {
    const bIcon = behavior.success ? '✓' : '✗';
    lines.push(`  ${bIcon} ${behavior.behaviorName}: ${behavior.report.testsPassed}/${behavior.report.testsRun} tests passed`);
    
    if (behavior.error) {
      lines.push(`      Error: ${behavior.error}`);
    }
    
    if (behavior.report.violations.length > 0) {
      for (const v of behavior.report.violations) {
        lines.push(`      Violation: ${v.property.type} "${v.property.name}"`);
        lines.push(`        ${v.error}`);
        if (v.minimalInput) {
          lines.push(`        Minimal input: ${JSON.stringify(v.minimalInput)}`);
        }
      }
    }
  }

  // Reproduction hint
  if (!result.success && result.config.seed !== undefined) {
    lines.push('');
    lines.push('To reproduce:');
    lines.push(`  isl verify --pbt --pbt-seed ${result.config.seed}`);
  }

  lines.push('');
  
  return lines.join('\n');
}

// ============================================================================
// TRACE INTEGRATION
// ============================================================================

/**
 * Create a traced implementation wrapper that emits verification traces
 * for integration with the test-runtime TraceEmitter
 */
export function createTracedImplementation(
  implementation: BehaviorImplementation,
  onTrace?: (trace: PBTTrace) => void
): BehaviorImplementation {
  return {
    async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
      const startTime = Date.now();
      const trace: PBTTrace = {
        type: 'pbt_execution',
        input,
        startTime: new Date().toISOString(),
        preconditionsSatisfied: true, // Assumed - generator ensures this
      };

      try {
        const result = await implementation.execute(input);
        
        trace.endTime = new Date().toISOString();
        trace.duration = Date.now() - startTime;
        trace.result = result;
        trace.success = result.success;
        
        onTrace?.(trace);
        return result;
      } catch (error) {
        trace.endTime = new Date().toISOString();
        trace.duration = Date.now() - startTime;
        trace.error = error instanceof Error ? error.message : String(error);
        trace.success = false;
        
        onTrace?.(trace);
        throw error;
      }
    },
  };
}

/**
 * PBT execution trace
 */
export interface PBTTrace {
  type: 'pbt_execution';
  input: Record<string, unknown>;
  startTime: string;
  endTime?: string;
  duration?: number;
  result?: ExecutionResult;
  error?: string;
  success?: boolean;
  preconditionsSatisfied: boolean;
}
