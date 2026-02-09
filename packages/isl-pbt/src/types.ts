// ============================================================================
// Property-Based Testing Types
// ============================================================================

import type * as AST from '@isl-lang/parser';

// ============================================================================
// RANDOM GENERATION
// ============================================================================

/**
 * Seeded pseudo-random number generator for reproducibility
 */
export interface PRNG {
  /** Generate a random number in [0, 1) */
  random(): number;
  
  /** Generate a random integer in [min, max] */
  int(min: number, max: number): number;
  
  /** Generate a random boolean with given probability of true */
  bool(probability?: number): boolean;
  
  /** Pick a random element from an array */
  pick<T>(array: readonly T[]): T;
  
  /** Shuffle an array */
  shuffle<T>(array: T[]): T[];
  
  /** Get the current seed */
  seed(): number;
  
  /** Fork the PRNG (create a child with new seed) */
  fork(): PRNG;
}

/**
 * Generator for a specific type
 */
export interface Generator<T> {
  /** Generate a random value */
  generate(prng: PRNG, size: number): T;
  
  /** Shrink a value to find minimal failing case */
  shrink(value: T): Iterable<T>;
  
  /** Map the generated value */
  map<U>(fn: (value: T) => U): Generator<U>;
  
  /** Filter generated values */
  filter(predicate: (value: T) => boolean): Generator<T>;
  
  /** Chain generators */
  flatMap<U>(fn: (value: T) => Generator<U>): Generator<U>;
}

// ============================================================================
// PROPERTY TYPES
// ============================================================================

/**
 * A property is a testable assertion derived from ISL conditions
 */
export interface Property {
  /** Property name (from ISL expression) */
  name: string;
  
  /** Type: precondition, postcondition, or invariant */
  type: 'precondition' | 'postcondition' | 'invariant';
  
  /** The ISL expression */
  expression: AST.Expression;
  
  /** Guard condition (e.g., 'success', 'INVALID_CREDENTIALS') */
  guard?: string;
  
  /** Source location */
  location: AST.SourceLocation;
}

/**
 * Extracted properties from a behavior
 */
export interface BehaviorProperties {
  /** Behavior name */
  behaviorName: string;
  
  /** Domain containing the behavior */
  domain: AST.Domain;
  
  /** Preconditions that inputs must satisfy */
  preconditions: Property[];
  
  /** Postconditions to verify after execution */
  postconditions: Property[];
  
  /** Invariants that must always hold */
  invariants: Property[];
  
  /** Input field specifications */
  inputSpec: InputFieldSpec[];
}

/**
 * Specification for an input field
 */
export interface InputFieldSpec {
  name: string;
  type: AST.TypeDefinition;
  constraints: FieldConstraints;
  optional: boolean;
  sensitive: boolean;
}

/**
 * Constraints extracted from type definition
 */
export interface FieldConstraints {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
  pattern?: RegExp;
  enum?: string[];
  precision?: number;
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

/**
 * Configuration for PBT runner
 */
export interface PBTConfig {
  /** Number of test iterations */
  numTests: number;
  
  /** Initial random seed (for reproducibility) */
  seed?: number;
  
  /** Maximum shrinking iterations */
  maxShrinks: number;
  
  /** Size parameter growth rate */
  sizeGrowth: 'linear' | 'logarithmic';
  
  /** Maximum size parameter */
  maxSize: number;
  
  /** Timeout per test in ms */
  timeout: number;
  
  /** Whether to run precondition filtering */
  filterPreconditions: boolean;
  
  /** Maximum filter attempts before giving up */
  maxFilterAttempts: number;
  
  /** Enable verbose logging */
  verbose: boolean;
}

/**
 * Default PBT configuration
 */
export const DEFAULT_PBT_CONFIG: PBTConfig = {
  numTests: 100,
  maxShrinks: 100,
  sizeGrowth: 'linear',
  maxSize: 100,
  timeout: 5000,
  filterPreconditions: true,
  maxFilterAttempts: 1000,
  verbose: false,
};

/**
 * Result of a single test run
 */
export interface TestRun {
  /** Test iteration number */
  iteration: number;
  
  /** Size parameter used */
  size: number;
  
  /** Seed used for this test */
  seed: number;
  
  /** Generated input */
  input: Record<string, unknown>;
  
  /** Whether the test passed */
  passed: boolean;
  
  /** Which property failed (if any) */
  failedProperty?: Property;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Execution duration in ms */
  duration: number;
  
  /** Logs captured during execution */
  logs: LogCapture[];
}

/**
 * Captured log entry
 */
export interface LogCapture {
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  args: unknown[];
  timestamp: number;
}

/**
 * Shrinking result
 */
export interface ShrinkResult {
  /** Original failing input */
  original: Record<string, unknown>;
  
  /** Minimal failing input */
  minimal: Record<string, unknown>;
  
  /** Number of shrink attempts */
  shrinkAttempts: number;
  
  /** Shrinking iterations */
  history: ShrinkStep[];
}

/**
 * A single shrinking step
 */
export interface ShrinkStep {
  input: Record<string, unknown>;
  passed: boolean;
  size: number;
}

/**
 * Final PBT report
 */
export interface PBTReport {
  /** Behavior tested */
  behaviorName: string;
  
  /** Overall result */
  success: boolean;
  
  /** Number of tests run */
  testsRun: number;
  
  /** Number of tests passed */
  testsPassed: number;
  
  /** Configuration used */
  config: PBTConfig;
  
  /** First failure (if any) */
  firstFailure?: TestRun;
  
  /** Shrink result (if there was a failure) */
  shrinkResult?: ShrinkResult;
  
  /** Total duration in ms */
  totalDuration: number;
  
  /** Property violations found */
  violations: PropertyViolation[];
  
  /** Statistics */
  stats: PBTStats;
}

/**
 * A property violation
 */
export interface PropertyViolation {
  property: Property;
  input: Record<string, unknown>;
  minimalInput?: Record<string, unknown>;
  error: string;
}

/**
 * PBT statistics
 */
export interface PBTStats {
  /** Total iterations */
  iterations: number;
  
  /** Successful iterations */
  successes: number;
  
  /** Failed iterations */
  failures: number;
  
  /** Filtered (discarded) iterations */
  filtered: number;
  
  /** Shrink attempts */
  shrinkAttempts: number;
  
  /** Average test duration */
  avgDuration: number;
  
  /** Size distribution */
  sizeDistribution: Map<number, number>;
}

// ============================================================================
// JSON REPORT SCHEMA
// ============================================================================

/**
 * Serializable JSON report for CI/CD integration.
 * Used when --format json is passed to the CLI.
 */
export interface PBTJsonReport {
  /** Schema version for forward-compatibility */
  version: '1.0';

  /** ISO 8601 timestamp of when the report was generated */
  timestamp: string;

  /** Overall pass/fail */
  success: boolean;

  /** Seed used (for reproduction) */
  seed: number;

  /** Summary statistics */
  summary: {
    totalBehaviors: number;
    passedBehaviors: number;
    failedBehaviors: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    duration: number;
  };

  /** Per-behavior results */
  behaviors: Array<{
    name: string;
    success: boolean;
    testsRun: number;
    testsPassed: number;
    duration: number;
    violations: Array<{
      property: string;
      type: 'precondition' | 'postcondition' | 'invariant';
      error: string;
      input?: Record<string, unknown>;
      minimalInput?: Record<string, unknown>;
    }>;
    error?: string;
  }>;

  /** Configuration used */
  config: {
    numTests: number;
    seed?: number;
    maxShrinks: number;
    timeout: number;
  };
}

/**
 * CLI option types for programmatic usage
 */
export interface CLIOptions {
  specFile: string;
  seed?: number;
  numTests?: number;
  maxShrinks?: number;
  timeout?: number;
  behavior?: string;
  format?: 'text' | 'json';
  verbose?: boolean;
  output?: string;
  dryRun?: boolean;
}

// ============================================================================
// LOG INVARIANT TYPES
// ============================================================================

/**
 * PII fields that should never be logged
 */
export interface PIIConfig {
  /** Field names that should never appear in logs */
  forbiddenFields: string[];
  
  /** Patterns to detect (e.g., email regex) */
  patterns: Array<{
    name: string;
    pattern: RegExp;
    replacement: string;
  }>;
}

/**
 * Default PII configuration
 */
export const DEFAULT_PII_CONFIG: PIIConfig = {
  forbiddenFields: [
    'password',
    'password_hash',
    'secret',
    'api_key',
    'access_token',
    'refresh_token',
    'private_key',
    'ssn',
    'credit_card',
    'cvv',
  ],
  patterns: [
    {
      name: 'email',
      pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      replacement: 'REDACTED_EMAIL',
    },
    {
      name: 'ip_address',
      pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      replacement: 'REDACTED_IP',
    },
  ],
};
