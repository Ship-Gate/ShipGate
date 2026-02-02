// ============================================================================
// ISL Formal Prover - Type Definitions
// ============================================================================

/**
 * SMT sorts (types)
 */
export type SMTSort =
  | { kind: 'Bool' }
  | { kind: 'Int' }
  | { kind: 'Real' }
  | { kind: 'String' }
  | { kind: 'BitVec'; width: number }
  | { kind: 'Array'; index: SMTSort; element: SMTSort }
  | { kind: 'Set'; element: SMTSort }
  | { kind: 'Datatype'; name: string; constructors: DatatypeConstructor[] }
  | { kind: 'Uninterpreted'; name: string };

export interface DatatypeConstructor {
  name: string;
  fields: { name: string; sort: SMTSort }[];
}

/**
 * SMT expressions
 */
export type SMTExpr =
  // Constants
  | { kind: 'BoolConst'; value: boolean }
  | { kind: 'IntConst'; value: number | bigint }
  | { kind: 'RealConst'; value: number }
  | { kind: 'StringConst'; value: string }
  | { kind: 'BitVecConst'; value: bigint; width: number }
  
  // Variables
  | { kind: 'Var'; name: string; sort: SMTSort }
  
  // Boolean operations
  | { kind: 'Not'; arg: SMTExpr }
  | { kind: 'And'; args: SMTExpr[] }
  | { kind: 'Or'; args: SMTExpr[] }
  | { kind: 'Implies'; left: SMTExpr; right: SMTExpr }
  | { kind: 'Iff'; left: SMTExpr; right: SMTExpr }
  | { kind: 'Ite'; cond: SMTExpr; then: SMTExpr; else: SMTExpr }
  
  // Comparison
  | { kind: 'Eq'; left: SMTExpr; right: SMTExpr }
  | { kind: 'Distinct'; args: SMTExpr[] }
  | { kind: 'Lt'; left: SMTExpr; right: SMTExpr }
  | { kind: 'Le'; left: SMTExpr; right: SMTExpr }
  | { kind: 'Gt'; left: SMTExpr; right: SMTExpr }
  | { kind: 'Ge'; left: SMTExpr; right: SMTExpr }
  
  // Arithmetic
  | { kind: 'Add'; args: SMTExpr[] }
  | { kind: 'Sub'; left: SMTExpr; right: SMTExpr }
  | { kind: 'Mul'; args: SMTExpr[] }
  | { kind: 'Div'; left: SMTExpr; right: SMTExpr }
  | { kind: 'Mod'; left: SMTExpr; right: SMTExpr }
  | { kind: 'Neg'; arg: SMTExpr }
  | { kind: 'Abs'; arg: SMTExpr }
  
  // Quantifiers
  | { kind: 'Forall'; vars: { name: string; sort: SMTSort }[]; body: SMTExpr }
  | { kind: 'Exists'; vars: { name: string; sort: SMTSort }[]; body: SMTExpr }
  
  // Arrays
  | { kind: 'Select'; array: SMTExpr; index: SMTExpr }
  | { kind: 'Store'; array: SMTExpr; index: SMTExpr; value: SMTExpr }
  | { kind: 'ConstArray'; sort: SMTSort; value: SMTExpr }
  
  // Functions
  | { kind: 'Apply'; func: string; args: SMTExpr[] }
  
  // Let bindings
  | { kind: 'Let'; bindings: { name: string; value: SMTExpr }[]; body: SMTExpr };

/**
 * SMT declaration
 */
export type SMTDecl =
  | { kind: 'DeclareConst'; name: string; sort: SMTSort }
  | { kind: 'DeclareFun'; name: string; params: SMTSort[]; returnSort: SMTSort }
  | { kind: 'DeclareSort'; name: string; arity: number }
  | { kind: 'DeclareDatatype'; name: string; constructors: DatatypeConstructor[] }
  | { kind: 'DefineFun'; name: string; params: { name: string; sort: SMTSort }[]; returnSort: SMTSort; body: SMTExpr }
  | { kind: 'Assert'; expr: SMTExpr };

/**
 * Verification goal
 */
export interface VerificationGoal {
  name: string;
  description?: string;
  assumptions: SMTExpr[];
  property: SMTExpr;
  timeout?: number;
}

/**
 * Verification result
 */
export type VerificationResult =
  | { status: 'valid'; proof?: string }
  | { status: 'invalid'; counterexample: Counterexample }
  | { status: 'unknown'; reason: string }
  | { status: 'timeout' }
  | { status: 'error'; message: string };

/**
 * Counterexample
 */
export interface Counterexample {
  assignments: Map<string, unknown>;
  trace?: TraceStep[];
}

/**
 * Trace step for debugging
 */
export interface TraceStep {
  location: string;
  state: Map<string, unknown>;
  action?: string;
}

/**
 * Prover configuration
 */
export interface ProverConfig {
  solver?: 'z3' | 'cvc5' | 'yices' | 'builtin';
  timeout?: number;
  incremental?: boolean;
  produceProofs?: boolean;
  produceModels?: boolean;
  logicMode?: SMTLogic;
}

/**
 * SMT-LIB logic modes
 */
export type SMTLogic =
  | 'QF_LIA'    // Quantifier-free linear integer arithmetic
  | 'QF_LRA'    // Quantifier-free linear real arithmetic
  | 'QF_NIA'    // Quantifier-free nonlinear integer arithmetic
  | 'QF_NRA'    // Quantifier-free nonlinear real arithmetic
  | 'QF_BV'     // Quantifier-free bitvectors
  | 'QF_AUFLIA' // Quantifier-free arrays, uninterpreted functions, linear integer arithmetic
  | 'LIA'       // Linear integer arithmetic with quantifiers
  | 'LRA'       // Linear real arithmetic with quantifiers
  | 'AUFLIA'    // Arrays, uninterpreted functions, linear integer arithmetic
  | 'ALL';      // All theories

/**
 * ISL property to verify
 */
export interface ISLProperty {
  kind: 'invariant' | 'precondition' | 'postcondition' | 'assertion' | 'temporal';
  name: string;
  expression: string;  // ISL expression
  scope?: string;      // Entity or behavior name
}

/**
 * ISL verification context
 */
export interface ISLVerificationContext {
  entities: Map<string, EntitySchema>;
  behaviors: Map<string, BehaviorSchema>;
  types: Map<string, TypeSchema>;
  invariants: ISLProperty[];
}

/**
 * Entity schema for verification
 */
export interface EntitySchema {
  name: string;
  fields: { name: string; type: string; optional: boolean }[];
  invariants: string[];
}

/**
 * Behavior schema for verification
 */
export interface BehaviorSchema {
  name: string;
  inputs: { name: string; type: string; optional: boolean }[];
  outputs: { name: string; type: string }[];
  preconditions: string[];
  postconditions: string[];
  sideEffects: { entity: string; action: string }[];
}

/**
 * Type schema
 */
export interface TypeSchema {
  name: string;
  kind: 'primitive' | 'enum' | 'struct' | 'union' | 'constrained';
  constraints?: Record<string, unknown>;
}

/**
 * Verification report
 */
export interface VerificationReport {
  timestamp: Date;
  duration: number;
  results: PropertyResult[];
  summary: VerificationSummary;
}

export interface PropertyResult {
  property: ISLProperty;
  result: VerificationResult;
  duration: number;
}

export interface VerificationSummary {
  total: number;
  valid: number;
  invalid: number;
  unknown: number;
  timeout: number;
  error: number;
}
