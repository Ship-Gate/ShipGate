/**
 * ISL Mutation Testing - Type Definitions
 */

// ============================================================================
// MUTATION TYPES
// ============================================================================

export type MutationType =
  | 'remove-assert'
  | 'change-comparator'
  | 'delete-expectation'
  | 'bypass-precondition';

export interface MutationTarget {
  /** File path relative to fixture */
  file: string;
  /** Line number to mutate (1-based) */
  line: number;
  /** Column to start mutation (optional) */
  column?: number;
  /** Pattern to match for mutation */
  pattern?: string | RegExp;
}

export interface MutationDefinition {
  /** Unique identifier */
  id: string;
  /** Type of mutation */
  type: MutationType;
  /** Description of what this mutation does */
  description: string;
  /** Target location */
  target: MutationTarget;
  /** Expected clause to fail after mutation */
  expectedFailedClause?: string;
  /** Expected score drop (minimum) */
  expectedScoreDrop?: number;
}

// ============================================================================
// MUTATOR INTERFACE
// ============================================================================

export interface MutatorContext {
  /** Original source code */
  source: string;
  /** File path */
  filePath: string;
  /** Mutation target */
  target: MutationTarget;
}

export interface MutationResult {
  /** Whether mutation was applied */
  applied: boolean;
  /** Mutated source code */
  mutatedSource: string;
  /** Description of applied change */
  changeDescription: string;
  /** Line(s) affected */
  affectedLines: number[];
}

export interface Mutator {
  /** Mutation type this mutator handles */
  type: MutationType;
  /** Apply the mutation to source code */
  apply(ctx: MutatorContext): MutationResult;
  /** Check if mutation can be applied */
  canApply(ctx: MutatorContext): boolean;
}

// ============================================================================
// VERIFICATION RESULTS
// ============================================================================

export type VerifyVerdict = 'verified' | 'risky' | 'unsafe';

export interface ClauseResult {
  type: 'precondition' | 'postcondition' | 'invariant';
  name: string;
  expression: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  error?: string;
}

export interface VerificationSnapshot {
  /** Overall success */
  success: boolean;
  /** Verdict */
  verdict: VerifyVerdict;
  /** Numeric score (0-100) */
  score: number;
  /** Precondition results */
  preconditions: ClauseResult[];
  /** Postcondition results */
  postconditions: ClauseResult[];
  /** Invariant results */
  invariants: ClauseResult[];
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// MUTATION TEST RESULTS
// ============================================================================

export type MutationStatus =
  | 'killed'      // Mutation detected (good)
  | 'survived'    // Mutation not detected (bad - verification gap)
  | 'timeout'     // Verification timed out
  | 'error'       // Error during verification
  | 'skipped';    // Mutation could not be applied

export interface MutationTestResult {
  /** Mutation definition */
  mutation: MutationDefinition;
  /** Mutation status */
  status: MutationStatus;
  /** Baseline verification */
  baseline: VerificationSnapshot;
  /** Post-mutation verification */
  mutated?: VerificationSnapshot;
  /** Score difference */
  scoreDrop: number;
  /** Clauses that failed after mutation */
  failedClauses: string[];
  /** Whether expected clause failed */
  expectedClauseDetected: boolean;
  /** Duration in ms */
  durationMs: number;
  /** Error message if any */
  error?: string;
}

// ============================================================================
// FIXTURE CONFIGURATION
// ============================================================================

export interface FixtureConfig {
  /** Fixture name */
  name: string;
  /** ISL spec file */
  specFile: string;
  /** Implementation file */
  implFile: string;
  /** Test file (optional) */
  testFile?: string;
  /** Mutation definitions */
  mutations: MutationDefinition[];
  /** Expected baseline score */
  expectedBaselineScore?: number;
}

export interface FixtureSuite {
  /** Fixture configuration */
  config: FixtureConfig;
  /** Path to fixture directory */
  path: string;
  /** ISL spec content */
  specContent: string;
  /** Implementation content */
  implContent: string;
  /** Test content */
  testContent?: string;
}

// ============================================================================
// HARNESS CONFIGURATION
// ============================================================================

export interface HarnessConfig {
  /** Fixture directories */
  fixturesDir: string;
  /** Output directory for reports */
  outputDir: string;
  /** Timeout for verification (ms) */
  verifyTimeout: number;
  /** Whether to run in verbose mode */
  verbose: boolean;
  /** Stop on first surviving mutation */
  bailOnSurvivor: boolean;
  /** Only run specific mutations */
  mutationFilter?: MutationType[];
  /** Only run specific fixtures */
  fixtureFilter?: string[];
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export interface MutationReport {
  /** Run timestamp */
  timestamp: string;
  /** Total fixtures */
  totalFixtures: number;
  /** Total mutations */
  totalMutations: number;
  /** Killed mutations */
  killed: number;
  /** Survived mutations */
  survived: number;
  /** Mutation score (killed / total) */
  mutationScore: number;
  /** Per-fixture results */
  fixtures: FixtureReport[];
  /** Duration */
  durationMs: number;
}

export interface FixtureReport {
  /** Fixture name */
  name: string;
  /** Baseline score */
  baselineScore: number;
  /** Baseline verdict */
  baselineVerdict: VerifyVerdict;
  /** Mutation results */
  mutations: MutationTestResult[];
  /** Summary */
  summary: {
    total: number;
    killed: number;
    survived: number;
    errors: number;
  };
}
