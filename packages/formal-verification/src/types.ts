/**
 * Formal Verification Types
 */

// ============================================
// Verification Results
// ============================================

export type VerificationResult =
  | { status: 'verified'; proof: Proof }
  | { status: 'falsified'; counterexample: Counterexample }
  | { status: 'unknown'; reason: string }
  | { status: 'timeout'; duration: number }
  | { status: 'error'; message: string };

export interface Proof {
  property: string;
  method: ProofMethod;
  steps: ProofStep[];
  assumptions: string[];
  duration: number;
}

export type ProofMethod = 
  | 'smt'
  | 'induction'
  | 'model_checking'
  | 'abstract_interpretation'
  | 'symbolic_execution';

export interface ProofStep {
  description: string;
  formula: string;
  result: 'valid' | 'invalid' | 'unknown';
}

export interface Counterexample {
  property: string;
  values: Record<string, unknown>;
  trace?: ExecutionTrace;
}

export interface ExecutionTrace {
  steps: TraceStep[];
}

export interface TraceStep {
  action: string;
  state: Record<string, unknown>;
  condition?: string;
}

// ============================================
// Verification Targets
// ============================================

export interface VerificationTarget {
  type: 'precondition' | 'postcondition' | 'invariant' | 'temporal' | 'refinement';
  name: string;
  formula: Formula;
  context: VerificationContext;
}

export interface VerificationContext {
  domain: string;
  behavior?: string;
  entity?: string;
  assumptions: Formula[];
  bindings: Record<string, unknown>;
}

// ============================================
// Formula Types (SMT-LIB compatible)
// ============================================

export type Formula =
  | { kind: 'const'; value: boolean | number | string }
  | { kind: 'var'; name: string; sort: Sort }
  | { kind: 'not'; arg: Formula }
  | { kind: 'and'; args: Formula[] }
  | { kind: 'or'; args: Formula[] }
  | { kind: 'implies'; left: Formula; right: Formula }
  | { kind: 'iff'; left: Formula; right: Formula }
  | { kind: 'forall'; vars: Variable[]; body: Formula }
  | { kind: 'exists'; vars: Variable[]; body: Formula }
  | { kind: 'eq'; left: Formula; right: Formula }
  | { kind: 'lt'; left: Formula; right: Formula }
  | { kind: 'le'; left: Formula; right: Formula }
  | { kind: 'gt'; left: Formula; right: Formula }
  | { kind: 'ge'; left: Formula; right: Formula }
  | { kind: 'add'; args: Formula[] }
  | { kind: 'sub'; left: Formula; right: Formula }
  | { kind: 'mul'; args: Formula[] }
  | { kind: 'div'; left: Formula; right: Formula }
  | { kind: 'mod'; left: Formula; right: Formula }
  | { kind: 'ite'; cond: Formula; then: Formula; else: Formula }
  | { kind: 'select'; array: Formula; index: Formula }
  | { kind: 'store'; array: Formula; index: Formula; value: Formula }
  | { kind: 'app'; func: string; args: Formula[] };

export type Sort =
  | { kind: 'bool' }
  | { kind: 'int' }
  | { kind: 'real' }
  | { kind: 'string' }
  | { kind: 'bitvec'; width: number }
  | { kind: 'array'; index: Sort; element: Sort }
  | { kind: 'datatype'; name: string }
  | { kind: 'uninterpreted'; name: string };

export interface Variable {
  name: string;
  sort: Sort;
}

// ============================================
// Configuration
// ============================================

export interface VerifierConfig {
  solver: 'z3' | 'cvc5' | 'yices';
  timeout: number;
  memoryLimit: number;
  parallel: boolean;
  maxWorkers: number;
  cacheResults: boolean;
  generateProofs: boolean;
  verbose: boolean;
}

export const defaultConfig: VerifierConfig = {
  solver: 'z3',
  timeout: 30000,
  memoryLimit: 4096,
  parallel: true,
  maxWorkers: 4,
  cacheResults: true,
  generateProofs: true,
  verbose: false,
};

// ============================================
// ISL-Specific Types
// ============================================

export interface ISLSpecification {
  domain: string;
  types: ISLType[];
  entities: ISLEntity[];
  behaviors: ISLBehavior[];
  invariants: ISLInvariant[];
}

export interface ISLType {
  name: string;
  baseType?: string;
  constraints: ISLConstraint[];
}

export interface ISLConstraint {
  kind: 'min' | 'max' | 'min_length' | 'max_length' | 'pattern' | 'enum';
  value: unknown;
}

export interface ISLEntity {
  name: string;
  fields: ISLField[];
  invariants: string[];
}

export interface ISLField {
  name: string;
  type: string;
  optional: boolean;
  annotations: string[];
}

export interface ISLBehavior {
  name: string;
  input: ISLField[];
  output: ISLOutput;
  preconditions: string[];
  postconditions: string[];
  invariants: string[];
}

export interface ISLOutput {
  success?: ISLField[];
  errors: ISLError[];
}

export interface ISLError {
  code: string;
  when?: string;
  retriable?: boolean;
}

export interface ISLInvariant {
  name: string;
  scope: 'global' | 'entity' | 'behavior';
  conditions: string[];
}
