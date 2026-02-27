// ============================================================================
// Fuzzer Type Definitions
// ============================================================================

/**
 * Fuzzing context passed to generators
 */
export interface FuzzContext {
  /** Random number generator (seeded for reproducibility) */
  rng?: () => number;
  
  /** Number of iterations for random generation */
  iterations?: number;
  
  /** Field name being fuzzed */
  fieldName?: string;
  
  /** Field type being fuzzed */
  fieldType?: string;
  
  /** Type constraints from ISL */
  constraints?: Record<string, unknown>;
  
  /** Include security/injection payloads */
  includeSecurityPayloads?: boolean;
  
  /** Type registry for reference resolution */
  typeRegistry?: Map<string, ISLTypeInfo>;
  
  /** Seed for reproducibility */
  seed?: string;
}

/**
 * Generated fuzz value with metadata
 */
export interface GeneratedValue<T> {
  /** The fuzzed value */
  value: T;
  
  /** Category of fuzz (boundary, injection, random, etc.) */
  category: FuzzCategory;
  
  /** Human-readable description */
  description: string;
}

/**
 * Categories of fuzz values
 */
export type FuzzCategory =
  | 'boundary'      // Boundary values (min, max, etc.)
  | 'injection'     // Security injection payloads
  | 'random'        // Random values
  | 'mutation'      // Mutated valid values
  | 'stress'        // Stress testing (large values)
  | 'special'       // Special characters
  | 'unicode'       // Unicode edge cases
  | 'format'        // Format violations
  | 'structure'     // Structural edge cases
  | 'security'      // Security-related
  | 'type-coercion' // Type coercion issues
  | 'valid'         // Valid values
  | 'invalid'       // Invalid values
  | 'missing'       // Missing required values
  | 'extra'         // Extra unexpected values
  | 'mixed'         // Mixed valid/invalid
  | 'case'          // Case sensitivity
  | 'precision'     // Precision issues
  | 'index'         // Index-related
  | 'arithmetic'    // Arithmetic edge cases
  | 'unknown';      // Unknown category

/**
 * ISL type information for semantic fuzzing
 */
export interface ISLTypeInfo {
  kind: string;
  name?: string;
  baseType?: string;
  constraints?: Record<string, unknown>;
  variants?: string[];
  element?: ISLTypeInfo;
  key?: ISLTypeInfo;
  value?: ISLTypeInfo;
  inner?: ISLTypeInfo;
  referenceName?: string;
  fields?: ISLFieldInfo[];
}

/**
 * ISL field information
 */
export interface ISLFieldInfo {
  name: string;
  type: ISLTypeInfo;
  optional: boolean;
  constraints?: Record<string, unknown>;
  annotations?: string[];
}

/**
 * ISL behavior information for input fuzzing
 */
export interface ISLBehaviorInfo {
  name: string;
  inputFields: ISLFieldInfo[];
  outputType?: ISLTypeInfo;
  errors?: ISLErrorInfo[];
  preconditions?: string[];
  postconditions?: string[];
}

/**
 * ISL error information
 */
export interface ISLErrorInfo {
  name: string;
  when?: string;
  retriable: boolean;
}

/**
 * Fuzzing configuration
 */
export interface FuzzConfig {
  /** Seed for reproducibility */
  seed?: string;
  
  /** Maximum number of iterations */
  maxIterations?: number;
  
  /** Timeout per input in milliseconds */
  inputTimeout?: number;
  
  /** Overall timeout in milliseconds */
  totalTimeout?: number;
  
  /** Maximum corpus size */
  maxCorpusSize?: number;
  
  /** Include security payloads */
  includeSecurityPayloads?: boolean;
  
  /** Strategies to use */
  strategies?: FuzzStrategy[];
  
  /** Coverage tracking */
  trackCoverage?: boolean;
  
  /** Minimize crashes */
  minimizeCrashes?: boolean;
  
  /** Output directory for results */
  outputDir?: string;
}

/**
 * Fuzzing strategy
 */
export type FuzzStrategy = 
  | 'random'
  | 'boundary'
  | 'mutation'
  | 'coverage'
  | 'semantic';

/**
 * Target function to fuzz
 */
export type FuzzTarget<T, R> = (input: T) => R | Promise<R>;

/**
 * Fuzzing result
 */
export interface FuzzResult {
  /** Duration in milliseconds */
  duration: number;
  
  /** Number of iterations */
  iterations: number;
  
  /** Crashes found */
  crashes: Crash[];
  
  /** Hangs found */
  hangs: Hang[];
  
  /** Coverage information */
  coverage: CoverageInfo;
  
  /** Corpus statistics */
  corpus: CorpusStats;
  
  /** Seed used (for reproduction) */
  seed: string;
  
  /** Configuration used */
  config: FuzzConfig;
}

/**
 * Crash information
 */
export interface Crash {
  /** The input that caused the crash */
  input: unknown;
  
  /** Error message */
  error: string;
  
  /** Stack trace */
  stack: string;
  
  /** Minimized input (if minimization was performed) */
  minimized?: unknown;
  
  /** Category of crash */
  category: CrashCategory;
  
  /** Whether the crash is reproducible */
  reproducible: boolean;
  
  /** Unique identifier for deduplication */
  uniqueId: string;
  
  /** Timestamp when found */
  timestamp: number;
  
  /** Fuzz category that triggered the crash */
  fuzzCategory: FuzzCategory;
  
  /** Number of times this crash was seen */
  count: number;
}

/**
 * Crash categories
 */
export type CrashCategory =
  | 'exception'   // Uncaught exception
  | 'assertion'   // Assertion failure
  | 'timeout'     // Execution timeout
  | 'oom'         // Out of memory
  | 'hang'        // Infinite loop detected
  | 'security';   // Security violation

/**
 * Hang information
 */
export interface Hang {
  /** The input that caused the hang */
  input: unknown;
  
  /** Duration before timeout */
  duration: number;
  
  /** Whether it was killed or timed out */
  killed: boolean;
  
  /** Unique identifier */
  uniqueId: string;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * Coverage information
 */
export interface CoverageInfo {
  /** Total branches */
  totalBranches: number;
  
  /** Covered branches */
  coveredBranches: number;
  
  /** Coverage percentage */
  percentage: number;
  
  /** New branches discovered */
  newBranches: number;
  
  /** Coverage map (for detailed analysis) */
  coverageMap?: Map<string, number>;
}

/**
 * Corpus statistics
 */
export interface CorpusStats {
  /** Total corpus size */
  size: number;
  
  /** Inputs that increased coverage */
  coverageIncreasing: number;
  
  /** Inputs by category */
  byCategory: Record<FuzzCategory, number>;
  
  /** Inputs that caused crashes */
  crashInducing: number;
}

/**
 * Corpus entry
 */
export interface CorpusEntry {
  /** The input */
  input: unknown;
  
  /** Fuzz category */
  category: FuzzCategory;
  
  /** Coverage bits hit by this input */
  coverageBits?: Set<string>;
  
  /** Whether this input caused a crash */
  causedCrash: boolean;
  
  /** Energy (for coverage-guided fuzzing) */
  energy: number;
  
  /** Number of times used for mutation */
  mutationCount: number;
  
  /** Timestamp added */
  addedAt: number;
}

/**
 * Minimization result
 */
export interface MinimizeResult {
  /** Original input */
  original: unknown;
  
  /** Minimized input */
  minimized: unknown;
  
  /** Reduction percentage */
  reductionPercent: number;
  
  /** Number of minimization steps */
  steps: number;
}

/**
 * Report format
 */
export interface FuzzReport {
  /** Summary */
  summary: ReportSummary;
  
  /** Crashes */
  crashes: CrashReport[];
  
  /** Hangs */
  hangs: HangReport[];
  
  /** Coverage details */
  coverage: CoverageReport;
  
  /** Recommendations */
  recommendations: string[];
}

/**
 * Report summary
 */
export interface ReportSummary {
  targetName: string;
  duration: number;
  iterations: number;
  crashCount: number;
  hangCount: number;
  coveragePercent: number;
  seed: string;
  timestamp: string;
}

/**
 * Crash report entry
 */
export interface CrashReport {
  id: string;
  category: CrashCategory;
  error: string;
  input: string; // JSON stringified
  minimizedInput?: string;
  stack: string;
  reproducible: boolean;
  fuzzCategory: FuzzCategory;
  recommendation: string;
}

/**
 * Hang report entry
 */
export interface HangReport {
  id: string;
  input: string;
  duration: number;
}

/**
 * Coverage report
 */
export interface CoverageReport {
  percentage: number;
  totalBranches: number;
  coveredBranches: number;
  uncoveredAreas: string[];
}

/**
 * Create a seeded random number generator
 */
export function createRng(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return function(): number {
    hash = Math.imul(hash ^ (hash >>> 15), hash | 1);
    hash ^= hash + Math.imul(hash ^ (hash >>> 7), hash | 61);
    return ((hash ^ (hash >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a unique ID from a crash
 */
export function generateCrashId(error: string, stack: string): string {
  // Simple hash based on error message and first stack frame
  const firstFrame = stack.split('\n')[1] ?? '';
  const key = `${error}:${firstFrame}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `crash_${Math.abs(hash).toString(16)}`;
}
