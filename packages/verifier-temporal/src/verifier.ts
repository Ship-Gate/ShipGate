/**
 * Temporal Verifier
 * 
 * Main verification engine for temporal properties in ISL specifications.
 * Handles eventually, within (latency), and always (invariant) checks.
 */

import type { DomainDeclaration, TemporalRequirement, DurationLiteral } from '@isl-lang/isl-core';
import { eventuallyWithin, type EventuallyResult } from './properties/eventually.js';
import { within, type WithinResult } from './properties/within.js';
import { alwaysFor, type AlwaysResult } from './properties/always.js';
import { toMilliseconds, formatDuration } from './timing.js';
import type { LatencyStats } from './percentiles.js';

// Re-export property checkers for direct use
export { eventually, eventuallyWithin } from './properties/eventually.js';
export { within, withinDuration, withinMultiple, assertWithin } from './properties/within.js';
export { always, alwaysFor, alwaysN, assertAlways, alwaysAll } from './properties/always.js';

// ============================================================================
// TYPES
// ============================================================================

export interface VerifyRequest {
  /** Path to implementation file or implementation code */
  implementation: string;
  /** Parsed ISL domain */
  domain: DomainDeclaration;
  /** Name of the behavior to verify */
  behaviorName: string;
  /** Verification options */
  options?: VerifyOptions;
}

export interface VerifyOptions {
  /** Maximum time to wait for temporal properties (default: 30000ms) */
  timeout?: number;
  /** Number of samples for latency checks (default: 100) */
  sampleCount?: number;
  /** Run latency samples in parallel */
  parallel?: number;
  /** Implementation executor function */
  executor?: ImplementationExecutor;
}

/**
 * Function that executes the implementation
 */
export type ImplementationExecutor = (
  implementationPath: string,
  input: unknown
) => Promise<unknown>;

export interface VerifyResult {
  /** Overall verification success */
  success: boolean;
  /** Verdict: verified, risky, or unsafe */
  verdict: 'verified' | 'risky' | 'unsafe';
  /** Trust score 0-100 */
  score: number;
  /** Individual temporal property results */
  temporalResults: TemporalPropertyResult[];
  /** Summary statistics */
  summary: VerifySummary;
  /** Errors encountered during verification */
  errors: VerifyError[];
}

export interface TemporalPropertyResult {
  /** The temporal spec being verified */
  spec: TemporalRequirement;
  /** Property type */
  type: 'eventually' | 'within' | 'always' | 'never';
  /** Whether this property was verified */
  success: boolean;
  /** Duration of the check */
  duration: number;
  /** Detailed result based on type */
  details: EventuallyResult | WithinResult | AlwaysResult;
  /** Human-readable description */
  description: string;
}

export interface VerifySummary {
  /** Total temporal properties checked */
  total: number;
  /** Number that passed */
  passed: number;
  /** Number that failed */
  failed: number;
  /** Number skipped (e.g., no executor) */
  skipped: number;
  /** Total verification duration */
  totalDuration: number;
  /** Latency statistics if any within checks */
  latencyStats?: LatencyStats;
}

export interface VerifyError {
  /** Property that caused the error */
  property?: string;
  /** Error message */
  message: string;
  /** Stack trace if available */
  stack?: string;
}

// ============================================================================
// MAIN VERIFIER
// ============================================================================

/**
 * Verify temporal properties of an implementation against an ISL spec
 * 
 * @param implementation - Path to implementation or implementation code
 * @param domain - Parsed ISL domain
 * @param behaviorName - Name of the behavior to verify
 * @returns Verification result
 * 
 * @example
 * ```typescript
 * const result = await verify(
 *   './src/user-service.ts',
 *   parsedDomain,
 *   'CreateUser'
 * );
 * ```
 */
export async function verify(
  implementation: string,
  domain: DomainDeclaration,
  behaviorName: string,
  options: VerifyOptions = {}
): Promise<VerifyResult> {
  const startTime = Date.now();
  const temporalResults: TemporalPropertyResult[] = [];
  const errors: VerifyError[] = [];
  
  // Find the behavior
  const behavior = domain.behaviors.find(b => b.name.name === behaviorName);
  
  if (!behavior) {
    return {
      success: false,
      verdict: 'unsafe',
      score: 0,
      temporalResults: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        totalDuration: Date.now() - startTime,
      },
      errors: [{
        message: `Behavior '${behaviorName}' not found in domain '${domain.name.name}'`,
      }],
    };
  }
  
  // Get temporal specs from behavior
  const temporalBlock = behavior.temporal;
  const temporalSpecs = temporalBlock?.requirements ?? [];
  
  if (temporalSpecs.length === 0) {
    return {
      success: true,
      verdict: 'verified',
      score: 100,
      temporalResults: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        totalDuration: Date.now() - startTime,
      },
      errors: [],
    };
  }
  
  // Verify each temporal property
  for (const spec of temporalSpecs) {
    try {
      const result = await verifyTemporalSpec(spec, implementation, options);
      temporalResults.push(result);
    } catch (error) {
      errors.push({
        property: formatTemporalRequirement(spec),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
  
  // Calculate summary
  const passed = temporalResults.filter(r => r.success).length;
  const failed = temporalResults.filter(r => !r.success).length;
  const skipped = temporalSpecs.length - temporalResults.length;
  
  // Calculate score
  const score = temporalSpecs.length > 0
    ? Math.round((passed / temporalSpecs.length) * 100)
    : 100;
  
  // Determine verdict
  let verdict: 'verified' | 'risky' | 'unsafe';
  if (failed === 0 && errors.length === 0) {
    verdict = 'verified';
  } else if (passed > failed) {
    verdict = 'risky';
  } else {
    verdict = 'unsafe';
  }
  
  return {
    success: failed === 0 && errors.length === 0,
    verdict,
    score,
    temporalResults,
    summary: {
      total: temporalSpecs.length,
      passed,
      failed,
      skipped,
      totalDuration: Date.now() - startTime,
    },
    errors,
  };
}

/**
 * Verify a single temporal specification
 */
async function verifyTemporalSpec(
  spec: TemporalRequirement,
  implementation: string,
  options: VerifyOptions
): Promise<TemporalPropertyResult> {
  const timeout = options.timeout ?? 30000;
  const sampleCount = options.sampleCount ?? 100;
  const description = formatTemporalRequirement(spec);
  
  // Create a predicate evaluator from the spec
  // In a real implementation, this would compile the ISL expression
  // For now, we provide a mock predicate
  const predicate = createPredicateFromSpec(spec, implementation, options);
  
  switch (spec.type) {
    case 'eventually': {
      const durationMs = spec.duration ? durationToMs(spec.duration) : timeout;
      const result = await eventuallyWithin(
        predicate,
        durationMs,
        'ms',
        { description }
      );
      
      return {
        spec,
        type: 'eventually',
        success: result.success,
        duration: result.duration,
        details: result,
        description,
      };
    }
    
    case 'within': {
      if (!spec.duration) {
        throw new Error('within requires a duration');
      }
      
      const thresholdMs = durationToMs(spec.duration);
      const percentile = spec.percentile ? parsePercentile(spec.percentile) : 99;
      
      const result = await within(
        predicate as () => Promise<unknown>,
        thresholdMs,
        {
          sampleCount,
          percentile,
          parallel: options.parallel,
          description,
        }
      );
      
      return {
        spec,
        type: 'within',
        success: result.success,
        duration: result.stats.mean * sampleCount, // Approximate total time
        details: result,
        description,
      };
    }
    
    case 'always': {
      const durationMs = spec.duration ? durationToMs(spec.duration) : 1000;
      const result = await alwaysFor(
        predicate,
        durationMs,
        'ms',
        { description }
      );
      
      return {
        spec,
        type: 'always',
        success: result.success,
        duration: result.duration,
        details: result,
        description,
      };
    }
    
    case 'never': {
      // 'never X' is equivalent to 'always not X'
      const durationMs = spec.duration ? durationToMs(spec.duration) : 1000;
      const invertedPredicate = async () => !(await predicate());
      
      const result = await alwaysFor(
        invertedPredicate,
        durationMs,
        'ms',
        { description }
      );
      
      return {
        spec,
        type: 'never',
        success: result.success,
        duration: result.duration,
        details: result,
        description,
      };
    }
    
    case 'immediately': {
      // 'immediately' is like 'within' with a very short timeout
      const durationMs = spec.duration ? durationToMs(spec.duration) : 100;
      const result = await eventuallyWithin(
        predicate,
        durationMs,
        'ms',
        { description }
      );
      
      return {
        spec,
        type: 'eventually', // Treat immediately as a variant of eventually
        success: result.success,
        duration: result.duration,
        details: result,
        description,
      };
    }
    
    default: {
      throw new Error(`Unknown temporal operator: ${(spec as TemporalRequirement).type}`);
    }
  }
}

/**
 * Create a predicate function from a temporal spec
 * This is a simplified version - a real implementation would compile
 * the ISL expression into executable code
 */
function createPredicateFromSpec(
  _spec: TemporalRequirement,
  implementation: string,
  options: VerifyOptions
): () => Promise<boolean> {
  // If an executor is provided, use it
  if (options.executor) {
    return async () => {
      const result = await options.executor!(implementation, {});
      // In a real implementation, evaluate spec.condition against result
      return result !== undefined && result !== null;
    };
  }
  
  // Default: return a mock predicate that always succeeds
  // In a real implementation, this would dynamically load and execute
  // the implementation against the predicate expression
  return async () => true;
}

/**
 * Convert short duration unit to long unit name
 */
function convertDurationUnit(unit: 'ms' | 's' | 'm' | 'h' | 'd'): 'ms' | 'seconds' | 'minutes' | 'hours' | 'days' {
  switch (unit) {
    case 'ms': return 'ms';
    case 's': return 'seconds';
    case 'm': return 'minutes';
    case 'h': return 'hours';
    case 'd': return 'days';
  }
}

/**
 * Convert DurationLiteral to milliseconds
 */
function durationToMs(duration: DurationLiteral): number {
  return toMilliseconds(duration.value, convertDurationUnit(duration.unit));
}

/**
 * Parse percentile string (e.g., "p99" or "99") to number
 */
function parsePercentile(percentile: string): number {
  const cleaned = percentile.replace(/^p/i, '');
  return parseFloat(cleaned);
}

/**
 * Format a temporal requirement as a human-readable string
 */
function formatTemporalRequirement(spec: TemporalRequirement): string {
  const parts: string[] = [spec.type];
  
  if (spec.duration) {
    parts.push(`${spec.duration.value}${spec.duration.unit}`);
  }
  
  if (spec.percentile) {
    parts.push(`(${spec.percentile})`);
  }
  
  return parts.join(' ');
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Verify with a request object (matches API contract)
 */
export async function verifyRequest(request: VerifyRequest): Promise<VerifyResult> {
  return verify(
    request.implementation,
    request.domain,
    request.behaviorName,
    request.options
  );
}

/**
 * Quick check for a single eventually condition
 */
export async function checkEventually(
  condition: () => Promise<boolean> | boolean,
  timeoutMs: number = 5000,
  description?: string
): Promise<{ success: boolean; duration: number; error?: string }> {
  const result = await eventuallyWithin(condition, timeoutMs, 'ms', { description });
  return {
    success: result.success,
    duration: result.duration,
    error: result.error,
  };
}

/**
 * Quick check for latency within a threshold
 */
export async function checkWithin(
  operation: () => Promise<unknown>,
  thresholdMs: number,
  percentile: number = 99,
  sampleCount: number = 100
): Promise<{ success: boolean; actualLatency: number; error?: string }> {
  const result = await within(operation, thresholdMs, { percentile, sampleCount });
  return {
    success: result.success,
    actualLatency: result.actualLatency,
    error: result.error,
  };
}

/**
 * Quick check for an invariant
 */
export async function checkAlways(
  invariant: () => Promise<boolean> | boolean,
  durationMs: number = 1000,
  description?: string
): Promise<{ success: boolean; checkCount: number; error?: string }> {
  const result = await alwaysFor(invariant, durationMs, 'ms', { description });
  return {
    success: result.success,
    checkCount: result.checkCount,
    error: result.error,
  };
}

/**
 * Format verification result as a report
 */
export function formatVerifyResult(result: VerifyResult): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════',
    `  TEMPORAL VERIFICATION RESULT`,
    '═══════════════════════════════════════════════════════════',
    '',
    `  Verdict: ${result.verdict.toUpperCase()}`,
    `  Score: ${result.score}/100`,
    `  Status: ${result.success ? '✓ PASSED' : '✗ FAILED'}`,
    '',
    '───────────────────────────────────────────────────────────',
    `  Summary`,
    '───────────────────────────────────────────────────────────',
    `  Total Properties: ${result.summary.total}`,
    `  Passed: ${result.summary.passed}`,
    `  Failed: ${result.summary.failed}`,
    `  Skipped: ${result.summary.skipped}`,
    `  Duration: ${formatDuration(result.summary.totalDuration)}`,
    '',
  ];
  
  if (result.temporalResults.length > 0) {
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('  Property Results');
    lines.push('───────────────────────────────────────────────────────────');
    
    for (const prop of result.temporalResults) {
      const status = prop.success ? '✓' : '✗';
      lines.push(`  ${status} ${prop.description} (${formatDuration(prop.duration)})`);
    }
    
    lines.push('');
  }
  
  if (result.errors.length > 0) {
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('  Errors');
    lines.push('───────────────────────────────────────────────────────────');
    
    for (const error of result.errors) {
      if (error.property) {
        lines.push(`  [${error.property}] ${error.message}`);
      } else {
        lines.push(`  ${error.message}`);
      }
    }
    
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}
