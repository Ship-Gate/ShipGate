// ============================================================================
// Verifier Runtime - Public API
// ============================================================================

// Main verify function
export {
  verify,
  verifyAll,
  verifyWithState,
  createEvaluationContext,
  findBehavior,
  getBehaviorNames,
  type VerifyOptions,
} from './verifier.js';

// Types
export type {
  // Core types
  EntityStore,
  EntityInstance,
  EntityStoreSnapshot,
  EvaluationContext,
  
  // Input types
  InputCategory,
  GeneratedInput,
  InputConstraints,
  
  // Check types
  CheckType,
  CheckResult,
  
  // Result types
  VerificationError,
  ExecutionResult,
  LogEntry,
  VerifyResult,
  VerifyVerdict,
  CoverageInfo,
  TimingInfo,
  
  // Implementation interface
  Implementation,
  ImplementationLoader,
} from './types.js';

// Expression evaluation (legacy)
export {
  evaluate,
  expressionToString,
  EvaluationError,
} from './expressions.js';

// Enhanced expression evaluator (v1)
export {
  evaluateExpression,
  DefaultAdapter,
  triStateAnd,
  triStateOr,
  triStateNot,
  triStateImplies,
  isUnknown,
  toTriState,
  success,
  unknown,
  failure,
  type TriState,
  type EvaluationResult,
  type ExpressionAdapter,
  type EvaluatorOptions,
} from './evaluator.js';

// Input generation
export {
  generateInputs,
  generateQuickInput,
  generateScenarioInputs,
} from './inputs.js';

// Check functions
export {
  // Preconditions
  checkPreconditions,
  allPreconditionsPassed,
  getFailedPreconditions,
  formatPreconditionResults,
  
  // Postconditions
  checkPostconditions,
  determineOutcome,
  allPostconditionsPassed,
  getFailedPostconditions,
  formatPostconditionResults,
  groupByCondition,
  type Outcome,
  
  // Invariants
  checkInvariants,
  checkDomainInvariants,
  checkEntityInvariants,
  checkAllInvariants,
  allInvariantsPassed,
  getFailedInvariants,
  formatInvariantResults,
  groupInvariantsByType,
} from './checks/index.js';

// Runner
export {
  createRunner,
  createEntityStore,
  buildMockImplementation,
  loadImplementation,
  Runner,
  InMemoryEntityStore,
  type RunnerOptions,
} from './runner.js';

// Reporter
export {
  generateReport,
  generateSummaryReport,
  type ReportFormat,
  type ReportOptions,
} from './reporter.js';

// Runtime Probe (Playwright-based route/env/side-effect verification)
export {
  runRuntimeProbe,
  loadTruthpack,
  probeRoutes,
  probeSingleRoute,
  probeBrowserRoute,
  checkEnvVars,
  checkSingleEnvVar,
  buildAllClaims,
  buildRouteClaims,
  buildEnvClaims,
  scoreClaims,
  buildReport as buildProbeReport,
  buildProofArtifact,
  writeReportToDir,
  formatHumanSummary,
  formatCliSummary,
  type RuntimeProbeConfig,
  type RuntimeProbeReport,
  type RuntimeProofArtifact,
  type RuntimeProbeResult,
} from './probe/index.js';
