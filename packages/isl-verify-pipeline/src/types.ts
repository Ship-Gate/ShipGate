/**
 * ISL Verification Pipeline Types
 * 
 * Defines the complete type system for the verification orchestrator including:
 * - Pipeline stages and their configurations
 * - Failure modes and error handling
 * - Tri-state verification verdicts
 * - CI-friendly output formats
 * 
 * @module @isl-lang/verify-pipeline
 */

// ============================================================================
// VERDICTS
// ============================================================================

/**
 * Final pipeline verdict - the overall result of verification
 */
export type PipelineVerdict = 
  | 'PROVEN'           // All postconditions and invariants verified
  | 'INCOMPLETE_PROOF' // Some conditions couldn't be evaluated (missing traces, etc.)
  | 'FAILED';          // At least one condition violated

/**
 * Tri-state evaluation result for individual conditions
 */
export type TriState = true | false | 'unknown';

/**
 * Evaluation status for individual clauses
 */
export type ClauseStatus = 
  | 'proven'      // Clause evaluated to true
  | 'violated'    // Clause evaluated to false
  | 'not_proven'  // Clause couldn't be evaluated (missing data, errors)
  | 'skipped';    // Clause was skipped (e.g., condition not triggered)

// ============================================================================
// PIPELINE STAGES
// ============================================================================

/**
 * Pipeline stage identifiers
 */
export type PipelineStage = 
  | 'setup'                  // Initialize pipeline, load specs
  | 'test_runner'            // Run generated tests
  | 'trace_collector'        // Collect execution traces
  | 'postcondition_evaluator' // Evaluate postconditions (tri-state)
  | 'invariant_checker'      // Check invariants (tri-state)
  | 'smt_checker'            // Optional SMT/formal verification
  | 'proof_bundle'           // Generate proof bundle
  | 'cleanup';               // Cleanup resources

/**
 * Stage execution status
 */
export type StageStatus = 
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped';

/**
 * Result of a pipeline stage execution
 */
export interface StageResult<T = unknown> {
  stage: PipelineStage;
  status: StageStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  output?: T;
  error?: StageError;
}

// ============================================================================
// FAILURE MODES
// ============================================================================

/**
 * Categories of pipeline failures
 */
export type FailureCategory = 
  | 'config_error'           // Invalid configuration
  | 'spec_error'             // ISL spec parsing/validation error
  | 'test_failure'           // Test execution failed
  | 'trace_error'            // Trace collection/parsing error
  | 'evaluation_error'       // Expression evaluation error
  | 'invariant_violation'    // Invariant check failed
  | 'postcondition_violation' // Postcondition check failed
  | 'smt_timeout'            // SMT solver timed out
  | 'smt_unknown'            // SMT solver returned unknown
  | 'internal_error'         // Unexpected internal error
  | 'timeout';               // Pipeline stage timeout

/**
 * Structured error from a pipeline stage
 */
export interface StageError {
  category: FailureCategory;
  code: string;
  message: string;
  stage: PipelineStage;
  details?: Record<string, unknown>;
  recoverable: boolean;
  suggestion?: string;
}

/**
 * Recovery action for a failure
 */
export interface RecoveryAction {
  action: 'retry' | 'skip' | 'abort' | 'fallback';
  reason: string;
  retryAfterMs?: number;
  maxRetries?: number;
}

// ============================================================================
// TEST RUNNER TYPES
// ============================================================================

/**
 * Test framework identifier
 */
export type TestFramework = 'vitest' | 'jest' | 'mocha' | 'node:test';

/**
 * Individual test result
 */
export interface TestCaseResult {
  id: string;
  name: string;
  behavior?: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  durationMs: number;
  error?: {
    message: string;
    stack?: string;
    expected?: unknown;
    actual?: unknown;
  };
  assertions?: Array<{
    name: string;
    passed: boolean;
    message?: string;
  }>;
  /**
   * If true, this test was synthetically generated (not actually executed).
   * Synthetic tests are labeled NON_EVIDENCE and contribute 0 execution credit.
   */
  synthetic?: boolean;
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  name: string;
  tests: TestCaseResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  durationMs: number;
}

/**
 * Complete test runner output
 */
export interface TestRunnerOutput {
  framework: TestFramework;
  suites: TestSuiteResult[];
  summary: {
    totalSuites: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    durationMs: number;
  };
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  /** True when test execution itself failed (Vitest import errors, TS config issues, runtime crashes) */
  executionFailed?: boolean;
  /** Human-readable reason why test execution could not complete */
  executionFailureReason?: string;
}

// ============================================================================
// TRACE TYPES
// ============================================================================

/**
 * Trace event kinds (from isl-trace-format)
 */
export type TraceEventKind = 
  | 'handler_call'
  | 'handler_return'
  | 'handler_error'
  | 'state_change'
  | 'check'
  | 'nested';

/**
 * Trace event structure
 */
export interface TraceEvent {
  time: string;
  kind: TraceEventKind;
  correlationId?: string;
  handler?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
  stateChange?: {
    path: string;
    oldValue: unknown;
    newValue: unknown;
    source?: string;
  };
  check?: {
    expression: string;
    passed: boolean;
    actual?: unknown;
    expected?: unknown;
    category: 'precondition' | 'postcondition' | 'invariant' | 'assertion';
  };
  metadata?: Record<string, unknown>;
  events?: TraceEvent[]; // Nested events
}

/**
 * Complete execution trace
 */
export interface ExecutionTrace {
  id: string;
  name: string;
  domain: string;
  behavior?: string;
  startTime: string;
  endTime?: string;
  correlationId: string;
  events: TraceEvent[];
  initialState?: Record<string, unknown>;
  metadata?: {
    testName?: string;
    scenario?: string;
    implementation?: string;
    version?: string;
    environment?: string;
    passed?: boolean;
    failureIndex?: number;
    duration?: number;
  };
}

/**
 * Trace collector output
 */
export interface TraceCollectorOutput {
  traces: ExecutionTrace[];
  summary: {
    totalTraces: number;
    totalEvents: number;
    behaviors: string[];
    checksPassed: number;
    checksFailed: number;
  };
}

// ============================================================================
// POSTCONDITION EVALUATOR TYPES
// ============================================================================

/**
 * Source location information
 */
export interface SourceLocation {
  file?: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/**
 * Clause evaluation evidence
 */
export interface ClauseEvidence {
  clauseId: string;
  type: 'postcondition' | 'invariant';
  behavior?: string;
  outcome?: string; // 'success', 'error:CODE', etc.
  expression: string;
  sourceLocation?: SourceLocation;
  status: ClauseStatus;
  triStateResult: TriState;
  reason?: string;
  traceSlice?: {
    traceId: string;
    startTime: string;
    endTime: string;
    eventCount: number;
  };
  evaluationDetails?: {
    inputValues?: Record<string, unknown>;
    outputValue?: unknown;
    stateSnapshot?: Record<string, unknown>;
    oldStateSnapshot?: Record<string, unknown>;
  };
}

/**
 * Postcondition evaluator output
 */
export interface PostconditionEvaluatorOutput {
  evidence: ClauseEvidence[];
  summary: {
    totalClauses: number;
    provenClauses: number;
    violatedClauses: number;
    notProvenClauses: number;
    skippedClauses: number;
    coveragePercent: number;
  };
  byBehavior: Record<string, {
    totalClauses: number;
    proven: number;
    violated: number;
    notProven: number;
  }>;
  byOutcome: Record<string, {
    totalClauses: number;
    proven: number;
    violated: number;
    notProven: number;
  }>;
}

// ============================================================================
// INVARIANT CHECKER TYPES
// ============================================================================

/**
 * Invariant scope
 */
export type InvariantScope = 'behavior' | 'domain' | 'entity';

/**
 * Invariant evaluation result
 */
export interface InvariantEvidence extends ClauseEvidence {
  scope: InvariantScope;
  entity?: string;
  entityId?: string;
  checkedAt: 'pre' | 'post' | 'continuous';
}

/**
 * Invariant checker output
 */
export interface InvariantCheckerOutput {
  evidence: InvariantEvidence[];
  summary: {
    totalInvariants: number;
    provenInvariants: number;
    violatedInvariants: number;
    notProvenInvariants: number;
    byScope: Record<InvariantScope, {
      total: number;
      proven: number;
      violated: number;
      notProven: number;
    }>;
  };
}

// ============================================================================
// SMT CHECKER TYPES
// ============================================================================

/**
 * SMT solver result
 */
export type SMTResult = 'sat' | 'unsat' | 'unknown' | 'timeout' | 'error';

/**
 * SMT check result
 */
export interface SMTCheckResult {
  clauseId: string;
  formula: string;
  result: SMTResult;
  durationMs: number;
  model?: Record<string, unknown>;
  counterexample?: Record<string, unknown>;
  reason?: string;
}

/**
 * SMT checker output
 */
export interface SMTCheckerOutput {
  enabled: boolean;
  solver?: string;
  solverVersion?: string;
  results: SMTCheckResult[];
  summary: {
    totalChecks: number;
    proven: number;  // unsat (negation is unsatisfiable = original is always true)
    refuted: number; // sat (found counterexample)
    unknown: number;
    timeout: number;
    error: number;
    totalDurationMs: number;
  };
}

// ============================================================================
// SMT RESOLUTION TYPES (unknown → proved/disproved)
// ============================================================================

/**
 * Evidence from SMT solver execution (pipeline-local, mirrors isl-smt SolverEvidence)
 */
export interface SMTSolverEvidence {
  /** Hash of the SMT query (for caching and reproducibility) */
  queryHash: string;
  /** Solver used */
  solver: string;
  /** Solver version (if external) */
  solverVersion?: string;
  /** Result status */
  status: 'sat' | 'unsat' | 'unknown' | 'timeout' | 'error';
  /** Model (if sat / counterexample found) */
  model?: Record<string, unknown>;
  /** Reason (if unknown or error) */
  reason?: string;
  /** Time spent solving (ms) */
  durationMs: number;
  /** Raw SMT-LIB query (for debugging / proof bundles) */
  smtLibQuery?: string;
  /** Timestamp of execution */
  timestamp: string;
}

/**
 * Result of attempting to resolve a single unknown clause via SMT
 */
export interface SMTResolutionResult {
  /** Clause that was resolved */
  clauseId: string;
  /** Original status was always 'not_proven' */
  originalStatus: 'not_proven';
  /** New status after SMT resolution */
  newStatus: ClauseStatus;
  /** New tri-state after SMT resolution */
  newTriState: TriState;
  /** SMT verdict */
  verdict: 'proved' | 'disproved' | 'still_unknown';
  /** Solver evidence for proof bundles */
  evidence?: SMTSolverEvidence;
  /** Duration of this resolution attempt (ms) */
  durationMs: number;
  /** Reason for the verdict */
  reason?: string;
}

/**
 * Output from the SMT resolution stage
 */
export interface SMTResolutionOutput {
  /** Individual resolution results */
  resolutions: SMTResolutionResult[];
  /** Summary statistics */
  summary: {
    /** Total unknowns that were candidates for SMT */
    totalUnknowns: number;
    /** Unknowns that became proved or disproved */
    resolved: number;
    /** Unknowns proved true by SMT */
    proved: number;
    /** Unknowns disproved (counterexample found) by SMT */
    disproved: number;
    /** Unknowns that SMT could not determine */
    stillUnknown: number;
    /** Unknowns that timed out */
    timedOut: number;
    /** Unknowns that errored during SMT */
    errors: number;
    /** Resolution rate: resolved / totalUnknowns (0-1) */
    resolutionRate: number;
    /** Total time spent on SMT resolution (ms) */
    totalDurationMs: number;
  };
}

// ============================================================================
// PIPELINE CONFIGURATION
// ============================================================================

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** ISL spec content or path */
  spec: string | { path: string; content: string };
  
  /** Test configuration */
  tests: {
    /** Path pattern for test files */
    pattern?: string;
    /** Test framework to use */
    framework?: TestFramework;
    /** Test timeout in ms */
    timeout?: number;
    /** Whether to collect coverage */
    coverage?: boolean;
  };
  
  /** Trace collection configuration */
  traces: {
    /** Enable trace collection */
    enabled?: boolean;
    /** Maximum events per trace */
    maxEvents?: number;
    /** Redact PII from traces */
    redactPii?: boolean;
  };
  
  /** SMT checker configuration */
  smt?: {
    /** Enable SMT checking */
    enabled?: boolean;
    /** Solver to use */
    solver?: 'z3' | 'cvc5';
    /** Timeout per check in ms */
    timeout?: number;
  };
  
  /** Proof bundle configuration */
  proofBundle?: {
    /** Output directory */
    outputDir?: string;
    /** Sign the bundle */
    sign?: {
      secret: string;
      keyId?: string;
    };
    /** Include full traces */
    includeFullTraces?: boolean;
  };
  
  /** CI configuration */
  ci?: {
    /** Enable CI mode (deterministic output) */
    enabled?: boolean;
    /** Output file path */
    outputPath?: string;
    /** Fail on incomplete proof */
    failOnIncomplete?: boolean;
  };
  
  /** Stage timeouts */
  timeouts?: {
    testRunner?: number;
    traceCollector?: number;
    postconditionEvaluator?: number;
    invariantChecker?: number;
    smtChecker?: number;
    proofBundle?: number;
  };
}

// ============================================================================
// PIPELINE OUTPUT
// ============================================================================

/**
 * Complete pipeline result
 */
export interface PipelineResult {
  /** Unique pipeline run ID */
  runId: string;
  
  /** Final verdict */
  verdict: PipelineVerdict;
  
  /** Verdict reason */
  verdictReason: string;
  
  /** Overall score (0-100) */
  score: number;
  
  /** Pipeline execution times */
  timing: {
    startedAt: string;
    completedAt: string;
    totalDurationMs: number;
  };
  
  /** Results from each stage */
  stages: {
    setup?: StageResult;
    testRunner?: StageResult<TestRunnerOutput>;
    traceCollector?: StageResult<TraceCollectorOutput>;
    postconditionEvaluator?: StageResult<PostconditionEvaluatorOutput>;
    invariantChecker?: StageResult<InvariantCheckerOutput>;
    smtChecker?: StageResult<SMTCheckerOutput>;
    proofBundle?: StageResult<{ bundleId: string; bundlePath: string }>;
  };
  
  /** Aggregated evidence */
  evidence: {
    postconditions: ClauseEvidence[];
    invariants: InvariantEvidence[];
  };
  
  /** Summary statistics */
  summary: {
    tests: {
      total: number;
      passed: number;
      failed: number;
    };
    postconditions: {
      total: number;
      proven: number;
      violated: number;
      notProven: number;
    };
    invariants: {
      total: number;
      proven: number;
      violated: number;
      notProven: number;
    };
    smt?: {
      total: number;
      proven: number;
      refuted: number;
      unknown: number;
    };
  };
  
  /** Errors encountered */
  errors: StageError[];
  
  /** Proof bundle info (if generated) */
  proofBundle?: {
    bundleId: string;
    bundlePath: string;
    manifestPath: string;
  };
}

// ============================================================================
// CI OUTPUT FORMAT
// ============================================================================

/**
 * Deterministic CI output format
 * 
 * This format is designed for:
 * - GitHub Actions / CI systems
 * - Machine parsing
 * - Consistent ordering and formatting
 */
export interface CIOutput {
  /** Schema version for forward compatibility */
  schemaVersion: '1.0.0';
  
  /** Pipeline run identifier */
  runId: string;
  
  /** ISO 8601 timestamp */
  timestamp: string;
  
  /** Final verdict */
  verdict: PipelineVerdict;
  
  /** Exit code recommendation */
  exitCode: 0 | 1 | 2; // 0=PROVEN, 1=FAILED, 2=INCOMPLETE_PROOF
  
  /** Human-readable summary */
  summary: string;
  
  /** Numeric score (0-100) */
  score: number;
  
  /** Detailed counts */
  counts: {
    tests: { total: number; passed: number; failed: number; skipped: number };
    postconditions: { total: number; proven: number; violated: number; notProven: number };
    invariants: { total: number; proven: number; violated: number; notProven: number };
  };
  
  /** Violations (sorted by severity) */
  violations: Array<{
    type: 'postcondition' | 'invariant' | 'test';
    clauseId?: string;
    behavior?: string;
    expression?: string;
    message: string;
    location?: SourceLocation;
  }>;
  
  /** Proof bundle info */
  proofBundle?: {
    bundleId: string;
    path: string;
  };
  
  /** Timing information */
  timing: {
    totalMs: number;
    stages: Record<string, number>;
  };
}

// ============================================================================
// EVALUATION TABLE FORMAT (for proof bundle)
// ============================================================================

/**
 * Evaluation table row for proof bundle
 */
export interface EvaluationTableRow {
  clauseId: string;
  type: 'postcondition' | 'invariant';
  scope?: InvariantScope;
  behavior?: string;
  outcome?: string;
  expression: string;
  status: ClauseStatus;
  triState: TriState;
  reason?: string;
  sourceLocation?: SourceLocation;
  traceId?: string;
}

/**
 * Complete evaluation table
 */
export interface EvaluationTable {
  /** Table version */
  version: '1.0.0';
  
  /** Domain name */
  domain: string;
  
  /** Spec version */
  specVersion: string;
  
  /** Generated at */
  generatedAt: string;
  
  /** Pipeline run ID */
  runId: string;
  
  /** Overall verdict */
  verdict: PipelineVerdict;
  
  /** Evaluation rows */
  rows: EvaluationTableRow[];
  
  /** Summary */
  summary: {
    total: number;
    proven: number;
    violated: number;
    notProven: number;
    skipped: number;
  };
}

// ============================================================================
// VERIFICATION RESULT (PRIMARY OUTPUT SCHEMA)
// ============================================================================

/**
 * Individual clause evaluation result
 */
export interface ClauseResult {
  /** Unique clause identifier (e.g., "Login_post_success_1") */
  clauseId: string;
  
  /** Clause type */
  type: 'postcondition' | 'invariant' | 'precondition';
  
  /** Behavior this clause belongs to */
  behavior?: string;
  
  /** Outcome context (for postconditions) */
  outcome?: string;
  
  /** The expression being evaluated */
  expression: string;
  
  /** Evaluation status */
  status: ClauseStatus;
  
  /** Tri-state result: true (proven), false (violated), or 'unknown' (incomplete) */
  triStateResult: TriState;
  
  /** Reason for the result (especially important for failures and unknowns) */
  reason?: string;
  
  /** Source location in the ISL spec */
  sourceLocation?: SourceLocation;
  
  /** How the verdict was determined */
  resolvedBy?: 'runtime' | 'smt' | 'runtime_then_smt';
  
  /** SMT solver evidence (attached when SMT resolved this clause) */
  smtEvidence?: SMTSolverEvidence;
}

/**
 * Reason why a clause could not be proven
 */
export interface UnknownReason {
  /** Clause that couldn't be evaluated */
  clauseId: string;
  
  /** Category of the reason */
  category: 
    | 'missing_trace'      // No execution trace available
    | 'missing_data'       // Required data not in trace
    | 'evaluation_error'   // Error during expression evaluation
    | 'unsupported_expr'   // Expression type not supported
    | 'timeout'            // Evaluation timed out
    | 'smt_unknown'        // SMT solver returned unknown
    | 'missing_bindings'   // Required variables/inputs not available
    | 'unsupported_smt_fragment' // Expression cannot be encoded for SMT
    | 'runtime_data_unavailable'; // Traces or runtime data missing
  
  /** Human-readable explanation */
  message: string;
  
  /** Actionable remediation steps */
  remediation?: string[];
  
  /** Whether this unknown can potentially be resolved */
  mitigatable?: boolean;
  
  /** Suggested mitigation strategies */
  suggestedMitigations?: Array<
    | 'runtime_sampling'
    | 'fallback_check'
    | 'constraint_slicing'
    | 'smt_retry'
    | 'add_bindings'
  >;
  
  /** Additional context */
  details?: Record<string, unknown>;
}

/**
 * Reference to evidence supporting a clause result
 */
export interface EvidenceRef {
  /** Clause this evidence supports */
  clauseId: string;
  
  /** Type of evidence */
  type: 'trace' | 'test' | 'smt_proof' | 'runtime_check';
  
  /** Reference to the evidence (trace ID, test name, etc.) */
  ref: string;
  
  /** Summary of what this evidence shows */
  summary: string;
  
  /** Location in the evidence (e.g., trace event index) */
  location?: {
    traceId?: string;
    eventIndex?: number;
    testFile?: string;
    testLine?: number;
  };
}

/**
 * Complete verification result
 * 
 * This is the primary output schema for `isl verify`:
 * - verdict: PROVEN | FAILED | INCOMPLETE_PROOF
 * - clauseResults: Per-clause evaluation results
 * - unknownReasons: Why certain clauses couldn't be evaluated
 * - evidenceRefs: References to supporting evidence
 */
export interface VerificationResult {
  /** Schema version for forward compatibility */
  schemaVersion: '1.0.0';
  
  /** Verification run ID */
  runId: string;
  
  /** ISO 8601 timestamp */
  timestamp: string;
  
  /** Domain being verified */
  domain: string;
  
  /** Domain version */
  version: string;
  
  /** Overall verdict */
  verdict: PipelineVerdict;
  
  /** Human-readable verdict reason */
  verdictReason: string;
  
  /** Verification score (0-100) */
  score: number;
  
  /** Per-clause evaluation results */
  clauseResults: ClauseResult[];
  
  /** Reasons why certain clauses are unknown */
  unknownReasons: UnknownReason[];
  
  /** References to supporting evidence */
  evidenceRefs: EvidenceRef[];
  
  /** Summary statistics */
  summary: {
    totalClauses: number;
    proven: number;
    violated: number;
    unknown: number;
    skipped: number;
  };
  
  /** Timing information */
  timing: {
    totalMs: number;
    parseMs?: number;
    testRunnerMs?: number;
    traceCollectorMs?: number;
    evaluatorMs?: number;
    smtResolutionMs?: number;
  };
  
  /** Exit code recommendation (0=success, 1=failure, 2=incomplete) */
  exitCode: 0 | 1 | 2;
}

// ============================================================================
// PIPELINE HOOKS
// ============================================================================

/**
 * Pipeline event types
 */
export type PipelineEvent = 
  | { type: 'pipeline:start'; config: PipelineConfig }
  | { type: 'pipeline:complete'; result: PipelineResult }
  | { type: 'stage:start'; stage: PipelineStage }
  | { type: 'stage:complete'; stage: PipelineStage; result: StageResult }
  | { type: 'stage:error'; stage: PipelineStage; error: StageError }
  | { type: 'clause:evaluated'; evidence: ClauseEvidence };

/**
 * Pipeline event handler
 */
export type PipelineEventHandler = (event: PipelineEvent) => void | Promise<void>;

/**
 * Pipeline hooks for extensibility
 */
export interface PipelineHooks {
  /** Called before each stage */
  beforeStage?: (stage: PipelineStage) => Promise<void>;
  
  /** Called after each stage */
  afterStage?: (stage: PipelineStage, result: StageResult) => Promise<void>;
  
  /** Called when a clause is evaluated */
  onClauseEvaluated?: (evidence: ClauseEvidence) => Promise<void>;
  
  /** Event handler for all events */
  onEvent?: PipelineEventHandler;
}
