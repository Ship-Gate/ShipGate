/**
 * Mutation Testing Types
 */

/** Types of mutations that can be applied */
export type MutationType =
  | 'arithmetic'      // +, -, *, /
  | 'comparison'      // ==, !=, <, >, <=, >=
  | 'logical'         // and, or, not, implies
  | 'boundary'        // min, max, length ±1
  | 'null'            // optional handling
  | 'temporal'        // timing changes
  | 'precondition'    // remove/negate preconditions
  | 'postcondition'   // remove/change postconditions
  | 'invariant'       // remove/change invariants
  | 'error'           // error handling changes
  | 'constraint'      // type constraint changes
  | 'lifecycle';      // state transition changes

/** Status of a mutant after testing */
export type MutantStatus =
  | 'pending'         // Not yet tested
  | 'killed'          // Test caught the mutation (good!)
  | 'survived'        // Test missed the mutation (bad!)
  | 'timeout'         // Test timed out
  | 'error'           // Error running test
  | 'equivalent';     // Functionally equivalent (can't be killed)

/** A single mutant */
export interface Mutant {
  /** Unique identifier */
  id: string;
  
  /** Type of mutation */
  type: MutationType;
  
  /** Location in source */
  location: MutantLocation;
  
  /** Original code/value */
  original: string;
  
  /** Mutated code/value */
  mutated: string;
  
  /** Human-readable description */
  description: string;
  
  /** Current status */
  status: MutantStatus;
  
  /** Test that killed this mutant (if killed) */
  killedBy?: string;
  
  /** Time to run tests against this mutant */
  testDuration?: number;
}

/** Location of a mutation */
export interface MutantLocation {
  /** File path */
  file: string;
  
  /** Start line (1-indexed) */
  startLine: number;
  
  /** End line (1-indexed) */
  endLine: number;
  
  /** Start column (0-indexed) */
  startColumn: number;
  
  /** End column (0-indexed) */
  endColumn: number;
  
  /** AST node path */
  nodePath?: string[];
}

/** Result of running a single mutant */
export interface MutationResult {
  /** The mutant */
  mutant: Mutant;
  
  /** Final status */
  status: MutantStatus;
  
  /** Tests run */
  testsRun: number;
  
  /** Tests passed (should be 0 for killed mutant) */
  testsPassed: number;
  
  /** Tests failed */
  testsFailed: number;
  
  /** Duration in milliseconds */
  duration: number;
  
  /** Error message if any */
  error?: string;
  
  /** Test that killed mutant */
  killedBy?: TestResult;
}

/** Individual test result */
export interface TestResult {
  /** Test name */
  name: string;
  
  /** Test file */
  file: string;
  
  /** Passed or failed */
  passed: boolean;
  
  /** Duration */
  duration: number;
  
  /** Error if failed */
  error?: string;
}

/** Complete mutation testing report */
export interface MutationReport {
  /** Overall mutation score (0-100) */
  score: number;
  
  /** Total mutants generated */
  totalMutants: number;
  
  /** Mutants killed by tests */
  killed: number;
  
  /** Mutants that survived (tests missed) */
  survived: number;
  
  /** Mutants that timed out */
  timeout: number;
  
  /** Mutants with errors */
  errors: number;
  
  /** Equivalent mutants (can't be killed) */
  equivalent: number;
  
  /** Breakdown by mutation type */
  byType: Record<MutationType, TypeBreakdown>;
  
  /** Breakdown by file */
  byFile: Record<string, FileBreakdown>;
  
  /** All mutants */
  mutants: Mutant[];
  
  /** Surviving mutants (need attention) */
  survivors: Mutant[];
  
  /** Test duration */
  duration: number;
  
  /** Timestamp */
  timestamp: Date;
}

/** Breakdown for a mutation type */
export interface TypeBreakdown {
  total: number;
  killed: number;
  survived: number;
  score: number;
}

/** Breakdown for a file */
export interface FileBreakdown {
  file: string;
  total: number;
  killed: number;
  survived: number;
  score: number;
  mutants: Mutant[];
}

/** Configuration for mutation testing */
export interface MutationConfig {
  /** Files to mutate (glob patterns) */
  files: string[];
  
  /** Mutation types to apply */
  mutationTypes?: MutationType[];
  
  /** Maximum mutants to generate */
  maxMutants?: number;
  
  /** Test timeout per mutant (ms) */
  timeout?: number;
  
  /** Run tests in parallel */
  parallel?: boolean;
  
  /** Number of parallel workers */
  workers?: number;
  
  /** Minimum mutation score to pass */
  threshold?: number;
  
  /** Report format */
  reportFormat?: 'text' | 'json' | 'html';
  
  /** Output directory for reports */
  outputDir?: string;
  
  /** Exclude patterns */
  exclude?: string[];
  
  /** Only run on changed files */
  incremental?: boolean;
}

/** Analysis of surviving mutants */
export interface SurvivorAnalysis {
  /** The surviving mutant */
  mutant: Mutant;
  
  /** Why this mutant likely survived */
  likelyCause: SurvivorCause;
  
  /** Suggested test to add */
  suggestedTest: string;
  
  /** Test case template */
  testTemplate: string;
  
  /** Priority (1 = highest) */
  priority: number;
  
  /** Related survivors (same area) */
  relatedSurvivors: string[];
}

/** Likely causes for mutant survival */
export type SurvivorCause =
  | 'missing_test'           // No test covers this case
  | 'weak_assertion'         // Test exists but assertion is weak
  | 'boundary_not_tested'    // Boundary values not tested
  | 'error_path_not_tested'  // Error handling not tested
  | 'equivalent_mutant'      // Mutation doesn't change behavior
  | 'complex_condition';     // Condition needs multiple tests

/** Operator for mutations */
export interface MutationOperator {
  /** Operator name */
  name: string;
  
  /** Mutation type */
  type: MutationType;
  
  /** Check if operator applies to node */
  canApply: (node: unknown) => boolean;
  
  /** Generate mutants for node */
  apply: (node: unknown) => MutantCandidate[];
}

/** Candidate mutant before running */
export interface MutantCandidate {
  /** Type of mutation */
  type: MutationType;
  
  /** Original value */
  original: string;
  
  /** Mutated value */
  mutated: string;
  
  /** Description */
  description: string;
  
  /** Location info */
  location: Partial<MutantLocation>;
}
