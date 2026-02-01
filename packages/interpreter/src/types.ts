// ============================================================================
// ISL Interpreter - Type Definitions
// @intentos/interpreter/types
// ============================================================================

import type {
  Value,
  Expression as RuntimeExpression,
  Environment,
  ExecutionContext,
  Domain as RuntimeDomain,
  BehaviorDefinition,
} from '@intentos/runtime-interpreter';

import type {
  Domain as ASTDomain,
  Behavior,
  Scenario,
  Expression as ASTExpression,
  Statement,
  ScenarioBlock,
} from '@intentos/parser';

// ============================================================================
// VERIFICATION MODES
// ============================================================================

export type VerificationMode =
  | 'static'    // Check spec against provided pre/post state snapshots
  | 'dynamic'   // Actually call the target function and capture before/after state
  | 'scenario'  // Run each scenario's given/when/then sequence
  | 'chaos';    // Inject faults and verify expectations (stretch)

// ============================================================================
// BINDING SOURCES
// ============================================================================

export type BindingSource =
  | { type: 'json'; path: string }
  | { type: 'module'; path: string; export?: string }
  | { type: 'stdin' }
  | { type: 'http'; url: string; method?: string; headers?: Record<string, string> }
  | { type: 'inline'; data: unknown };

// ============================================================================
// TEST DATA FORMAT
// ============================================================================

export interface TestData {
  intent: string;
  bindings: {
    pre: Record<string, unknown>;
    post?: Record<string, unknown>;
  };
  scenarios?: ScenarioTestData[];
}

export interface ScenarioTestData {
  name: string;
  given?: Record<string, unknown>;
  when?: Record<string, unknown>;
  expected?: {
    success?: boolean;
    result?: unknown;
    error?: {
      code?: string;
      message?: string;
    };
  };
}

// ============================================================================
// VERIFICATION OPTIONS
// ============================================================================

export interface VerificationOptions {
  /** Verification mode */
  mode: VerificationMode;
  
  /** Timeout per verification in milliseconds (default: 5000) */
  timeout: number;
  
  /** Enable sandboxed execution */
  sandbox: boolean;
  
  /** Module system: ESM or CommonJS */
  moduleSystem: 'esm' | 'cjs' | 'auto';
  
  /** Capture stack traces for errors */
  stackTraces: boolean;
  
  /** Stop on first failure */
  failFast: boolean;
  
  /** Verbose output */
  verbose: boolean;
}

export const DEFAULT_OPTIONS: VerificationOptions = {
  mode: 'static',
  timeout: 5000,
  sandbox: true,
  moduleSystem: 'auto',
  stackTraces: true,
  failFast: false,
  verbose: false,
};

// ============================================================================
// VERIFICATION RESULTS
// ============================================================================

export type CheckResult =
  | { status: 'passed'; message: string; values?: Record<string, unknown> }
  | { status: 'failed'; message: string; expected?: unknown; actual?: unknown; values?: Record<string, unknown> }
  | { status: 'skipped'; message: string; reason: string }
  | { status: 'error'; message: string; error: Error };

export interface ConditionResult {
  type: 'precondition' | 'postcondition' | 'invariant';
  expression: string;
  result: CheckResult;
  duration: number;
}

export interface BehaviorResult {
  behavior: string;
  description?: string;
  preconditions: ConditionResult[];
  postconditions: ConditionResult[];
  invariants: ConditionResult[];
  scenarios: ScenarioResult[];
  duration: number;
  passed: boolean;
}

export interface ScenarioResult {
  name: string;
  given: StepResult[];
  when: StepResult[];
  then: CheckResult[];
  passed: boolean;
  duration: number;
  error?: Error;
}

export interface StepResult {
  description: string;
  result: CheckResult;
  duration: number;
}

// ============================================================================
// VERIFICATION REPORT
// ============================================================================

export interface VerificationReport {
  /** Spec file path */
  specPath: string;
  
  /** Target file path */
  targetPath?: string;
  
  /** Test data path */
  testDataPath?: string;
  
  /** Verification mode used */
  mode: VerificationMode;
  
  /** Results per behavior */
  behaviors: BehaviorResult[];
  
  /** Overall statistics */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
  };
  
  /** Total duration in milliseconds */
  duration: number;
  
  /** Timestamp of verification */
  timestamp: Date;
  
  /** Any warnings during verification */
  warnings: string[];
  
  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// REPORT FORMATS
// ============================================================================

export type ReportFormat = 'json' | 'terminal' | 'junit' | 'markdown';

export interface ReportOptions {
  format: ReportFormat;
  outputPath?: string;
  colors?: boolean;
  verbose?: boolean;
}

// ============================================================================
// EXECUTION PLAN
// ============================================================================

export interface ExecutionPlan {
  domain: ASTDomain;
  behaviors: BehaviorPlan[];
  options: VerificationOptions;
}

export interface BehaviorPlan {
  behavior: Behavior;
  preconditions: ASTExpression[];
  postconditions: {
    condition: string;
    predicates: ASTExpression[];
  }[];
  invariants: ASTExpression[];
  scenarios: Scenario[];
}

// ============================================================================
// BINDINGS
// ============================================================================

export interface Bindings {
  /** Pre-state bindings */
  pre: Map<string, Value>;
  
  /** Post-state bindings (for static verification) */
  post: Map<string, Value>;
  
  /** Old values (captured before execution) */
  old: Map<string, Value>;
  
  /** Result value */
  result?: Value;
}

// ============================================================================
// SANDBOX
// ============================================================================

export interface SandboxOptions {
  /** Allow file system access */
  allowFs: boolean;
  
  /** Allow network access */
  allowNet: boolean;
  
  /** Allow environment variable access */
  allowEnv: boolean;
  
  /** Timeout for execution */
  timeout: number;
  
  /** Memory limit in bytes */
  memoryLimit?: number;
}

export interface SandboxResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  duration: number;
  timedOut: boolean;
}

// ============================================================================
// TARGET INTEGRATION
// ============================================================================

export interface TargetFunction {
  name: string;
  fn: (...args: unknown[]) => unknown | Promise<unknown>;
  module: string;
}

export interface TargetModule {
  path: string;
  exports: Map<string, TargetFunction>;
}

// ============================================================================
// ERRORS
// ============================================================================

export class InterpreterError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'InterpreterError';
  }
}

export class BindingError extends InterpreterError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'BINDING_ERROR', context);
    this.name = 'BindingError';
  }
}

export class TimeoutError extends InterpreterError {
  constructor(message: string, public timeoutMs: number) {
    super(message, 'TIMEOUT_ERROR', { timeoutMs });
    this.name = 'TimeoutError';
  }
}

export class SandboxError extends InterpreterError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SANDBOX_ERROR', context);
    this.name = 'SandboxError';
  }
}

export class VerificationError extends InterpreterError {
  constructor(
    message: string,
    public kind: 'precondition' | 'postcondition' | 'invariant',
    public expression: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'VERIFICATION_ERROR', { kind, expression, ...context });
    this.name = 'VerificationError';
  }
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type {
  Value,
  RuntimeExpression,
  Environment,
  ExecutionContext,
  RuntimeDomain,
  BehaviorDefinition,
  ASTDomain,
  Behavior,
  Scenario,
  ASTExpression,
  Statement,
  ScenarioBlock,
};
