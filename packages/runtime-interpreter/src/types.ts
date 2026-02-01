// ============================================================================
// ISL Runtime Interpreter - Core Types
// @isl-lang/runtime-interpreter/types
// ============================================================================

// ============================================================================
// RUNTIME VALUES
// ============================================================================

/**
 * Runtime values in ISL.
 */
export type Value =
  | { tag: 'unit' }
  | { tag: 'boolean'; value: boolean }
  | { tag: 'int'; value: bigint }
  | { tag: 'float'; value: number }
  | { tag: 'decimal'; value: string; precision: number }
  | { tag: 'string'; value: string }
  | { tag: 'bytes'; value: Uint8Array }
  | { tag: 'timestamp'; value: Date }
  | { tag: 'duration'; value: number; unit: DurationUnit }
  | { tag: 'uuid'; value: string }
  | { tag: 'list'; elements: Value[] }
  | { tag: 'map'; entries: Map<string, Value> }
  | { tag: 'set'; elements: Set<Value> }
  | { tag: 'option'; value: Value | null }
  | { tag: 'result'; success: boolean; value: Value; error?: Value }
  | { tag: 'record'; type: string; fields: Map<string, Value> }
  | { tag: 'enum'; type: string; variant: string; data?: Value }
  | { tag: 'function'; params: string[]; body: Expression; closure: Environment }
  | { tag: 'native'; fn: NativeFunction }
  | { tag: 'entity'; type: string; id: string; fields: Map<string, Value>; version: number }
  | { tag: 'behavior_result'; behavior: string; outcome: 'success' | 'error'; value: Value }
  | { tag: 'effect'; name: string; operation: string; args: Value[] }
  | { tag: 'continuation'; id: string; stack: StackFrame[] };

export type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd';

export type NativeFunction = (args: Value[], env: Environment) => Value | Promise<Value>;

// ============================================================================
// EXPRESSIONS (AST Subset for Runtime)
// ============================================================================

export type Expression =
  | { tag: 'literal'; value: Value }
  | { tag: 'identifier'; name: string }
  | { tag: 'binary'; op: BinaryOp; left: Expression; right: Expression }
  | { tag: 'unary'; op: UnaryOp; operand: Expression }
  | { tag: 'call'; fn: Expression; args: Expression[] }
  | { tag: 'member'; object: Expression; field: string }
  | { tag: 'index'; collection: Expression; index: Expression }
  | { tag: 'conditional'; condition: Expression; then: Expression; else: Expression }
  | { tag: 'lambda'; params: Parameter[]; body: Expression }
  | { tag: 'let'; bindings: Binding[]; body: Expression }
  | { tag: 'match'; scrutinee: Expression; cases: MatchCase[] }
  | { tag: 'record_construct'; type: string; fields: { name: string; value: Expression }[] }
  | { tag: 'list_construct'; elements: Expression[] }
  | { tag: 'map_construct'; entries: { key: Expression; value: Expression }[] }
  | { tag: 'effect_perform'; effect: string; operation: string; args: Expression[] }
  | { tag: 'quantifier'; kind: 'forall' | 'exists'; variable: string; domain: Expression; body: Expression }
  | { tag: 'old'; expression: Expression }  // For postconditions
  | { tag: 'result' };  // The result value in postconditions

export type BinaryOp =
  | '+' | '-' | '*' | '/' | '%' | '**'
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | '&&' | '||'
  | '++' | '--'  // List concat, list difference
  | 'in' | 'contains';

export type UnaryOp = '-' | '!' | 'not';

export interface Parameter {
  name: string;
  type?: TypeExpr;
  default?: Expression;
}

export interface Binding {
  name: string;
  value: Expression;
}

export interface MatchCase {
  pattern: Pattern;
  guard?: Expression;
  body: Expression;
}

export type Pattern =
  | { tag: 'wildcard' }
  | { tag: 'literal'; value: Value }
  | { tag: 'binding'; name: string }
  | { tag: 'constructor'; type: string; variant: string; fields: { name: string; pattern: Pattern }[] }
  | { tag: 'list'; elements: Pattern[]; rest?: string }
  | { tag: 'record'; fields: { name: string; pattern: Pattern }[] };

export type TypeExpr =
  | { tag: 'primitive'; name: string }
  | { tag: 'reference'; name: string }
  | { tag: 'generic'; name: string; args: TypeExpr[] }
  | { tag: 'function'; params: TypeExpr[]; result: TypeExpr }
  | { tag: 'effect'; effects: string[]; result: TypeExpr };

// ============================================================================
// STATEMENTS
// ============================================================================

export type Statement =
  | { tag: 'expr'; expression: Expression }
  | { tag: 'let'; name: string; value: Expression }
  | { tag: 'assign'; target: Expression; value: Expression }
  | { tag: 'if'; condition: Expression; then: Statement[]; else?: Statement[] }
  | { tag: 'while'; condition: Expression; body: Statement[] }
  | { tag: 'for'; variable: string; iterable: Expression; body: Statement[] }
  | { tag: 'return'; value?: Expression }
  | { tag: 'break' }
  | { tag: 'continue' }
  | { tag: 'assert'; condition: Expression; message?: string }
  | { tag: 'emit'; event: string; data: Expression };

// ============================================================================
// DOMAIN DEFINITIONS
// ============================================================================

export interface Domain {
  name: string;
  version: string;
  types: Map<string, TypeDefinition>;
  entities: Map<string, EntityDefinition>;
  behaviors: Map<string, BehaviorDefinition>;
  invariants: Map<string, InvariantDefinition>;
  views: Map<string, ViewDefinition>;
}

export interface TypeDefinition {
  name: string;
  kind: 'alias' | 'enum' | 'struct' | 'union' | 'constrained';
  definition: TypeExpr | EnumDef | StructDef | UnionDef | ConstrainedDef;
}

export interface EnumDef {
  variants: { name: string; data?: TypeExpr }[];
}

export interface StructDef {
  fields: { name: string; type: TypeExpr; optional: boolean }[];
}

export interface UnionDef {
  variants: { name: string; type: TypeExpr }[];
}

export interface ConstrainedDef {
  base: TypeExpr;
  constraints: Constraint[];
}

export interface Constraint {
  kind: 'format' | 'min' | 'max' | 'min_length' | 'max_length' | 'pattern' | 'custom';
  value: Value;
}

export interface EntityDefinition {
  name: string;
  fields: EntityField[];
  invariants: Expression[];
  lifecycle?: LifecycleSpec;
}

export interface EntityField {
  name: string;
  type: TypeExpr;
  annotations: string[];
  default?: Expression;
}

export interface LifecycleSpec {
  states: string[];
  transitions: { from: string; to: string; via: string }[];
}

export interface BehaviorDefinition {
  name: string;
  description: string;
  input: { name: string; type: TypeExpr }[];
  output: OutputSpec;
  preconditions: Expression[];
  postconditions: Expression[];
  invariants: Expression[];
  temporal?: TemporalSpec;
  security?: SecuritySpec;
  implementation?: Expression;
}

export interface OutputSpec {
  success: TypeExpr;
  errors: { name: string; data?: TypeExpr; when?: string }[];
}

export interface TemporalSpec {
  timeout?: { value: number; unit: DurationUnit };
  eventually?: { condition: Expression; within: { value: number; unit: DurationUnit } }[];
}

export interface SecuritySpec {
  authentication: boolean;
  permissions: string[];
  rateLimit?: { count: number; period: { value: number; unit: DurationUnit } };
}

export interface InvariantDefinition {
  name: string;
  description: string;
  always: Expression[];
  eventually?: { condition: Expression; within: { value: number; unit: DurationUnit } }[];
}

export interface ViewDefinition {
  name: string;
  query: Expression;
  cache?: { ttl: { value: number; unit: DurationUnit } };
}

// ============================================================================
// ENVIRONMENT
// ============================================================================

export interface Environment {
  parent: Environment | null;
  bindings: Map<string, Value>;
  types: Map<string, TypeDefinition>;
  effects: Map<string, EffectHandler>;
}

export interface EffectHandler {
  effect: string;
  operations: Map<string, NativeFunction>;
}

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

export interface ExecutionContext {
  domain: Domain;
  environment: Environment;
  stack: StackFrame[];
  entities: EntityStore;
  events: Event[];
  trace: TraceEntry[];
  contractMode: ContractMode;
}

export interface StackFrame {
  name: string;
  location: SourceLocation;
  locals: Map<string, Value>;
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface EntityStore {
  get(type: string, id: string): Value | undefined;
  set(type: string, id: string, value: Value): void;
  delete(type: string, id: string): boolean;
  query(type: string, predicate: (v: Value) => boolean): Value[];
}

export interface Event {
  timestamp: Date;
  type: string;
  data: Value;
  source: string;
}

export interface TraceEntry {
  timestamp: Date;
  kind: 'call' | 'return' | 'effect' | 'contract' | 'error';
  data: Record<string, unknown>;
}

export type ContractMode = 'check' | 'assume' | 'skip';

// ============================================================================
// ERRORS
// ============================================================================

export class InterpreterError extends Error {
  constructor(
    message: string,
    public location?: SourceLocation,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'InterpreterError';
  }
}

export class ContractViolationError extends InterpreterError {
  constructor(
    public contractKind: 'precondition' | 'postcondition' | 'invariant',
    public contractExpr: string,
    location?: SourceLocation
  ) {
    super(`${contractKind} violation: ${contractExpr}`, location);
    this.name = 'ContractViolationError';
  }
}

export class TypeMismatchError extends InterpreterError {
  constructor(
    public expected: string,
    public actual: string,
    location?: SourceLocation
  ) {
    super(`Type mismatch: expected ${expected}, got ${actual}`, location);
    this.name = 'TypeMismatchError';
  }
}

export class UnhandledEffectError extends InterpreterError {
  constructor(
    public effect: string,
    public operation: string,
    location?: SourceLocation
  ) {
    super(`Unhandled effect: ${effect}.${operation}`, location);
    this.name = 'UnhandledEffectError';
  }
}
