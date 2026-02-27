// ============================================================================
// Evidence-First Verifier Types
// ============================================================================
// All types designed for deterministic, reproducible verification results
// Zero timestamps, stable ordering, stable identifiers

/**
 * Clause verification status
 * - PASS: All evidence confirms the clause holds
 * - PARTIAL: Some evidence supports, some missing
 * - FAIL: Evidence demonstrates violation
 * - SKIPPED: Clause could not be evaluated (missing bindings)
 */
export type ClauseStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'SKIPPED';

/**
 * Evidence type classification
 */
export type EvidenceKind = 
  | 'test_assertion'      // Test file contains assertion matching clause
  | 'binding_found'       // Implementation binding exists
  | 'binding_missing'     // Expected binding not found
  | 'assertion_pass'      // Assertion executed and passed
  | 'assertion_fail'      // Assertion executed and failed
  | 'invariant_check'     // Invariant verification result
  | 'coverage_data'       // Code coverage information
  | 'static_analysis';    // Static analysis finding

/**
 * Single piece of evidence linking spec to implementation
 */
export interface Evidence {
  /** Stable identifier for this evidence (deterministic) */
  id: string;
  /** Type of evidence */
  kind: EvidenceKind;
  /** Human-readable description */
  description: string;
  /** File path relative to workspace root */
  file: string;
  /** Line number in file (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** End line for range evidence */
  endLine?: number;
  /** End column for range evidence */
  endColumn?: number;
  /** Snippet of relevant code/text */
  snippet?: string;
  /** Additional metadata (must be JSON-serializable, no dates) */
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Result of verifying a single clause from the spec
 */
export interface ClauseResult {
  /** Stable identifier: domain.behavior.clauseType.index */
  clauseId: string;
  /** Type of clause */
  clauseType: 'precondition' | 'postcondition' | 'invariant' | 'security' | 'temporal';
  /** Original expression as string */
  expression: string;
  /** Verification status */
  status: ClauseStatus;
  /** Evidence supporting this result */
  evidence: Evidence[];
  /** Explanation of why this status was determined */
  reason: string;
  /** Confidence score 0-100 (deterministic based on evidence) */
  confidence: number;
}

/**
 * Workspace scan artifacts - what was found in the codebase
 */
export interface WorkspaceScanArtifacts {
  /** Test files found */
  testFiles: TestFileInfo[];
  /** Implementation bindings found */
  bindings: BindingInfo[];
  /** Assertions found in tests */
  assertions: AssertionInfo[];
}

/**
 * Information about a test file
 */
export interface TestFileInfo {
  /** Relative file path */
  path: string;
  /** Test framework detected (vitest, jest, mocha, etc.) */
  framework: string;
  /** Number of test cases */
  testCount: number;
  /** Names of test suites/describes */
  suites: string[];
  /** Names of test cases */
  tests: string[];
}

/**
 * Information about an implementation binding
 */
export interface BindingInfo {
  /** What this binds to (behavior name, entity name, etc.) */
  specRef: string;
  /** Type of binding */
  bindingType: 'function' | 'class' | 'method' | 'handler' | 'route';
  /** File containing the binding */
  file: string;
  /** Line where binding is declared */
  line: number;
  /** Exported name */
  exportName: string;
}

/**
 * Information about an assertion in test code
 */
export interface AssertionInfo {
  /** Test file containing assertion */
  file: string;
  /** Line number of assertion */
  line: number;
  /** Column number */
  column: number;
  /** Assertion function used (expect, assert, etc.) */
  assertFn: string;
  /** Extracted assertion text */
  text: string;
  /** What spec clause this might relate to (heuristic) */
  possibleClauseRef?: string;
}

/**
 * SHIP/NO_SHIP verdict with explanation
 */
export type ShipVerdict = 'SHIP' | 'NO_SHIP';

/**
 * Scoring breakdown for transparency
 */
export interface ScoreBreakdown {
  /** Total score 0-100 */
  total: number;
  /** Precondition coverage score */
  preconditions: number;
  /** Postcondition coverage score */
  postconditions: number;
  /** Invariant coverage score */
  invariants: number;
  /** Security clause coverage */
  security: number;
  /** Binding completeness */
  bindings: number;
  /** Test coverage estimate */
  testCoverage: number;
}

/**
 * Final verification report - fully deterministic
 */
export interface EvidenceReport {
  /** Report format version */
  version: '1.0.0';
  /** Domain name being verified */
  domain: string;
  /** Behavior name (if specific behavior) or '*' for all */
  behavior: string;
  /** Overall verdict */
  verdict: ShipVerdict;
  /** Total score 0-100 */
  score: number;
  /** Detailed score breakdown */
  scoreBreakdown: ScoreBreakdown;
  /** Results for each clause */
  clauseResults: ClauseResult[];
  /** Summary statistics */
  summary: ReportSummary;
  /** Workspace scan artifacts that were used */
  artifacts: WorkspaceScanArtifacts;
  /** Hash of inputs for reproducibility verification */
  inputHash: string;
}

/**
 * Summary statistics for the report
 */
export interface ReportSummary {
  /** Total clauses evaluated */
  totalClauses: number;
  /** Clauses with PASS status */
  passed: number;
  /** Clauses with PARTIAL status */
  partial: number;
  /** Clauses with FAIL status */
  failed: number;
  /** Clauses with SKIPPED status */
  skipped: number;
  /** Total evidence pieces collected */
  evidenceCount: number;
  /** NO_SHIP blocking issues */
  blockingIssues: string[];
}

/**
 * Options for the verification pipeline
 */
export interface VerifyOptions {
  /** Workspace root directory */
  workspaceRoot: string;
  /** Specific behavior to verify (or undefined for all) */
  behavior?: string;
  /** Patterns for test files */
  testPatterns?: string[];
  /** Patterns for implementation files */
  implPatterns?: string[];
  /** Minimum score threshold for SHIP (default: 70 - stable MVP threshold) */
  shipThreshold?: number;
}

/**
 * Spec AST input - simplified for this module
 */
export interface SpecAST {
  domain: string;
  behaviors: BehaviorSpec[];
  invariants: InvariantSpec[];
}

/**
 * Behavior specification
 */
export interface BehaviorSpec {
  name: string;
  preconditions: ClauseSpec[];
  postconditions: ClauseSpec[];
  invariants: ClauseSpec[];
  security: ClauseSpec[];
  temporal: ClauseSpec[];
}

/**
 * Single clause specification
 */
export interface ClauseSpec {
  expression: string;
  condition?: string;
}

/**
 * Domain-level invariant specification
 */
export interface InvariantSpec {
  name: string;
  predicates: string[];
}
