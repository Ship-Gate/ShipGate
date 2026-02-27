// ============================================================================
// Verifier Runtime Types
// ============================================================================

import type * as AST from '@isl-lang/parser';

// ============================================================================
// VERIFICATION CONTEXT
// ============================================================================

/**
 * Entity store - manages entity instances during verification
 */
export interface EntityStore {
  /** Get all instances of an entity type */
  getAll(entityName: string): EntityInstance[];
  
  /** Check if an entity with given criteria exists */
  exists(entityName: string, criteria?: Record<string, unknown>): boolean;
  
  /** Lookup single entity by criteria */
  lookup(entityName: string, criteria: Record<string, unknown>): EntityInstance | undefined;
  
  /** Count entities matching criteria */
  count(entityName: string, criteria?: Record<string, unknown>): number;
  
  /** Create a new entity instance */
  create(entityName: string, data: Record<string, unknown>): EntityInstance;
  
  /** Update an entity instance */
  update(entityName: string, id: string, data: Record<string, unknown>): void;
  
  /** Delete an entity instance */
  delete(entityName: string, id: string): void;
  
  /** Take a snapshot of current state */
  snapshot(): EntityStoreSnapshot;
  
  /** Restore from a snapshot */
  restore(snapshot: EntityStoreSnapshot): void;
}

export interface EntityInstance {
  __entity__: string;
  __id__: string;
  [key: string]: unknown;
}

export interface EntityStoreSnapshot {
  entities: Map<string, Map<string, EntityInstance>>;
  timestamp: number;
}

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

/**
 * Context passed to expression evaluator
 */
export interface EvaluationContext {
  /** Current input values */
  input: Record<string, unknown>;
  
  /** Result of behavior execution (for postconditions) */
  result?: unknown;
  
  /** Error if behavior failed */
  error?: VerificationError;
  
  /** Entity store for lookups */
  store: EntityStore;
  
  /** Snapshot of state before execution (for old() expressions) */
  oldState?: EntityStoreSnapshot;
  
  /** Domain definition for type information */
  domain: AST.Domain;
  
  /** Current timestamp for now() */
  now: Date;
  
  /** Variables in scope (from scenarios) */
  variables: Map<string, unknown>;
}

// ============================================================================
// TEST INPUT TYPES
// ============================================================================

export type InputCategory = 'valid' | 'boundary' | 'invalid';

export interface GeneratedInput {
  category: InputCategory;
  name: string;
  description: string;
  values: Record<string, unknown>;
}

export interface InputConstraints {
  type: AST.TypeDefinition;
  field: AST.Field;
}

// ============================================================================
// VERIFICATION RESULTS
// ============================================================================

export type CheckType = 'precondition' | 'postcondition' | 'invariant';

export interface CheckResult {
  type: CheckType;
  name: string;
  expression: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  error?: string;
  duration: number;
}

export interface VerificationError {
  code: string;
  message: string;
  retriable: boolean;
  details?: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  result?: unknown;
  error?: VerificationError;
  duration: number;
  logs: LogEntry[];
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

// ============================================================================
// VERIFY RESULT
// ============================================================================

export type VerifyVerdict = 'verified' | 'risky' | 'unsafe';

export interface VerifyResult {
  success: boolean;
  verdict: VerifyVerdict;
  score: number;
  behaviorName: string;
  inputUsed: GeneratedInput;
  preconditions: CheckResult[];
  postconditions: CheckResult[];
  invariants: CheckResult[];
  execution: ExecutionResult;
  coverage: CoverageInfo;
  timing: TimingInfo;
}

export interface CoverageInfo {
  preconditions: { total: number; checked: number; passed: number };
  postconditions: { total: number; checked: number; passed: number };
  invariants: { total: number; checked: number; passed: number };
  overall: number;
}

export interface TimingInfo {
  total: number;
  inputGeneration: number;
  preconditionCheck: number;
  execution: number;
  postconditionCheck: number;
  invariantCheck: number;
}

// ============================================================================
// IMPLEMENTATION INTERFACE
// ============================================================================

/**
 * Expected interface for implementations to verify against
 */
export interface Implementation {
  /** Execute the behavior with given input */
  execute(input: Record<string, unknown>): Promise<ExecutionResult>;
  
  /** Get entity store for state verification */
  getEntityStore(): EntityStore;
  
  /** Setup any required state before execution */
  setup?(): Promise<void>;
  
  /** Cleanup after execution */
  teardown?(): Promise<void>;
}

/**
 * Function type for loadable implementations
 */
export type ImplementationLoader = (
  domain: AST.Domain,
  behaviorName: string
) => Promise<Implementation>;
