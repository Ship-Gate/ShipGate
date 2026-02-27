/**
 * ISL Expression IR (Intermediate Representation)
 *
 * This IR provides a normalized, canonical form for ISL expressions.
 * It's designed for:
 * - Deterministic evaluation
 * - Stable ordering (commutative ops normalized)
 * - Easy pattern matching
 * - Efficient evaluation
 */

// ============================================================================
// BASE IR NODES
// ============================================================================

export interface IRNode {
  readonly kind: string;
  /** Unique ID for this node (for debugging/tracing) */
  readonly id: string;
  /** Original source location (optional, for error messages) */
  readonly loc?: IRSourceLoc;
}

export interface IRSourceLoc {
  file?: string;
  line?: number;
  column?: number;
}

// ============================================================================
// IR EXPRESSION TYPES (TOP 25 PATTERNS)
// ============================================================================

export type IRExpr =
  // Literals
  | IRLiteralNull
  | IRLiteralBool
  | IRLiteralNumber
  | IRLiteralString
  | IRLiteralRegex
  | IRLiteralList
  | IRLiteralMap
  // Variables & Access
  | IRVariable
  | IRPropertyAccess
  | IRIndexAccess
  // Existence (Pattern 1: x != null, x == null)
  | IRExistence
  // Comparison (Pattern 3: >, >=, <, <=)
  | IRComparison
  // Equality
  | IREqualityCheck
  // String operations (Pattern 2: length > 0, matches, includes)
  | IRStringLength
  | IRStringMatches
  | IRStringIncludes
  | IRStringStartsWith
  | IRStringEndsWith
  // Number operations (Pattern 3 continued: between)
  | IRBetween
  // Enum/Set operations (Pattern 4: in [...], not in [...])
  | IRInSet
  // Boolean operations (Pattern 5: &&, ||, !)
  | IRLogicalAnd
  | IRLogicalOr
  | IRLogicalNot
  | IRLogicalImplies
  // Array operations (Pattern 7: items.length > 0)
  | IRArrayLength
  | IRArrayIncludes
  | IRArrayEvery
  | IRArraySome
  | IRArrayFilter
  | IRArrayMap
  // Quantifiers
  | IRQuantifierAll
  | IRQuantifierAny
  | IRQuantifierNone
  | IRQuantifierCount
  // Arithmetic
  | IRArithmetic
  // Conditional
  | IRConditional
  // Special ISL expressions
  | IROldValue
  | IRResultValue
  | IRInputValue
  // Function calls
  | IRFunctionCall
  // Entity operations
  | IREntityExists
  | IREntityLookup
  | IREntityCount;

// ============================================================================
// LITERAL TYPES
// ============================================================================

export interface IRLiteralNull extends IRNode {
  readonly kind: 'LiteralNull';
}

export interface IRLiteralBool extends IRNode {
  readonly kind: 'LiteralBool';
  readonly value: boolean;
}

export interface IRLiteralNumber extends IRNode {
  readonly kind: 'LiteralNumber';
  readonly value: number;
}

export interface IRLiteralString extends IRNode {
  readonly kind: 'LiteralString';
  readonly value: string;
}

export interface IRLiteralRegex extends IRNode {
  readonly kind: 'LiteralRegex';
  readonly pattern: string;
  readonly flags: string;
}

export interface IRLiteralList extends IRNode {
  readonly kind: 'LiteralList';
  readonly elements: readonly IRExpr[];
}

export interface IRLiteralMap extends IRNode {
  readonly kind: 'LiteralMap';
  readonly entries: readonly { key: string; value: IRExpr }[];
}

// ============================================================================
// VARIABLE & ACCESS
// ============================================================================

export interface IRVariable extends IRNode {
  readonly kind: 'Variable';
  readonly name: string;
}

export interface IRPropertyAccess extends IRNode {
  readonly kind: 'PropertyAccess';
  readonly object: IRExpr;
  readonly property: string;
}

export interface IRIndexAccess extends IRNode {
  readonly kind: 'IndexAccess';
  readonly object: IRExpr;
  readonly index: IRExpr;
}

// ============================================================================
// PATTERN 1: EXISTENCE CHECKS (x != null, x == null)
// ============================================================================

export interface IRExistence extends IRNode {
  readonly kind: 'Existence';
  readonly target: IRExpr;
  readonly exists: boolean; // true = "!= null", false = "== null"
}

// ============================================================================
// PATTERN 2: STRING OPERATIONS
// ============================================================================

export interface IRStringLength extends IRNode {
  readonly kind: 'StringLength';
  readonly target: IRExpr;
}

export interface IRStringMatches extends IRNode {
  readonly kind: 'StringMatches';
  readonly target: IRExpr;
  readonly pattern: IRExpr; // Can be string or regex literal
}

export interface IRStringIncludes extends IRNode {
  readonly kind: 'StringIncludes';
  readonly target: IRExpr;
  readonly substring: IRExpr;
}

export interface IRStringStartsWith extends IRNode {
  readonly kind: 'StringStartsWith';
  readonly target: IRExpr;
  readonly prefix: IRExpr;
}

export interface IRStringEndsWith extends IRNode {
  readonly kind: 'StringEndsWith';
  readonly target: IRExpr;
  readonly suffix: IRExpr;
}

// ============================================================================
// PATTERN 3: NUMBER COMPARISONS
// ============================================================================

export type ComparisonOperator = '<' | '<=' | '>' | '>=';

export interface IRComparison extends IRNode {
  readonly kind: 'Comparison';
  readonly operator: ComparisonOperator;
  readonly left: IRExpr;
  readonly right: IRExpr;
}

export interface IRBetween extends IRNode {
  readonly kind: 'Between';
  readonly target: IRExpr;
  readonly min: IRExpr;
  readonly max: IRExpr;
  readonly inclusive: boolean;
}

// ============================================================================
// EQUALITY CHECK
// ============================================================================

export interface IREqualityCheck extends IRNode {
  readonly kind: 'EqualityCheck';
  readonly left: IRExpr;
  readonly right: IRExpr;
  readonly negated: boolean; // true = !=, false = ==
}

// ============================================================================
// PATTERN 4: ENUM/SET MEMBERSHIP
// ============================================================================

export interface IRInSet extends IRNode {
  readonly kind: 'InSet';
  readonly target: IRExpr;
  readonly values: readonly IRExpr[];
  readonly negated: boolean; // true = "not in", false = "in"
}

// ============================================================================
// PATTERN 5: BOOLEAN OPERATIONS
// ============================================================================

export interface IRLogicalAnd extends IRNode {
  readonly kind: 'LogicalAnd';
  /** Operands are sorted for deterministic ordering */
  readonly operands: readonly IRExpr[];
}

export interface IRLogicalOr extends IRNode {
  readonly kind: 'LogicalOr';
  /** Operands are sorted for deterministic ordering */
  readonly operands: readonly IRExpr[];
}

export interface IRLogicalNot extends IRNode {
  readonly kind: 'LogicalNot';
  readonly operand: IRExpr;
}

export interface IRLogicalImplies extends IRNode {
  readonly kind: 'LogicalImplies';
  readonly antecedent: IRExpr;
  readonly consequent: IRExpr;
}

// ============================================================================
// PATTERN 7: ARRAY OPERATIONS
// ============================================================================

export interface IRArrayLength extends IRNode {
  readonly kind: 'ArrayLength';
  readonly target: IRExpr;
}

export interface IRArrayIncludes extends IRNode {
  readonly kind: 'ArrayIncludes';
  readonly target: IRExpr;
  readonly element: IRExpr;
}

export interface IRArrayEvery extends IRNode {
  readonly kind: 'ArrayEvery';
  readonly target: IRExpr;
  readonly variable: string;
  readonly predicate: IRExpr;
}

export interface IRArraySome extends IRNode {
  readonly kind: 'ArraySome';
  readonly target: IRExpr;
  readonly variable: string;
  readonly predicate: IRExpr;
}

export interface IRArrayFilter extends IRNode {
  readonly kind: 'ArrayFilter';
  readonly target: IRExpr;
  readonly variable: string;
  readonly predicate: IRExpr;
}

export interface IRArrayMap extends IRNode {
  readonly kind: 'ArrayMap';
  readonly target: IRExpr;
  readonly variable: string;
  readonly mapper: IRExpr;
}

// ============================================================================
// QUANTIFIERS
// ============================================================================

export interface IRQuantifierAll extends IRNode {
  readonly kind: 'QuantifierAll';
  readonly collection: IRExpr;
  readonly variable: string;
  readonly predicate: IRExpr;
}

export interface IRQuantifierAny extends IRNode {
  readonly kind: 'QuantifierAny';
  readonly collection: IRExpr;
  readonly variable: string;
  readonly predicate: IRExpr;
}

export interface IRQuantifierNone extends IRNode {
  readonly kind: 'QuantifierNone';
  readonly collection: IRExpr;
  readonly variable: string;
  readonly predicate: IRExpr;
}

export interface IRQuantifierCount extends IRNode {
  readonly kind: 'QuantifierCount';
  readonly collection: IRExpr;
  readonly variable: string;
  readonly predicate: IRExpr;
}

// ============================================================================
// ARITHMETIC
// ============================================================================

export type ArithmeticOperator = '+' | '-' | '*' | '/' | '%';

export interface IRArithmetic extends IRNode {
  readonly kind: 'Arithmetic';
  readonly operator: ArithmeticOperator;
  readonly left: IRExpr;
  readonly right: IRExpr;
}

// ============================================================================
// CONDITIONAL
// ============================================================================

export interface IRConditional extends IRNode {
  readonly kind: 'Conditional';
  readonly condition: IRExpr;
  readonly thenBranch: IRExpr;
  readonly elseBranch: IRExpr;
}

// ============================================================================
// SPECIAL ISL EXPRESSIONS
// ============================================================================

export interface IROldValue extends IRNode {
  readonly kind: 'OldValue';
  readonly expression: IRExpr;
}

export interface IRResultValue extends IRNode {
  readonly kind: 'ResultValue';
  readonly property?: string;
}

export interface IRInputValue extends IRNode {
  readonly kind: 'InputValue';
  readonly property: string;
}

// ============================================================================
// FUNCTION CALLS
// ============================================================================

export interface IRFunctionCall extends IRNode {
  readonly kind: 'FunctionCall';
  readonly name: string;
  readonly args: readonly IRExpr[];
}

// ============================================================================
// ENTITY OPERATIONS
// ============================================================================

export interface IREntityExists extends IRNode {
  readonly kind: 'EntityExists';
  readonly entityName: string;
  readonly criteria?: IRExpr;
}

export interface IREntityLookup extends IRNode {
  readonly kind: 'EntityLookup';
  readonly entityName: string;
  readonly criteria: IRExpr;
}

export interface IREntityCount extends IRNode {
  readonly kind: 'EntityCount';
  readonly entityName: string;
  readonly criteria?: IRExpr;
}

// ============================================================================
// IR UTILITIES
// ============================================================================

let nodeIdCounter = 0;

export function generateNodeId(): string {
  return `ir_${++nodeIdCounter}`;
}

export function resetNodeIdCounter(): void {
  nodeIdCounter = 0;
}

// ============================================================================
// IR BUILDERS (Type-safe constructors)
// ============================================================================

export const IR = {
  null(loc?: IRSourceLoc): IRLiteralNull {
    return { kind: 'LiteralNull', id: generateNodeId(), loc };
  },

  bool(value: boolean, loc?: IRSourceLoc): IRLiteralBool {
    return { kind: 'LiteralBool', id: generateNodeId(), value, loc };
  },

  number(value: number, loc?: IRSourceLoc): IRLiteralNumber {
    return { kind: 'LiteralNumber', id: generateNodeId(), value, loc };
  },

  string(value: string, loc?: IRSourceLoc): IRLiteralString {
    return { kind: 'LiteralString', id: generateNodeId(), value, loc };
  },

  regex(pattern: string, flags = '', loc?: IRSourceLoc): IRLiteralRegex {
    return { kind: 'LiteralRegex', id: generateNodeId(), pattern, flags, loc };
  },

  list(elements: IRExpr[], loc?: IRSourceLoc): IRLiteralList {
    return { kind: 'LiteralList', id: generateNodeId(), elements, loc };
  },

  map(entries: { key: string; value: IRExpr }[], loc?: IRSourceLoc): IRLiteralMap {
    return { kind: 'LiteralMap', id: generateNodeId(), entries, loc };
  },

  variable(name: string, loc?: IRSourceLoc): IRVariable {
    return { kind: 'Variable', id: generateNodeId(), name, loc };
  },

  prop(object: IRExpr, property: string, loc?: IRSourceLoc): IRPropertyAccess {
    return { kind: 'PropertyAccess', id: generateNodeId(), object, property, loc };
  },

  index(object: IRExpr, index: IRExpr, loc?: IRSourceLoc): IRIndexAccess {
    return { kind: 'IndexAccess', id: generateNodeId(), object, index, loc };
  },

  exists(target: IRExpr, exists = true, loc?: IRSourceLoc): IRExistence {
    return { kind: 'Existence', id: generateNodeId(), target, exists, loc };
  },

  compare(
    operator: ComparisonOperator,
    left: IRExpr,
    right: IRExpr,
    loc?: IRSourceLoc
  ): IRComparison {
    return { kind: 'Comparison', id: generateNodeId(), operator, left, right, loc };
  },

  eq(left: IRExpr, right: IRExpr, negated = false, loc?: IRSourceLoc): IREqualityCheck {
    return { kind: 'EqualityCheck', id: generateNodeId(), left, right, negated, loc };
  },

  strLen(target: IRExpr, loc?: IRSourceLoc): IRStringLength {
    return { kind: 'StringLength', id: generateNodeId(), target, loc };
  },

  strMatches(target: IRExpr, pattern: IRExpr, loc?: IRSourceLoc): IRStringMatches {
    return { kind: 'StringMatches', id: generateNodeId(), target, pattern, loc };
  },

  strIncludes(target: IRExpr, substring: IRExpr, loc?: IRSourceLoc): IRStringIncludes {
    return { kind: 'StringIncludes', id: generateNodeId(), target, substring, loc };
  },

  strStartsWith(target: IRExpr, prefix: IRExpr, loc?: IRSourceLoc): IRStringStartsWith {
    return { kind: 'StringStartsWith', id: generateNodeId(), target, prefix, loc };
  },

  strEndsWith(target: IRExpr, suffix: IRExpr, loc?: IRSourceLoc): IRStringEndsWith {
    return { kind: 'StringEndsWith', id: generateNodeId(), target, suffix, loc };
  },

  between(
    target: IRExpr,
    min: IRExpr,
    max: IRExpr,
    inclusive = true,
    loc?: IRSourceLoc
  ): IRBetween {
    return { kind: 'Between', id: generateNodeId(), target, min, max, inclusive, loc };
  },

  inSet(target: IRExpr, values: IRExpr[], negated = false, loc?: IRSourceLoc): IRInSet {
    return { kind: 'InSet', id: generateNodeId(), target, values, negated, loc };
  },

  and(operands: IRExpr[], loc?: IRSourceLoc): IRLogicalAnd {
    return { kind: 'LogicalAnd', id: generateNodeId(), operands, loc };
  },

  or(operands: IRExpr[], loc?: IRSourceLoc): IRLogicalOr {
    return { kind: 'LogicalOr', id: generateNodeId(), operands, loc };
  },

  not(operand: IRExpr, loc?: IRSourceLoc): IRLogicalNot {
    return { kind: 'LogicalNot', id: generateNodeId(), operand, loc };
  },

  implies(antecedent: IRExpr, consequent: IRExpr, loc?: IRSourceLoc): IRLogicalImplies {
    return { kind: 'LogicalImplies', id: generateNodeId(), antecedent, consequent, loc };
  },

  arrayLen(target: IRExpr, loc?: IRSourceLoc): IRArrayLength {
    return { kind: 'ArrayLength', id: generateNodeId(), target, loc };
  },

  arrayIncludes(target: IRExpr, element: IRExpr, loc?: IRSourceLoc): IRArrayIncludes {
    return { kind: 'ArrayIncludes', id: generateNodeId(), target, element, loc };
  },

  arrayEvery(
    target: IRExpr,
    variable: string,
    predicate: IRExpr,
    loc?: IRSourceLoc
  ): IRArrayEvery {
    return { kind: 'ArrayEvery', id: generateNodeId(), target, variable, predicate, loc };
  },

  arraySome(
    target: IRExpr,
    variable: string,
    predicate: IRExpr,
    loc?: IRSourceLoc
  ): IRArraySome {
    return { kind: 'ArraySome', id: generateNodeId(), target, variable, predicate, loc };
  },

  arrayFilter(
    target: IRExpr,
    variable: string,
    predicate: IRExpr,
    loc?: IRSourceLoc
  ): IRArrayFilter {
    return { kind: 'ArrayFilter', id: generateNodeId(), target, variable, predicate, loc };
  },

  arrayMap(
    target: IRExpr,
    variable: string,
    mapper: IRExpr,
    loc?: IRSourceLoc
  ): IRArrayMap {
    return { kind: 'ArrayMap', id: generateNodeId(), target, variable, mapper, loc };
  },

  quantAll(
    collection: IRExpr,
    variable: string,
    predicate: IRExpr,
    loc?: IRSourceLoc
  ): IRQuantifierAll {
    return { kind: 'QuantifierAll', id: generateNodeId(), collection, variable, predicate, loc };
  },

  quantAny(
    collection: IRExpr,
    variable: string,
    predicate: IRExpr,
    loc?: IRSourceLoc
  ): IRQuantifierAny {
    return { kind: 'QuantifierAny', id: generateNodeId(), collection, variable, predicate, loc };
  },

  quantNone(
    collection: IRExpr,
    variable: string,
    predicate: IRExpr,
    loc?: IRSourceLoc
  ): IRQuantifierNone {
    return { kind: 'QuantifierNone', id: generateNodeId(), collection, variable, predicate, loc };
  },

  quantCount(
    collection: IRExpr,
    variable: string,
    predicate: IRExpr,
    loc?: IRSourceLoc
  ): IRQuantifierCount {
    return { kind: 'QuantifierCount', id: generateNodeId(), collection, variable, predicate, loc };
  },

  arithmetic(
    operator: ArithmeticOperator,
    left: IRExpr,
    right: IRExpr,
    loc?: IRSourceLoc
  ): IRArithmetic {
    return { kind: 'Arithmetic', id: generateNodeId(), operator, left, right, loc };
  },

  conditional(
    condition: IRExpr,
    thenBranch: IRExpr,
    elseBranch: IRExpr,
    loc?: IRSourceLoc
  ): IRConditional {
    return { kind: 'Conditional', id: generateNodeId(), condition, thenBranch, elseBranch, loc };
  },

  old(expression: IRExpr, loc?: IRSourceLoc): IROldValue {
    return { kind: 'OldValue', id: generateNodeId(), expression, loc };
  },

  result(property?: string, loc?: IRSourceLoc): IRResultValue {
    return { kind: 'ResultValue', id: generateNodeId(), property, loc };
  },

  input(property: string, loc?: IRSourceLoc): IRInputValue {
    return { kind: 'InputValue', id: generateNodeId(), property, loc };
  },

  call(name: string, args: IRExpr[], loc?: IRSourceLoc): IRFunctionCall {
    return { kind: 'FunctionCall', id: generateNodeId(), name, args, loc };
  },

  entityExists(entityName: string, criteria?: IRExpr, loc?: IRSourceLoc): IREntityExists {
    return { kind: 'EntityExists', id: generateNodeId(), entityName, criteria, loc };
  },

  entityLookup(entityName: string, criteria: IRExpr, loc?: IRSourceLoc): IREntityLookup {
    return { kind: 'EntityLookup', id: generateNodeId(), entityName, criteria, loc };
  },

  entityCount(entityName: string, criteria?: IRExpr, loc?: IRSourceLoc): IREntityCount {
    return { kind: 'EntityCount', id: generateNodeId(), entityName, criteria, loc };
  },
} as const;

// ============================================================================
// PATTERN CATEGORIES (for documentation)
// ============================================================================

export const SUPPORTED_PATTERNS = {
  existence: ['x != null', 'x == null'],
  string: ['length > 0', 'matches(regex)', 'includes(str)', 'startsWith(str)', 'endsWith(str)'],
  number: ['>', '>=', '<', '<=', 'between(min, max)'],
  enums: ['in ["a","b"]', 'not in [...]'],
  boolean: ['&&', '||', '!', 'implies'],
  propertyChains: ['result.user.id != null', 'a.b.c'],
  array: ['items.length > 0', 'includes(x)', 'every()', 'some()', 'filter()'],
  statusChecks: ['status in ["succeeded","paid"]'],
  sanity: ['no PII in logs (audit flags)'],
  quantifiers: ['all(x in xs, pred)', 'any(x in xs, pred)', 'none(x in xs, pred)'],
  entity: ['Entity.exists()', 'Entity.lookup()', 'Entity.count()'],
  special: ['old(expr)', 'result', 'input.field'],
} as const;
