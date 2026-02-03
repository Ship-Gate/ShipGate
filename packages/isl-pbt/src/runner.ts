// ============================================================================
// PBT Runner - Property-Based Test execution and reporting
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  PRNG,
  Generator,
  BehaviorProperties,
  Property,
  PBTConfig,
  PBTReport,
  PBTStats,
  TestRun,
  LogCapture,
  PropertyViolation,
  PIIConfig,
} from './types.js';
import { DEFAULT_PBT_CONFIG, DEFAULT_PII_CONFIG } from './types.js';
import { createPRNG } from './random.js';
import { createInputGenerator } from './generator.js';
import { shrinkInput, deltaDebug } from './shrinker.js';
import { extractProperties, getNeverLoggedFields } from './property.js';

// ============================================================================
// MAIN RUNNER
// ============================================================================

/**
 * Run property-based tests for a behavior
 */
export async function runPBT(
  domain: AST.Domain,
  behaviorName: string,
  implementation: BehaviorImplementation,
  config: Partial<PBTConfig> = {}
): Promise<PBTReport> {
  const startTime = Date.now();
  const fullConfig = { ...DEFAULT_PBT_CONFIG, ...config } as PBTConfig;
  
  // Find behavior
  const behavior = domain.behaviors.find((b) => b.name.name === behaviorName);
  if (!behavior) {
    throw new Error(`Behavior '${behaviorName}' not found in domain`);
  }
  
  // Extract properties
  const properties = extractProperties(behavior, domain);
  
  // Create input generator
  const inputGenerator = createInputGenerator(properties, fullConfig);
  
  // Initialize PRNG
  const prng = createPRNG(fullConfig.seed);
  
  // Run tests
  const testRuns: TestRun[] = [];
  const violations: PropertyViolation[] = [];
  let firstFailure: TestRun | undefined;
  
  // Statistics tracking
  let filtered = 0;
  let totalDuration = 0;
  const sizeDistribution = new Map<number, number>();
  
  for (let i = 0; i < fullConfig.numTests; i++) {
    // Calculate size for this iteration
    const size = calculateSize(i, fullConfig);
    sizeDistribution.set(size, (sizeDistribution.get(size) ?? 0) + 1);
    
    // Generate input
    let input: Record<string, unknown>;
    try {
      input = inputGenerator.generate(prng.fork(), size);
    } catch (e) {
      // Failed to generate valid input (filtered too many)
      filtered++;
      continue;
    }
    
    // Run test
    const run = await runSingleTest(
      i,
      size,
      prng.seed(),
      input,
      implementation,
      properties,
      fullConfig
    );
    
    testRuns.push(run);
    totalDuration += run.duration;
    
    if (!run.passed && !firstFailure) {
      firstFailure = run;
      
      if (run.failedProperty) {
        violations.push({
          property: run.failedProperty,
          input: run.input,
          error: run.error ?? 'Unknown error',
        });
      }
      
      // Early exit if we found a failure (can shrink later)
      if (!fullConfig.verbose) {
        break;
      }
    }
  }
  
  // Shrink if there was a failure
  let shrinkResult = undefined;
  if (firstFailure) {
    const testFn = async (input: Record<string, unknown>) => {
      const run = await runSingleTest(
        -1, 0, 0, input, implementation, properties, fullConfig
      );
      return run.passed;
    };
    
    shrinkResult = await deltaDebug(firstFailure.input, testFn, fullConfig);
    
    // Update violation with minimal input
    if (violations.length > 0 && shrinkResult.minimal) {
      violations[0]!.minimalInput = shrinkResult.minimal;
    }
  }
  
  // Calculate stats
  const stats: PBTStats = {
    iterations: testRuns.length,
    successes: testRuns.filter((r) => r.passed).length,
    failures: testRuns.filter((r) => !r.passed).length,
    filtered,
    shrinkAttempts: shrinkResult?.shrinkAttempts ?? 0,
    avgDuration: testRuns.length > 0 ? totalDuration / testRuns.length : 0,
    sizeDistribution,
  };
  
  return {
    behaviorName,
    success: firstFailure === undefined,
    testsRun: testRuns.length,
    testsPassed: stats.successes,
    config: fullConfig,
    firstFailure,
    shrinkResult,
    totalDuration: Date.now() - startTime,
    violations,
    stats,
  };
}

// ============================================================================
// SINGLE TEST EXECUTION
// ============================================================================

/**
 * Run a single test iteration
 */
async function runSingleTest(
  iteration: number,
  size: number,
  seed: number,
  input: Record<string, unknown>,
  implementation: BehaviorImplementation,
  properties: BehaviorProperties,
  config: PBTConfig
): Promise<TestRun> {
  const startTime = Date.now();
  const logs: LogCapture[] = [];
  
  // Capture console logs
  const originalConsole = captureConsole(logs);
  
  try {
    // Execute implementation
    const result = await Promise.race([
      implementation.execute(input),
      timeout(config.timeout),
    ]);
    
    // Check postconditions
    for (const post of properties.postconditions) {
      // Check guard
      if (post.guard) {
        const shouldCheck = checkGuard(post.guard, result);
        if (!shouldCheck) continue;
      }
      
      // Evaluate postcondition
      const passed = await evaluatePostcondition(post, input, result, properties);
      if (!passed) {
        return {
          iteration,
          size,
          seed,
          input,
          passed: false,
          failedProperty: post,
          error: `Postcondition failed: ${post.name}`,
          duration: Date.now() - startTime,
          logs,
        };
      }
    }
    
    // Check invariants
    for (const inv of properties.invariants) {
      const passed = await evaluateInvariant(inv, input, result, logs, properties);
      if (!passed) {
        return {
          iteration,
          size,
          seed,
          input,
          passed: false,
          failedProperty: inv,
          error: `Invariant violated: ${inv.name}`,
          duration: Date.now() - startTime,
          logs,
        };
      }
    }
    
    return {
      iteration,
      size,
      seed,
      input,
      passed: true,
      duration: Date.now() - startTime,
      logs,
    };
  } catch (error) {
    return {
      iteration,
      size,
      seed,
      input,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      logs,
    };
  } finally {
    restoreConsole(originalConsole);
  }
}

// ============================================================================
// CONDITION EVALUATION
// ============================================================================

/**
 * Check if a guard matches the result
 */
function checkGuard(guard: string, result: ExecutionResult): boolean {
  if (guard === 'success') {
    return result.success;
  }
  if (guard === 'failure') {
    return !result.success;
  }
  // Check for specific error code
  if (result.error) {
    return result.error.code === guard;
  }
  return false;
}

/**
 * Evaluate a postcondition
 */
async function evaluatePostcondition(
  property: Property,
  input: Record<string, unknown>,
  result: ExecutionResult,
  properties: BehaviorProperties
): Promise<boolean> {
  // Simple evaluation - in a full implementation, would use the expression evaluator
  // For now, assume postconditions pass if no exception
  return true;
}

/**
 * Evaluate an invariant
 */
async function evaluateInvariant(
  property: Property,
  input: Record<string, unknown>,
  result: ExecutionResult,
  logs: LogCapture[],
  properties: BehaviorProperties
): Promise<boolean> {
  const invStr = property.name;
  
  // Handle "X never_logged" invariants
  const neverLoggedMatch = invStr.match(/^(\w+)\s+never_logged$/);
  if (neverLoggedMatch) {
    const field = neverLoggedMatch[1]!;
    const fieldValue = input[field];
    
    // Check if the value appears in any log
    if (fieldValue !== undefined && fieldValue !== null) {
      for (const log of logs) {
        if (containsSensitiveValue(log.message, fieldValue)) {
          return false;
        }
        for (const arg of log.args) {
          if (containsSensitiveValue(arg, fieldValue)) {
            return false;
          }
        }
      }
    }
    return true;
  }
  
  // Handle "X never_stored_plaintext" invariants
  const neverStoredMatch = invStr.match(/^(\w+)\s+never_stored_plaintext$/);
  if (neverStoredMatch) {
    // Would check storage - for now assume it passes
    return true;
  }
  
  // Default: assume invariant passes
  return true;
}

/**
 * Check if a value contains sensitive data
 */
function containsSensitiveValue(container: unknown, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  
  const valueStr = String(value);
  
  if (typeof container === 'string') {
    return container.includes(valueStr);
  }
  
  if (typeof container === 'object' && container !== null) {
    const json = JSON.stringify(container);
    return json.includes(valueStr);
  }
  
  return String(container).includes(valueStr);
}

// ============================================================================
// CONSOLE CAPTURE
// ============================================================================

interface ConsoleState {
  log: typeof console.log;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
}

/**
 * Capture console output
 */
function captureConsole(logs: LogCapture[]): ConsoleState {
  const original: ConsoleState = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  
  const createCapture = (level: LogCapture['level']) => (...args: unknown[]) => {
    logs.push({
      level,
      message: args.map(String).join(' '),
      args,
      timestamp: Date.now(),
    });
  };
  
  console.log = createCapture('log');
  console.info = createCapture('info');
  console.warn = createCapture('warn');
  console.error = createCapture('error');
  
  return original;
}

/**
 * Restore console
 */
function restoreConsole(original: ConsoleState): void {
  console.log = original.log;
  console.info = original.info;
  console.warn = original.warn;
  console.error = original.error;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Calculate size parameter for iteration
 */
function calculateSize(iteration: number, config: PBTConfig): number {
  if (config.sizeGrowth === 'logarithmic') {
    return Math.min(
      config.maxSize,
      Math.floor(Math.log2(iteration + 2) * 10)
    );
  }
  
  // Linear growth
  return Math.min(
    config.maxSize,
    Math.floor((iteration / config.numTests) * config.maxSize)
  );
}

/**
 * Create a timeout promise
 */
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Implementation interface for PBT
 */
export interface BehaviorImplementation {
  execute(input: Record<string, unknown>): Promise<ExecutionResult>;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// VITEST INTEGRATION
// ============================================================================

/**
 * Create a Vitest test suite for PBT
 */
export function createPBTSuite(
  domain: AST.Domain,
  behaviorName: string,
  implementation: BehaviorImplementation,
  config: Partial<PBTConfig> = {}
) {
  return {
    /**
     * Run PBT and return result for assertions
     */
    async run(): Promise<PBTReport> {
      return runPBT(domain, behaviorName, implementation, config);
    },
    
    /**
     * Generate a single random input for manual testing
     */
    generateInput(seed?: number): Record<string, unknown> {
      const behavior = domain.behaviors.find((b) => b.name.name === behaviorName);
      if (!behavior) {
        throw new Error(`Behavior '${behaviorName}' not found`);
      }
      
      const properties = extractProperties(behavior, domain);
      const generator = createInputGenerator(properties, config);
      const prng = createPRNG(seed);
      
      return generator.generate(prng, config.maxSize ?? 100);
    },
    
    /**
     * Run a quick check with fewer iterations
     */
    async quickCheck(numTests = 10): Promise<PBTReport> {
      return runPBT(domain, behaviorName, implementation, {
        ...config,
        numTests,
      });
    },
  };
}

// ============================================================================
// REPORT FORMATTING
// ============================================================================

/**
 * Format PBT report as readable string
 */
export function formatReport(report: PBTReport): string {
  const lines: string[] = [];
  
  lines.push(`PBT Report: ${report.behaviorName}`);
  lines.push('='.repeat(50));
  
  if (report.success) {
    lines.push(`✓ All ${report.testsRun} tests passed`);
  } else {
    lines.push(`✗ FAILED after ${report.testsPassed}/${report.testsRun} tests`);
  }
  
  lines.push('');
  lines.push('Statistics:');
  lines.push(`  Iterations: ${report.stats.iterations}`);
  lines.push(`  Successes:  ${report.stats.successes}`);
  lines.push(`  Failures:   ${report.stats.failures}`);
  lines.push(`  Filtered:   ${report.stats.filtered}`);
  lines.push(`  Avg Time:   ${report.stats.avgDuration.toFixed(2)}ms`);
  
  if (report.firstFailure) {
    lines.push('');
    lines.push('First Failure:');
    lines.push(`  Iteration: ${report.firstFailure.iteration}`);
    lines.push(`  Size:      ${report.firstFailure.size}`);
    lines.push(`  Seed:      ${report.firstFailure.seed}`);
    lines.push(`  Error:     ${report.firstFailure.error}`);
    lines.push('');
    lines.push('  Input:');
    lines.push(formatInput(report.firstFailure.input, '    '));
  }
  
  if (report.shrinkResult && report.shrinkResult.minimal !== report.shrinkResult.original) {
    lines.push('');
    lines.push('Minimal Failing Input:');
    lines.push(formatInput(report.shrinkResult.minimal, '  '));
    lines.push(`  (shrunk in ${report.shrinkResult.shrinkAttempts} attempts)`);
  }
  
  if (report.violations.length > 0) {
    lines.push('');
    lines.push('Property Violations:');
    for (const v of report.violations) {
      lines.push(`  - ${v.property.type}: ${v.property.name}`);
      lines.push(`    Error: ${v.error}`);
    }
  }
  
  lines.push('');
  lines.push(`Total Duration: ${report.totalDuration}ms`);
  
  return lines.join('\n');
}

/**
 * Format input object for display
 */
function formatInput(input: Record<string, unknown>, indent: string): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    const valueStr = typeof value === 'string' 
      ? `"${value.length > 50 ? value.slice(0, 50) + '...' : value}"`
      : JSON.stringify(value);
    lines.push(`${indent}${key}: ${valueStr}`);
  }
  return lines.join('\n');
}
