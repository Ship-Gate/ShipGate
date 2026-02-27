// ============================================================================
// Versioned Semantics Types
// ============================================================================

/**
 * Semantic version identifier following semver
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Binary operator semantics
 */
export type BinaryOperator =
  | '==' | '!=' | '<' | '>' | '<=' | '>='
  | '+' | '-' | '*' | '/' | '%'
  | 'and' | 'or' | 'implies' | 'iff'
  | 'in';

/**
 * Unary operator semantics
 */
export type UnaryOperator = 'not' | '-';

/**
 * Quantifier semantics
 */
export type Quantifier = 'all' | 'any' | 'none' | 'count' | 'sum' | 'filter';

/**
 * Temporal operator semantics
 */
export type TemporalOperator = 'eventually' | 'always' | 'within' | 'never' | 'immediately' | 'response';

/**
 * Value type for semantic evaluation
 */
export type Value =
  | null
  | undefined
  | boolean
  | number
  | string
  | Date
  | RegExp
  | ValueArray
  | ValueRecord;

// Helper types to break circular reference
export interface ValueArray extends Array<Value> {}
export interface ValueRecord extends Record<string, Value> {}

/**
 * Defines the semantic behavior of a binary operator
 */
export interface BinaryOperatorSemantics {
  /** Operator symbol */
  operator: BinaryOperator;
  /** Human-readable description */
  description: string;
  /** Precedence level (higher = binds tighter) */
  precedence: number;
  /** Whether the operator is associative */
  associative: boolean;
  /** Whether the operator is commutative */
  commutative: boolean;
  /** Whether the operator uses short-circuit evaluation */
  shortCircuit: boolean;
  /** Expected operand types */
  operandTypes: readonly OperandTypeConstraint[];
  /** Result type given operand types */
  resultType: ValueType;
  /** Evaluation function signature */
  evaluate: (left: Value, right: Value) => Value;
}

/**
 * Defines the semantic behavior of a unary operator
 */
export interface UnaryOperatorSemantics {
  operator: UnaryOperator;
  description: string;
  precedence: number;
  operandTypes: readonly OperandTypeConstraint[];
  resultType: ValueType;
  evaluate: (operand: Value) => Value;
}

/**
 * Defines the semantic behavior of a quantifier
 */
export interface QuantifierSemantics {
  quantifier: Quantifier;
  description: string;
  /** The type of value the quantifier produces */
  resultType: ValueType;
  /** Whether early termination is possible */
  shortCircuit: boolean;
  /** Evaluate the quantifier over a collection */
  evaluate: (
    collection: Value[],
    predicate: (item: Value) => Value
  ) => Value;
}

/**
 * Defines the semantic behavior of a temporal operator
 */
export interface TemporalOperatorSemantics {
  operator: TemporalOperator;
  description: string;
  /** Whether this operator requires a duration */
  requiresDuration: boolean;
  /** Whether this operator can be nested */
  allowsNesting: boolean;
  /** Runtime interpretation */
  interpretation: TemporalInterpretation;
}

/**
 * How temporal operators are interpreted at runtime
 */
export type TemporalInterpretation =
  | 'poll_until_true'
  | 'assert_invariant'
  | 'deadline_check'
  | 'assert_never'
  | 'immediate_check'
  | 'stimulus_response';

/**
 * Value type for type checking
 */
export type ValueType =
  | 'any'
  | 'boolean'
  | 'number'
  | 'string'
  | 'null'
  | 'array'
  | 'object'
  | 'duration'
  | 'regex'
  | 'timestamp';

/**
 * Type constraint for operands
 */
export interface OperandTypeConstraint {
  types: readonly ValueType[];
  description: string;
}

/**
 * Complete semantics for a language version
 */
export interface VersionedSemantics {
  /** Version identifier */
  version: SemanticVersion;
  /** Version string (e.g., "1.0.0") */
  versionString: string;
  /** Binary operators */
  binaryOperators: Map<BinaryOperator, BinaryOperatorSemantics>;
  /** Unary operators */
  unaryOperators: Map<UnaryOperator, UnaryOperatorSemantics>;
  /** Quantifiers */
  quantifiers: Map<Quantifier, QuantifierSemantics>;
  /** Temporal operators */
  temporalOperators: Map<TemporalOperator, TemporalOperatorSemantics>;
  /** Get binary operator semantics */
  getBinaryOperator(op: BinaryOperator): BinaryOperatorSemantics | undefined;
  /** Get unary operator semantics */
  getUnaryOperator(op: UnaryOperator): UnaryOperatorSemantics | undefined;
  /** Get quantifier semantics */
  getQuantifier(q: Quantifier): QuantifierSemantics | undefined;
  /** Get temporal operator semantics */
  getTemporalOperator(op: TemporalOperator): TemporalOperatorSemantics | undefined;
}

/**
 * Parse a version string into components
 */
export function parseVersion(version: string): SemanticVersion {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version string: ${version}`);
  }
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
  };
}

/**
 * Format a version object as a string
 */
export function formatVersion(version: SemanticVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: SemanticVersion, b: SemanticVersion): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

/**
 * Check if version a is compatible with version b (same major, a >= b)
 */
export function isCompatible(a: SemanticVersion, b: SemanticVersion): boolean {
  return a.major === b.major && compareVersions(a, b) >= 0;
}
