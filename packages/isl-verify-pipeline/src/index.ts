/**
 * ISL Verification Pipeline
 * 
 * A complete verification orchestrator that:
 * - Uses import-resolver to parse specs with imports
 * - Runs generated tests or collects execution traces
 * - Evaluates postconditions/invariants (tri-state: true/false/unknown)
 * - Optionally runs SMT checks
 * - Produces PROVEN / INCOMPLETE_PROOF / FAILED verdicts
 * - Generates per-clause evaluation tables
 * - Integrates with proof bundles
 * 
 * @example
 * ```typescript
 * // Recommended: Use runVerification for `isl verify`
 * import { runVerification } from '@isl-lang/verify-pipeline';
 * 
 * const result = await runVerification({
 *   specPath: './login.isl',
 *   traceDir: './.verify-pipeline/traces',
 * });
 * 
 * console.log(result.verdict);       // 'PROVEN' | 'FAILED' | 'INCOMPLETE_PROOF'
 * console.log(result.clauseResults); // Per-clause evaluation results
 * console.log(result.unknownReasons); // Why certain clauses couldn't be proven
 * console.log(result.evidenceRefs);  // References to supporting evidence
 * console.log(result.exitCode);      // 0=success, 1=failure, 2=incomplete
 * ```
 * 
 * @module @isl-lang/verify-pipeline
 */

// Core pipeline
export {
  VerificationPipeline,
  verify,
  createDefaultConfig,
} from './pipeline.js';

// 7-stage pipeline runner (recommended for gate integration)
export {
  runPipeline,
  type PipelineRunConfig,
  type PipelineRunResult,
  type GateEvidence,
  type StageOutcome,
} from './run-pipeline.js';

// New verifier (recommended for `isl verify`)
export {
  runVerification,
  extractClauses,
  formatExpression,
  evaluateExpression,
  type VerifyConfig,
} from './verifier.js';

// Types
export type {
  // Verdicts and states
  PipelineVerdict,
  TriState,
  ClauseStatus,
  
  // Pipeline stages
  PipelineStage,
  StageStatus,
  StageResult,
  
  // Failure handling
  FailureCategory,
  StageError,
  RecoveryAction,
  
  // Test runner
  TestFramework,
  TestCaseResult,
  TestSuiteResult,
  TestRunnerOutput,
  
  // Trace types
  TraceEventKind,
  TraceEvent,
  ExecutionTrace,
  TraceCollectorOutput,
  
  // Evaluator types
  SourceLocation,
  ClauseEvidence,
  PostconditionEvaluatorOutput,
  
  // Invariant types
  InvariantScope,
  InvariantEvidence,
  InvariantCheckerOutput,
  
  // SMT types
  SMTResult,
  SMTCheckResult,
  SMTCheckerOutput,
  
  // SMT Resolution types
  SMTSolverEvidence,
  SMTResolutionResult,
  SMTResolutionOutput,
  
  // Configuration
  PipelineConfig,
  
  // Output types
  PipelineResult,
  CIOutput,
  EvaluationTable,
  EvaluationTableRow,
  
  // Verification Result (primary output schema)
  VerificationResult,
  ClauseResult,
  UnknownReason,
  EvidenceRef,
  
  // Hooks
  PipelineEvent,
  PipelineEventHandler,
  PipelineHooks,
} from './types.js';

// Stages (for advanced usage)
export {
  runTests,
  detectFramework,
} from './stages/test-runner.js';

export {
  collectTraces,
  collectInlineTraces,
  writeTraces,
  findTracesByBehavior,
  findTraceSlice,
  extractStateSnapshots,
} from './stages/trace-collector.js';

export {
  evaluatePostconditions,
} from './stages/postcondition-evaluator.js';

export {
  checkInvariants,
} from './stages/invariant-checker.js';

export {
  checkWithSMT,
  isSMTAvailable,
} from './stages/smt-checker.js';

export {
  resolveUnknownsWithSMT,
  applyResolutions,
} from './stages/smt-resolution.js';

// Unknown reduction (Agent 31)
export {
  classifyUnknown,
  classifyAllUnknowns,
  summarizeUnknowns,
  type UnknownCategory,
  type UnknownClassification,
  type MitigationStrategy,
} from './unknown-classifier.js';

export {
  attemptMitigations,
  attemptRuntimeSampling,
  attemptFallbackCheck,
  attemptConstraintSlicing,
  attemptSMTRetry,
  applyMitigationResults,
  type MitigationContext,
  type MitigationResult,
} from './unknown-mitigations.js';

export {
  formatUnknownSummary,
  formatUnknownReason,
  formatUnknownList,
} from './unknown-formatter.js';

// Output formatters
export {
  generateCIOutput,
  formatCIOutput,
  formatGitHubOutput,
  formatHumanOutput,
} from './output/ci-output.js';

export {
  generateEvaluationTable,
  formatTableAsJSON,
  formatTableAsMarkdown,
  formatTableAsHTML,
} from './output/evaluation-table.js';

export {
  writeToProofBundle,
  updateManifest,
  generateVerificationResult,
  readVerificationResults,
  readEvaluationTable,
} from './output/proof-bundle-integration.js';
