// ============================================================================
// ISL Interpreter - Public API
// @isl-lang/interpreter
// ============================================================================

// Main interpreter
export {
  ISLInterpreter,
  verify,
  verifyWithTarget,
} from './interpreter';

// Types
export type {
  VerificationMode,
  BindingSource,
  TestData,
  ScenarioTestData,
  VerificationOptions,
  CheckResult,
  ConditionResult,
  BehaviorResult,
  ScenarioResult,
  StepResult,
  VerificationReport,
  ReportFormat,
  ReportOptions,
  ExecutionPlan,
  BehaviorPlan,
  Bindings,
  SandboxOptions,
  SandboxResult,
  TargetFunction,
  TargetModule,
} from './types';

export {
  DEFAULT_OPTIONS,
  InterpreterError,
  BindingError,
  TimeoutError,
  SandboxError,
  VerificationError,
} from './types';

// Bindings
export {
  loadBindings,
  loadJsonBindings,
  loadModuleBindings,
  loadStdinBindings,
  loadHttpBindings,
  loadModule,
  loadTargetModule,
  parseTestData,
  toValue,
  fromValue,
  createBindings,
} from './bindings';

// Sandbox
export {
  runInSandbox,
  runWithTimeout,
  runInWorkerSandbox,
  createSafeContext,
  createTimeoutAbort,
  isAbortError,
} from './sandbox';

// Executor
export {
  captureState,
  cloneValues,
  cloneValue,
  executeFunction,
  executeBehavior,
  compareStates,
  valuesEqual,
  wrapWithAssertions,
} from './executor';

export type {
  CapturedState,
  SideEffect,
  ExecutionResult,
  StateComparison,
  WrappedFunction,
} from './executor';

// Scenarios
export {
  runScenarios,
  runScenario,
} from './scenarios';

export type {
  ScenarioContext,
} from './scenarios';

// Reports
export {
  generateReport,
  generateJsonReport,
  generateTerminalReport,
  generateJUnitReport,
  generateMarkdownReport,
} from './report';

// Simulator
export {
  RuntimeSimulator,
  simulate,
} from './simulator';

export type {
  SimulatorOptions,
  SimulationResult,
  ConditionEvaluation,
  EntityValidation,
} from './simulator';
