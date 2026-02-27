/**
 * ISL Expression Encoder
 * 
 * Encodes ISL AST expressions to SMT expressions.
 * Supports:
 * - Boolean logic (and, or, not, implies, iff)
 * - Arithmetic (comparisons, +, -, *, /)
 * - Null encoding (is_null boolean flags for nullable variables)
 * - Enums as finite sorts with distinct constants
 * - Strings with native str.len length constraints
 * - Uninterpreted functions for Entity.lookup, Entity.exists
 * - Quantifiers (all/forall, some/exists, none)
 * - old() pre/post state splitting
 * - Member access (simple and nested)
 */

import type {
  Expression,
  Identifier,
  BooleanLiteral,
  NumberLiteral,
  StringLiteral,
  NullLiteral,
  BinaryExpression,
  UnaryExpression,
  ComparisonExpression,
  LogicalExpression,
  QuantifiedExpression,
  MemberExpression,
  CallExpression,
  OldExpression,
  ConditionStatement,
  TypeConstraint,
} from '@isl-lang/isl-core/ast';
import { Expr, Sort, Decl, type SMTExpr, type SMTSort, type SMTDecl } from '@isl-lang/prover';

// ============================================================================
// Context & Result Types
// ============================================================================

/**
 * Encoding context - tracks variable types, enums, and scope
 */
export interface EncodingContext {
  /** Variable name -> sort mapping */
  variables: Map<string, SMTSort>;
  /** Entity field types (entity.field -> sort) */
  fieldTypes: Map<string, SMTSort>;
  /** Whether we're inside an old() expression */
  inOldContext: boolean;
  /** Bound quantifier variables */
  boundVars: Set<string>;
  /** Registered enum types: enum name -> variant names */
  enumTypes: Map<string, string[]>;
  /** Reverse lookup: variant name -> enum type name */
  enumVariants: Map<string, string>;
  /** Accumulated SMT declarations (enum sorts, constants, distinctness) */
  declarations: SMTDecl[];
}

/**
 * Create empty encoding context
 */
export function createContext(): EncodingContext {
  return {
    variables: new Map(),
    fieldTypes: new Map(),
    inOldContext: false,
    boundVars: new Set(),
    enumTypes: new Map(),
    enumVariants: new Map(),
    declarations: [],
  };
}

/**
 * Expression encoding result
 */
export type EncodeResult = {
  success: true;
  expr: SMTExpr;
} | {
  success: false;
  error: string;
  unsupportedFeature?: string;
};

// ============================================================================
// Enum Registration
// ============================================================================

/**
 * Register an enum type as a finite SMT sort with distinct constants.
 *
 * Generates:
 * - (declare-sort EnumName 0)
 * - (declare-const EnumName_VARIANT EnumName) for each variant
 * - (assert (distinct EnumName_V1 EnumName_V2 ...))
 * - (assert (forall ((x EnumName)) (or (= x V1) (= x V2) ...))) — exhaustiveness
 */
export function registerEnum(
  enumName: string,
  variants: string[],
  ctx: EncodingContext
): void {
  ctx.enumTypes.set(enumName, [...variants]);
  for (const v of variants) {
    // Last registration wins for ambiguous variant names
    ctx.enumVariants.set(v, enumName);
  }

  const sort = Sort.Uninterpreted(enumName);

  // Declare the sort
  ctx.declarations.push(Decl.sort(enumName, 0));

  // Declare each variant as a constant of that sort
  for (const v of variants) {
    ctx.declarations.push(Decl.const(`${enumName}_${v}`, sort));
  }

  // Assert all variants are distinct
  if (variants.length > 1) {
    const varExprs = variants.map(v => Expr.var(`${enumName}_${v}`, sort));
    ctx.declarations.push(Decl.assert(Expr.distinct(...varExprs)));
  }

  // Assert exhaustiveness: forall x of this sort, x equals one of the variants
  if (variants.length > 0) {
    const x = Expr.var('__enum_x', sort);
    const options = variants.map(v =>
      Expr.eq(x, Expr.var(`${enumName}_${v}`, sort))
    );
    const exhaustive = options.length === 1 ? options[0]! : Expr.or(...options);
    ctx.declarations.push(
      Decl.assert(Expr.forall([{ name: '__enum_x', sort }], exhaustive))
    );
  }
}

// ============================================================================
// Pre/Post State Split
// ============================================================================

/**
 * Create separate pre-state and post-state encoding contexts from a base context.
 *
 * Used for postcondition verification where:
 * - Post context has current-state variables and old() references to pre-state
 * - Pre declarations introduce old_ prefixed versions of all variables
 *
 * @returns preCtx, postCtx, and preDeclarations that must be asserted
 */
export function createPrePostContext(
  baseCtx: EncodingContext
): { preCtx: EncodingContext; postCtx: EncodingContext; preDeclarations: SMTDecl[] } {
  const preDeclarations: SMTDecl[] = [];

  // Post context: normal variables are post-state, old() accesses pre-state
  const postCtx: EncodingContext = {
    ...baseCtx,
    variables: new Map(baseCtx.variables),
    fieldTypes: new Map(baseCtx.fieldTypes),
    boundVars: new Set(baseCtx.boundVars),
    inOldContext: false,
    declarations: [...baseCtx.declarations],
  };

  // Pre context: all variables refer to pre-state
  const preCtx: EncodingContext = {
    ...baseCtx,
    variables: new Map(),
    fieldTypes: new Map(),
    boundVars: new Set(baseCtx.boundVars),
    inOldContext: false,
    declarations: [...baseCtx.declarations],
  };

  // For each variable, create old_ prefixed pre-state version
  for (const [name, sort] of baseCtx.variables) {
    // Pre context uses old_ prefix
    preCtx.variables.set(name, sort);
    preDeclarations.push(Decl.const(`old_${name}`, sort));

    // Post context also knows about old_ variables
    postCtx.variables.set(`old_${name}`, sort);
  }

  // Same for field types
  for (const [key, sort] of baseCtx.fieldTypes) {
    preCtx.fieldTypes.set(key, sort);

    // Compute old_ field key: "Entity.field" -> "old_Entity_field" reference
    const oldKey = key.replace('.', '_');
    preDeclarations.push(Decl.const(`old_${oldKey}`, sort));
  }

  return { preCtx, postCtx, preDeclarations };
}

// ============================================================================
// ISL Type → SMT Sort
// ============================================================================

/**
 * ISL type name to SMT sort mapping
 */
export function islTypeToSort(typeName: string): SMTSort {
  const normalized = typeName.toLowerCase().trim();

  switch (normalized) {
    case 'int':
    case 'integer':
    case 'i32':
    case 'i64':
      return Sort.Int();

    case 'decimal':
    case 'float':
    case 'real':
    case 'f32':
    case 'f64':
    case 'money':
    case 'currency':
      return Sort.Real();

    case 'bool':
    case 'boolean':
      return Sort.Bool();

    case 'string':
    case 'text':
    case 'email':
    case 'url':
    case 'uuid':
      return Sort.String();

    default:
      // For complex types, use uninterpreted sort
      return Sort.Uninterpreted(typeName);
  }
}

// ============================================================================
// Public Encoding Entry Points
// ============================================================================

/**
 * Encode an ISL expression to SMT
 */
export function encodeExpression(
  expr: Expression,
  ctx: EncodingContext
): EncodeResult {
  try {
    const result = encode(expr, ctx);
    return { success: true, expr: result };
  } catch (error) {
    if (error instanceof UnsupportedFeatureError) {
      return {
        success: false,
        error: error.message,
        unsupportedFeature: error.feature,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Encode a condition statement
 */
export function encodeCondition(
  condition: ConditionStatement,
  ctx: EncodingContext
): EncodeResult {
  return encodeExpression(condition.expression, ctx);
}

/**
 * Encode a type constraint (for refinement types)
 */
export function encodeTypeConstraint(
  constraint: TypeConstraint,
  variableName: string,
  ctx: EncodingContext
): EncodeResult {
  const constraintName = constraint.name.name;
  const varSort = ctx.variables.get(variableName) ?? Sort.Int();
  const v = Expr.var(variableName, varSort);

  switch (constraintName) {
    case 'min':
      if (constraint.value) {
        const minVal = encodeExpression(constraint.value, ctx);
        if (!minVal.success) return minVal;
        return { success: true, expr: Expr.ge(v, minVal.expr) };
      }
      break;

    case 'max':
      if (constraint.value) {
        const maxVal = encodeExpression(constraint.value, ctx);
        if (!maxVal.success) return maxVal;
        return { success: true, expr: Expr.le(v, maxVal.expr) };
      }
      break;

    case 'positive':
      return { success: true, expr: Expr.gt(v, Expr.int(0)) };

    case 'non_negative':
      return { success: true, expr: Expr.ge(v, Expr.int(0)) };

    case 'negative':
      return { success: true, expr: Expr.lt(v, Expr.int(0)) };

    case 'min_length':
      if (constraint.value) {
        const minLen = encodeExpression(constraint.value, ctx);
        if (!minLen.success) return minLen;
        return { success: true, expr: Expr.ge(Expr.apply('str.len', v), minLen.expr) };
      }
      break;

    case 'max_length':
      if (constraint.value) {
        const maxLen = encodeExpression(constraint.value, ctx);
        if (!maxLen.success) return maxLen;
        return { success: true, expr: Expr.le(Expr.apply('str.len', v), maxLen.expr) };
      }
      break;

    case 'not_empty':
      return { success: true, expr: Expr.gt(Expr.apply('str.len', v), Expr.int(0)) };
  }

  // For unknown constraints, encode the value expression if present
  if (constraint.value) {
    return encodeExpression(constraint.value, ctx);
  }

  return {
    success: false,
    error: `Cannot encode constraint '${constraintName}'`,
    unsupportedFeature: `constraint:${constraintName}`,
  };
}

// ============================================================================
// Internal Error Type
// ============================================================================

/**
 * Error for unsupported features
 */
class UnsupportedFeatureError extends Error {
  constructor(public feature: string, message: string) {
    super(message);
    this.name = 'UnsupportedFeatureError';
  }
}

// ============================================================================
// Internal Encode Dispatch
// ============================================================================

/**
 * Internal encode function - dispatches on expression kind
 */
function encode(expr: Expression, ctx: EncodingContext): SMTExpr {
  switch (expr.kind) {
    case 'BooleanLiteral':
      return Expr.bool(expr.value);

    case 'NumberLiteral':
      if (Number.isInteger(expr.value)) {
        return Expr.int(expr.value);
      }
      return Expr.real(expr.value);

    case 'StringLiteral':
      return Expr.string(expr.value);

    case 'NullLiteral':
      return encodeNullLiteral();

    case 'DurationLiteral':
      const ms = durationToMs(expr.value, expr.unit);
      return Expr.int(ms);

    case 'Identifier':
      return encodeIdentifier(expr, ctx);

    case 'BinaryExpression':
      return encodeBinaryExpression(expr, ctx);

    case 'UnaryExpression':
      return encodeUnaryExpression(expr, ctx);

    case 'ComparisonExpression':
      return encodeComparisonExpression(expr, ctx);

    case 'LogicalExpression':
      return encodeLogicalExpression(expr, ctx);

    case 'QuantifiedExpression':
      return encodeQuantifiedExpression(expr, ctx);

    case 'MemberExpression':
      return encodeMemberExpression(expr, ctx);

    case 'CallExpression':
      return encodeCallExpression(expr, ctx);

    case 'OldExpression':
      return encodeOldExpression(expr, ctx);

    default: {
      const unknownExpr = expr as { kind: string };
      throw new UnsupportedFeatureError(
        unknownExpr.kind,
        `Expression kind '${unknownExpr.kind}' not supported in SMT encoding`
      );
    }
  }
}

// ============================================================================
// Null Encoding
// ============================================================================

/**
 * Encode a standalone NullLiteral.
 *
 * Produces an uninterpreted constant `__null__` of sort `Null`.
 * Null comparisons (== null, != null) are intercepted at the comparison
 * level and encoded as `is_null_<varname>` boolean flags instead.
 */
function encodeNullLiteral(): SMTExpr {
  return Expr.var('__null__', Sort.Uninterpreted('Null'));
}

/**
 * Try to encode a null comparison pattern:
 *   x == null  →  is_null_<flatName>
 *   x != null  →  (not is_null_<flatName>)
 *
 * Returns null if neither side is a NullLiteral.
 */
function tryEncodeNullComparison(
  left: Expression,
  right: Expression,
  negate: boolean,
  ctx: EncodingContext
): SMTExpr | null {
  let nonNullSide: Expression | null = null;

  if (right.kind === 'NullLiteral') {
    nonNullSide = left;
  } else if (left.kind === 'NullLiteral') {
    nonNullSide = right;
  }

  if (!nonNullSide) return null;

  const varName = flattenExprToName(nonNullSide, ctx);
  if (!varName) {
    // Can't flatten to a name; fall back to encoding both sides normally.
    // The NullLiteral side will become __null__ uninterpreted constant.
    return null;
  }

  const isNullVar = Expr.var(`is_null_${varName}`, Sort.Bool());
  return negate ? Expr.not(isNullVar) : isNullVar;
}

/**
 * Flatten an expression to a variable name string for null-check naming.
 *   Identifier('x')                         → 'x'
 *   MemberExpression(Identifier('a'), 'b')  → 'a_b'
 *   OldExpression(Identifier('x'))          → 'old_x'
 *   Other                                   → null (can't flatten)
 */
function flattenExprToName(expr: Expression, ctx: EncodingContext): string | null {
  const prefix = ctx.inOldContext ? 'old_' : '';
  switch (expr.kind) {
    case 'Identifier':
      return `${prefix}${expr.name}`;
    case 'MemberExpression':
      if (expr.object.kind === 'Identifier') {
        return `${prefix}${expr.object.name}_${expr.property.name}`;
      }
      return null;
    case 'OldExpression':
      const inner = flattenExprToName(expr.expression, ctx);
      return inner ? `old_${inner}` : null;
    default:
      return null;
  }
}

// ============================================================================
// Identifier Encoding (with enum variant resolution)
// ============================================================================

/**
 * Encode identifier — resolves variables, special keywords, and enum variants.
 */
function encodeIdentifier(expr: Identifier, ctx: EncodingContext): SMTExpr {
  const name = expr.name;

  // 1. Known variable (takes precedence over enum variants)
  const sort = ctx.variables.get(name);
  if (sort) {
    const varName = ctx.inOldContext ? `old_${name}` : name;
    return Expr.var(varName, sort);
  }

  // 2. Special keywords
  if (name === 'result') {
    const resultSort = ctx.variables.get('__result__') ?? Sort.Bool();
    return Expr.var('result', resultSort);
  }

  if (name === 'true') return Expr.bool(true);
  if (name === 'false') return Expr.bool(false);
  if (name === 'null') return encodeNullLiteral();

  // 3. Registered enum variant
  const enumType = ctx.enumVariants.get(name);
  if (enumType) {
    return Expr.var(`${enumType}_${name}`, Sort.Uninterpreted(enumType));
  }

  // 4. Default: treat as boolean variable
  return Expr.var(name, Sort.Bool());
}

// ============================================================================
// Binary Expression Encoding
// ============================================================================

/**
 * Encode binary expression (+, -, *, /, %, and, or, implies, iff, ==, !=, <, <=, >, >=, in)
 */
function encodeBinaryExpression(expr: BinaryExpression, ctx: EncodingContext): SMTExpr {
  // Intercept null comparisons before encoding both sides
  if (expr.operator === '==' || expr.operator === '!=') {
    const nullCheck = tryEncodeNullComparison(
      expr.left, expr.right, expr.operator === '!=', ctx
    );
    if (nullCheck) return nullCheck;
  }

  const left = encode(expr.left, ctx);
  const right = encode(expr.right, ctx);

  switch (expr.operator) {
    case '+':
      return Expr.add(left, right);
    case '-':
      return Expr.sub(left, right);
    case '*':
      return Expr.mul(left, right);
    case '/':
      return Expr.div(left, right);
    case '%':
      return Expr.mod(left, right);
    case 'and':
      return Expr.and(left, right);
    case 'or':
      return Expr.or(left, right);
    case 'implies':
      return Expr.implies(left, right);
    case 'iff':
      return Expr.iff(left, right);
    case '==':
      return Expr.eq(left, right);
    case '!=':
      return Expr.neq(left, right);
    case '<':
      return Expr.lt(left, right);
    case '<=':
      return Expr.le(left, right);
    case '>':
      return Expr.gt(left, right);
    case '>=':
      return Expr.ge(left, right);
    case 'in':
      // Membership: x in collection → uninterpreted contains(collection, x)
      return Expr.apply('contains', right, left);
    default:
      throw new UnsupportedFeatureError(
        `operator:${expr.operator}`,
        `Binary operator '${expr.operator}' not supported in SMT encoding`
      );
  }
}

// ============================================================================
// Unary Expression Encoding
// ============================================================================

/**
 * Encode unary expression (not, -)
 */
function encodeUnaryExpression(expr: UnaryExpression, ctx: EncodingContext): SMTExpr {
  const operand = encode(expr.operand, ctx);

  switch (expr.operator) {
    case 'not':
      return Expr.not(operand);
    case '-':
      return Expr.neg(operand);
    default:
      throw new UnsupportedFeatureError(
        `operator:${expr.operator}`,
        `Unary operator '${expr.operator}' not supported in SMT encoding`
      );
  }
}

// ============================================================================
// Comparison Expression Encoding (with null interception)
// ============================================================================

/**
 * Encode comparison expression (==, !=, <, <=, >, >=)
 * Intercepts x == null / x != null patterns.
 */
function encodeComparisonExpression(expr: ComparisonExpression, ctx: EncodingContext): SMTExpr {
  // Intercept null comparisons
  if (expr.operator === '==' || expr.operator === '!=') {
    const nullCheck = tryEncodeNullComparison(
      expr.left, expr.right, expr.operator === '!=', ctx
    );
    if (nullCheck) return nullCheck;
  }

  const left = encode(expr.left, ctx);
  const right = encode(expr.right, ctx);

  switch (expr.operator) {
    case '==':
      return Expr.eq(left, right);
    case '!=':
      return Expr.neq(left, right);
    case '<':
      return Expr.lt(left, right);
    case '<=':
      return Expr.le(left, right);
    case '>':
      return Expr.gt(left, right);
    case '>=':
      return Expr.ge(left, right);
    default:
      throw new UnsupportedFeatureError(
        `operator:${expr.operator}`,
        `Comparison operator '${expr.operator}' not supported in SMT encoding`
      );
  }
}

// ============================================================================
// Logical Expression Encoding
// ============================================================================

/**
 * Encode logical expression (and, or)
 */
function encodeLogicalExpression(expr: LogicalExpression, ctx: EncodingContext): SMTExpr {
  const left = encode(expr.left, ctx);
  const right = encode(expr.right, ctx);

  switch (expr.operator) {
    case 'and':
      return Expr.and(left, right);
    case 'or':
      return Expr.or(left, right);
    default:
      throw new UnsupportedFeatureError(
        `operator:${expr.operator}`,
        `Logical operator '${expr.operator}' not supported in SMT encoding`
      );
  }
}

// ============================================================================
// Quantified Expression Encoding (forall / exists)
// ============================================================================

/**
 * Encode quantified expression (all → forall, some → exists, none → forall ¬)
 */
function encodeQuantifiedExpression(expr: QuantifiedExpression, ctx: EncodingContext): SMTExpr {
  const varName = expr.variable.name;

  // Create new context with bound variable
  const newCtx: EncodingContext = {
    ...ctx,
    variables: new Map(ctx.variables),
    boundVars: new Set(ctx.boundVars),
  };

  // Infer sort from collection type or field types
  const varSort = inferQuantifierSort(expr.collection, varName, ctx);
  newCtx.variables.set(varName, varSort);
  newCtx.boundVars.add(varName);

  // Encode predicate in the extended context
  const predicate = encode(expr.predicate, newCtx);

  // Encode collection constraint (range, array membership, etc.)
  const collectionConstraint = encodeCollectionConstraint(
    expr.collection, varName, varSort, ctx
  );

  const boundVars = [{ name: varName, sort: varSort }];

  switch (expr.quantifier) {
    case 'all':
      // forall x in C. P(x)  →  forall x. (x ∈ C) ⇒ P(x)
      if (collectionConstraint) {
        return Expr.forall(boundVars, Expr.implies(collectionConstraint, predicate));
      }
      return Expr.forall(boundVars, predicate);

    case 'some':
      // exists x in C. P(x)  →  exists x. (x ∈ C) ∧ P(x)
      if (collectionConstraint) {
        return Expr.exists(boundVars, Expr.and(collectionConstraint, predicate));
      }
      return Expr.exists(boundVars, predicate);

    case 'none':
      // none x in C. P(x)  →  forall x. (x ∈ C) ⇒ ¬P(x)
      if (collectionConstraint) {
        return Expr.forall(boundVars, Expr.implies(collectionConstraint, Expr.not(predicate)));
      }
      return Expr.forall(boundVars, Expr.not(predicate));

    default:
      throw new UnsupportedFeatureError(
        `quantifier:${expr.quantifier}`,
        `Quantifier '${expr.quantifier}' not supported in SMT encoding`
      );
  }
}

/**
 * Infer sort for quantifier variable from collection expression and context.
 *
 * Heuristics:
 * 1. If collection is a MemberExpression (e.g., input.items), look up the
 *    element type from fieldTypes (e.g., 'input.items' → Array sort → element).
 * 2. If collection is a range expression (1..10), use Int.
 * 3. Default to Int for unresolved collections.
 */
function inferQuantifierSort(
  collection: Expression,
  _varName: string,
  ctx: EncodingContext
): SMTSort {
  // Range expression (e.g., 1..10) → Int
  if (collection.kind === 'BinaryExpression' && collection.operator === '..') {
    return Sort.Int();
  }

  // Member expression: look up in fieldTypes
  if (collection.kind === 'MemberExpression' && collection.object.kind === 'Identifier') {
    const fieldKey = `${collection.object.name}.${collection.property.name}`;
    const fieldSort = ctx.fieldTypes.get(fieldKey);
    if (fieldSort) {
      // If the field is an Array sort, return the element sort
      if (fieldSort.kind === 'Array') {
        return fieldSort.element;
      }
      // If it's a Set, return the element sort
      if (fieldSort.kind === 'Set') {
        return fieldSort.element;
      }
    }
  }

  // Identifier: check if it maps to an array/set sort
  if (collection.kind === 'Identifier') {
    const collSort = ctx.variables.get(collection.name);
    if (collSort) {
      if (collSort.kind === 'Array') return collSort.element;
      if (collSort.kind === 'Set') return collSort.element;
    }
  }

  // Default to Int for numeric ranges / unknown collections
  return Sort.Int();
}

/**
 * Encode collection constraint for quantifier variable.
 *
 * Handles:
 * - Range expressions (1..10) → lower ≤ x ≤ upper
 * - Named collections → membership via uninterpreted contains
 */
function encodeCollectionConstraint(
  collection: Expression,
  varName: string,
  varSort: SMTSort,
  ctx: EncodingContext
): SMTExpr | null {
  // Range expression: 1..10  →  (and (>= x 1) (<= x 10))
  if (collection.kind === 'BinaryExpression' && collection.operator === '..') {
    const lower = encode(collection.left, ctx);
    const upper = encode(collection.right, ctx);
    const v = Expr.var(varName, varSort);

    return Expr.and(
      Expr.ge(v, lower),
      Expr.le(v, upper)
    );
  }

  // Named collection: generate membership constraint via uninterpreted function
  // e.g., for "item in input.items", constrain (contains input_items item)
  if (collection.kind === 'MemberExpression' || collection.kind === 'Identifier') {
    try {
      const collExpr = encode(collection, ctx);
      const v = Expr.var(varName, varSort);
      return Expr.apply('contains', collExpr, v);
    } catch {
      // If encoding fails, skip constraint
    }
  }

  return null;
}

// ============================================================================
// Member Expression Encoding (with .length and nested access)
// ============================================================================

/**
 * Encode member expression (object.property)
 *
 * Special cases:
 * - .length on strings → str.len (native SMT-LIB string length)
 * - .length on arrays/lists → len (uninterpreted function, Int result)
 * - result.field → result_field
 * - input.field → input_field
 * - Nested member on call result → field accessor function application
 */
function encodeMemberExpression(expr: MemberExpression, ctx: EncodingContext): SMTExpr {
  const propName = expr.property.name;

  // ---- .length property: native string length or uninterpreted array length ----
  if (propName === 'length') {
    return encodeLengthAccess(expr.object, ctx);
  }

  // ---- result.field ----
  if (expr.object.kind === 'Identifier' && expr.object.name === 'result') {
    const fieldKey = `result.${propName}`;
    const sort = ctx.fieldTypes.get(fieldKey) ?? Sort.Bool();
    return Expr.var(`result_${propName}`, sort);
  }

  // ---- Simple identifier.field (input.x, entity.y) ----
  if (expr.object.kind === 'Identifier') {
    const objName = expr.object.name;
    const fieldKey = `${objName}.${propName}`;
    const sort = ctx.fieldTypes.get(fieldKey) ?? ctx.variables.get(objName) ?? Sort.Bool();

    const prefix = ctx.inOldContext ? 'old_' : '';
    return Expr.var(`${prefix}${objName}_${propName}`, sort);
  }

  // ---- Nested member on call result: Entity.lookup(key).field ----
  if (expr.object.kind === 'CallExpression') {
    const callResult = encode(expr.object, ctx);
    return Expr.apply(`__field_${propName}`, callResult);
  }

  // ---- Nested member on member: a.b.c ----
  if (expr.object.kind === 'MemberExpression') {
    const innerObj = encode(expr.object, ctx);
    return Expr.apply(`__field_${propName}`, innerObj);
  }

  throw new UnsupportedFeatureError(
    'complex_member_access',
    `Complex member access not supported in SMT encoding`
  );
}

/**
 * Encode .length access.
 *
 * If the object is a string (by sort), uses native SMT-LIB `str.len`.
 * Otherwise uses the uninterpreted `len` function.
 */
function encodeLengthAccess(object: Expression, ctx: EncodingContext): SMTExpr {
  const objSort = inferExprSort(object, ctx);
  const objExpr = encode(object, ctx);

  if (objSort?.kind === 'String') {
    // Native SMT-LIB string length
    return Expr.apply('str.len', objExpr);
  }

  // Array / list / unknown: uninterpreted length function returning Int
  return Expr.apply('len', objExpr);
}

/**
 * Infer the SMT sort of an expression from context.
 * Returns null if the sort cannot be determined.
 */
function inferExprSort(expr: Expression, ctx: EncodingContext): SMTSort | null {
  switch (expr.kind) {
    case 'Identifier': {
      return ctx.variables.get(expr.name) ?? null;
    }
    case 'MemberExpression': {
      if (expr.object.kind === 'Identifier') {
        const fieldKey = `${expr.object.name}.${expr.property.name}`;
        return ctx.fieldTypes.get(fieldKey) ?? null;
      }
      return null;
    }
    case 'StringLiteral':
      return Sort.String();
    case 'NumberLiteral':
      return Number.isInteger(expr.value) ? Sort.Int() : Sort.Real();
    case 'BooleanLiteral':
      return Sort.Bool();
    default:
      return null;
  }
}

// ============================================================================
// Call Expression Encoding (with uninterpreted functions for lookups)
// ============================================================================

/**
 * Encode call expression.
 *
 * Built-in functions: abs, len/length, min, max
 * Entity methods: Entity.exists(key) → Entity_exists(key)
 *                 Entity.lookup(key) → Entity_lookup(key)
 *                 Entity.count → Entity_count (Int constant)
 * Other methods: encoded as uninterpreted functions
 */
function encodeCallExpression(expr: CallExpression, ctx: EncodingContext): SMTExpr {
  // ---- Built-in free functions ----
  if (expr.callee.kind === 'Identifier') {
    const funcName = expr.callee.name;

    switch (funcName) {
      case 'abs':
        if (expr.arguments.length === 1) {
          return Expr.abs(encode(expr.arguments[0]!, ctx));
        }
        break;

      case 'len':
      case 'length':
        if (expr.arguments.length === 1) {
          const arg = encode(expr.arguments[0]!, ctx);
          // Infer sort to choose str.len or uninterpreted len
          const argSort = inferExprSort(expr.arguments[0]!, ctx);
          if (argSort?.kind === 'String') {
            return Expr.apply('str.len', arg);
          }
          return Expr.apply('len', arg);
        }
        break;

      case 'min':
        if (expr.arguments.length === 2) {
          const a = encode(expr.arguments[0]!, ctx);
          const b = encode(expr.arguments[1]!, ctx);
          return Expr.ite(Expr.le(a, b), a, b);
        }
        break;

      case 'max':
        if (expr.arguments.length === 2) {
          const a = encode(expr.arguments[0]!, ctx);
          const b = encode(expr.arguments[1]!, ctx);
          return Expr.ite(Expr.ge(a, b), a, b);
        }
        break;

      case 'now':
        // now() is modeled as an uninterpreted Int constant (timestamp)
        return Expr.var('__now__', Sort.Int());

      default: {
        // Unknown free function: encode as uninterpreted function application
        const args = expr.arguments.map(a => encode(a, ctx));
        return Expr.apply(funcName, ...args);
      }
    }
  }

  // ---- Method calls: Entity.method(args) ----
  if (expr.callee.kind === 'MemberExpression') {
    const member = expr.callee;
    if (member.object.kind === 'Identifier') {
      const objName = member.object.name;
      const methodName = member.property.name;
      const prefix = ctx.inOldContext ? 'old_' : '';

      // Encode arguments
      const args = expr.arguments.map(a => encode(a, ctx));

      // Entity.exists(key) → Bool
      if (methodName === 'exists') {
        return Expr.apply(`${prefix}${objName}_exists`, ...args);
      }

      // Entity.lookup(key) → Uninterpreted Entity sort
      if (methodName === 'lookup') {
        return Expr.apply(`${prefix}${objName}_lookup`, ...args);
      }

      // Entity.count → Int (no args)
      if (methodName === 'count' && args.length === 0) {
        return Expr.var(`${prefix}${objName}_count`, Sort.Int());
      }

      // Entity.exists_by_<field>(value) → Bool
      if (methodName.startsWith('exists_by_')) {
        return Expr.apply(`${prefix}${objName}_${methodName}`, ...args);
      }

      // Generic method call → uninterpreted function
      return Expr.apply(`${prefix}${objName}_${methodName}`, ...args);
    }
  }

  // Fallback: try to encode callee and apply as generic function
  throw new UnsupportedFeatureError(
    'call_expression',
    `Call expression not fully supported in SMT encoding`
  );
}

// ============================================================================
// Old Expression Encoding (pre-state reference)
// ============================================================================

/**
 * Encode old() expression — switches to pre-state context.
 *
 * All variable and field references inside old() get prefixed with `old_`,
 * representing the pre-state value before the behavior executed.
 */
function encodeOldExpression(expr: OldExpression, ctx: EncodingContext): SMTExpr {
  const newCtx: EncodingContext = {
    ...ctx,
    inOldContext: true,
  };

  return encode(expr.expression, newCtx);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert duration to milliseconds
 */
function durationToMs(value: number, unit: 'ms' | 's' | 'm' | 'h' | 'd'): number {
  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
  }
}
