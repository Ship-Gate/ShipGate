/**
 * IR Normalization
 *
 * Provides deterministic normalization for commutative operations
 * to ensure stable, canonical IR representation.
 */

import type {
  IRExpr,
  IRLogicalAnd,
  IRLogicalOr,
  IRLiteralList,
  IRInSet,
} from './types.js';
import { IR, generateNodeId } from './types.js';

// ============================================================================
// NORMALIZATION VISITOR
// ============================================================================

/**
 * Normalize an IR expression for deterministic representation.
 * - Sorts operands of commutative operations (AND, OR)
 * - Flattens nested AND/OR operations
 * - Simplifies trivial expressions
 */
export function normalizeIR(expr: IRExpr): IRExpr {
  switch (expr.kind) {
    case 'LogicalAnd':
      return normalizeAnd(expr);
    case 'LogicalOr':
      return normalizeOr(expr);
    case 'LiteralList':
      return normalizeList(expr);
    case 'InSet':
      return normalizeInSet(expr);
    case 'LogicalNot':
      return IR.not(normalizeIR(expr.operand), expr.loc);
    case 'Comparison':
      return IR.compare(
        expr.operator,
        normalizeIR(expr.left),
        normalizeIR(expr.right),
        expr.loc
      );
    case 'EqualityCheck':
      return IR.eq(
        normalizeIR(expr.left),
        normalizeIR(expr.right),
        expr.negated,
        expr.loc
      );
    case 'PropertyAccess':
      return IR.prop(normalizeIR(expr.object), expr.property, expr.loc);
    case 'IndexAccess':
      return IR.index(normalizeIR(expr.object), normalizeIR(expr.index), expr.loc);
    case 'Arithmetic':
      return IR.arithmetic(
        expr.operator,
        normalizeIR(expr.left),
        normalizeIR(expr.right),
        expr.loc
      );
    case 'Conditional':
      return IR.conditional(
        normalizeIR(expr.condition),
        normalizeIR(expr.thenBranch),
        normalizeIR(expr.elseBranch),
        expr.loc
      );
    case 'OldValue':
      return IR.old(normalizeIR(expr.expression), expr.loc);
    case 'QuantifierAll':
      return IR.quantAll(
        normalizeIR(expr.collection),
        expr.variable,
        normalizeIR(expr.predicate),
        expr.loc
      );
    case 'QuantifierAny':
      return IR.quantAny(
        normalizeIR(expr.collection),
        expr.variable,
        normalizeIR(expr.predicate),
        expr.loc
      );
    case 'QuantifierNone':
      return IR.quantNone(
        normalizeIR(expr.collection),
        expr.variable,
        normalizeIR(expr.predicate),
        expr.loc
      );
    case 'QuantifierCount':
      return IR.quantCount(
        normalizeIR(expr.collection),
        expr.variable,
        normalizeIR(expr.predicate),
        expr.loc
      );
    default:
      return expr;
  }
}

// ============================================================================
// AND/OR NORMALIZATION
// ============================================================================

function normalizeAnd(expr: IRLogicalAnd): IRExpr {
  // Flatten nested ANDs and normalize operands
  const flattened: IRExpr[] = [];

  for (const operand of expr.operands) {
    const normalized = normalizeIR(operand);
    if (normalized.kind === 'LogicalAnd') {
      flattened.push(...normalized.operands);
    } else {
      flattened.push(normalized);
    }
  }

  // Remove duplicates (based on serialization)
  const unique = deduplicateExprs(flattened);

  // Sort for deterministic ordering
  const sorted = sortExprs(unique);

  // Simplification: single operand
  if (sorted.length === 0) {
    return IR.bool(true, expr.loc);
  }
  if (sorted.length === 1) {
    return sorted[0]!;
  }

  return { ...expr, id: generateNodeId(), operands: sorted };
}

function normalizeOr(expr: IRLogicalOr): IRExpr {
  // Flatten nested ORs and normalize operands
  const flattened: IRExpr[] = [];

  for (const operand of expr.operands) {
    const normalized = normalizeIR(operand);
    if (normalized.kind === 'LogicalOr') {
      flattened.push(...normalized.operands);
    } else {
      flattened.push(normalized);
    }
  }

  // Remove duplicates
  const unique = deduplicateExprs(flattened);

  // Sort for deterministic ordering
  const sorted = sortExprs(unique);

  // Simplification: single operand
  if (sorted.length === 0) {
    return IR.bool(false, expr.loc);
  }
  if (sorted.length === 1) {
    return sorted[0]!;
  }

  return { ...expr, id: generateNodeId(), operands: sorted };
}

function normalizeList(expr: IRLiteralList): IRLiteralList {
  return {
    ...expr,
    id: generateNodeId(),
    elements: expr.elements.map(normalizeIR),
  };
}

function normalizeInSet(expr: IRInSet): IRInSet {
  const normalizedTarget = normalizeIR(expr.target);
  const normalizedValues = expr.values.map(normalizeIR);
  // Sort set values for deterministic ordering
  const sortedValues = sortExprs([...normalizedValues]);

  return {
    ...expr,
    id: generateNodeId(),
    target: normalizedTarget,
    values: sortedValues,
  };
}

// ============================================================================
// EXPRESSION SORTING
// ============================================================================

/**
 * Generate a stable sort key for an IR expression
 */
function exprSortKey(expr: IRExpr): string {
  switch (expr.kind) {
    case 'LiteralNull':
      return '0_null';
    case 'LiteralBool':
      return `1_bool_${expr.value}`;
    case 'LiteralNumber':
      return `2_num_${expr.value}`;
    case 'LiteralString':
      return `3_str_${expr.value}`;
    case 'Variable':
      return `4_var_${expr.name}`;
    case 'PropertyAccess':
      return `5_prop_${exprSortKey(expr.object)}_${expr.property}`;
    case 'InputValue':
      return `6_input_${expr.property}`;
    case 'ResultValue':
      return `7_result_${expr.property ?? ''}`;
    case 'Existence':
      return `8_exists_${expr.exists}_${exprSortKey(expr.target)}`;
    case 'Comparison':
      return `9_cmp_${expr.operator}_${exprSortKey(expr.left)}_${exprSortKey(expr.right)}`;
    case 'EqualityCheck':
      return `10_eq_${expr.negated}_${exprSortKey(expr.left)}_${exprSortKey(expr.right)}`;
    case 'InSet':
      return `11_inset_${expr.negated}_${exprSortKey(expr.target)}`;
    case 'LogicalNot':
      return `12_not_${exprSortKey(expr.operand)}`;
    case 'LogicalAnd':
      return `13_and_${expr.operands.map(exprSortKey).join('_')}`;
    case 'LogicalOr':
      return `14_or_${expr.operands.map(exprSortKey).join('_')}`;
    default:
      return `99_${expr.kind}_${expr.id}`;
  }
}

function sortExprs(exprs: IRExpr[]): IRExpr[] {
  return [...exprs].sort((a, b) => exprSortKey(a).localeCompare(exprSortKey(b)));
}

function deduplicateExprs(exprs: IRExpr[]): IRExpr[] {
  const seen = new Set<string>();
  const result: IRExpr[] = [];

  for (const expr of exprs) {
    const key = exprSortKey(expr);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(expr);
    }
  }

  return result;
}

// ============================================================================
// IR SERIALIZATION (for stable hashing/comparison)
// ============================================================================

/**
 * Serialize an IR expression to a canonical string representation
 */
export function serializeIR(expr: IRExpr): string {
  switch (expr.kind) {
    case 'LiteralNull':
      return 'null';
    case 'LiteralBool':
      return String(expr.value);
    case 'LiteralNumber':
      return String(expr.value);
    case 'LiteralString':
      return JSON.stringify(expr.value);
    case 'LiteralRegex':
      return `/${expr.pattern}/${expr.flags}`;
    case 'LiteralList':
      return `[${expr.elements.map(serializeIR).join(', ')}]`;
    case 'LiteralMap':
      return `{${expr.entries.map((e) => `${e.key}: ${serializeIR(e.value)}`).join(', ')}}`;
    case 'Variable':
      return expr.name;
    case 'PropertyAccess':
      return `${serializeIR(expr.object)}.${expr.property}`;
    case 'IndexAccess':
      return `${serializeIR(expr.object)}[${serializeIR(expr.index)}]`;
    case 'Existence':
      return expr.exists
        ? `(${serializeIR(expr.target)} != null)`
        : `(${serializeIR(expr.target)} == null)`;
    case 'Comparison':
      return `(${serializeIR(expr.left)} ${expr.operator} ${serializeIR(expr.right)})`;
    case 'EqualityCheck':
      return expr.negated
        ? `(${serializeIR(expr.left)} != ${serializeIR(expr.right)})`
        : `(${serializeIR(expr.left)} == ${serializeIR(expr.right)})`;
    case 'StringLength':
      return `${serializeIR(expr.target)}.length`;
    case 'StringMatches':
      return `${serializeIR(expr.target)}.matches(${serializeIR(expr.pattern)})`;
    case 'StringIncludes':
      return `${serializeIR(expr.target)}.includes(${serializeIR(expr.substring)})`;
    case 'StringStartsWith':
      return `${serializeIR(expr.target)}.startsWith(${serializeIR(expr.prefix)})`;
    case 'StringEndsWith':
      return `${serializeIR(expr.target)}.endsWith(${serializeIR(expr.suffix)})`;
    case 'Between':
      return `between(${serializeIR(expr.target)}, ${serializeIR(expr.min)}, ${serializeIR(expr.max)})`;
    case 'InSet':
      return expr.negated
        ? `(${serializeIR(expr.target)} not in [${expr.values.map(serializeIR).join(', ')}])`
        : `(${serializeIR(expr.target)} in [${expr.values.map(serializeIR).join(', ')}])`;
    case 'LogicalAnd':
      return `(${expr.operands.map(serializeIR).join(' && ')})`;
    case 'LogicalOr':
      return `(${expr.operands.map(serializeIR).join(' || ')})`;
    case 'LogicalNot':
      return `!${serializeIR(expr.operand)}`;
    case 'LogicalImplies':
      return `(${serializeIR(expr.antecedent)} => ${serializeIR(expr.consequent)})`;
    case 'ArrayLength':
      return `${serializeIR(expr.target)}.length`;
    case 'ArrayIncludes':
      return `${serializeIR(expr.target)}.includes(${serializeIR(expr.element)})`;
    case 'ArrayEvery':
      return `${serializeIR(expr.target)}.every(${expr.variable} => ${serializeIR(expr.predicate)})`;
    case 'ArraySome':
      return `${serializeIR(expr.target)}.some(${expr.variable} => ${serializeIR(expr.predicate)})`;
    case 'ArrayFilter':
      return `${serializeIR(expr.target)}.filter(${expr.variable} => ${serializeIR(expr.predicate)})`;
    case 'ArrayMap':
      return `${serializeIR(expr.target)}.map(${expr.variable} => ${serializeIR(expr.mapper)})`;
    case 'QuantifierAll':
      return `all(${expr.variable} in ${serializeIR(expr.collection)}, ${serializeIR(expr.predicate)})`;
    case 'QuantifierAny':
      return `any(${expr.variable} in ${serializeIR(expr.collection)}, ${serializeIR(expr.predicate)})`;
    case 'QuantifierNone':
      return `none(${expr.variable} in ${serializeIR(expr.collection)}, ${serializeIR(expr.predicate)})`;
    case 'QuantifierCount':
      return `count(${expr.variable} in ${serializeIR(expr.collection)}, ${serializeIR(expr.predicate)})`;
    case 'Arithmetic':
      return `(${serializeIR(expr.left)} ${expr.operator} ${serializeIR(expr.right)})`;
    case 'Conditional':
      return `(${serializeIR(expr.condition)} ? ${serializeIR(expr.thenBranch)} : ${serializeIR(expr.elseBranch)})`;
    case 'OldValue':
      return `old(${serializeIR(expr.expression)})`;
    case 'ResultValue':
      return expr.property ? `result.${expr.property}` : 'result';
    case 'InputValue':
      return `input.${expr.property}`;
    case 'FunctionCall':
      return `${expr.name}(${expr.args.map(serializeIR).join(', ')})`;
    case 'EntityExists':
      return expr.criteria
        ? `${expr.entityName}.exists(${serializeIR(expr.criteria)})`
        : `${expr.entityName}.exists()`;
    case 'EntityLookup':
      return `${expr.entityName}.lookup(${serializeIR(expr.criteria)})`;
    case 'EntityCount':
      return expr.criteria
        ? `${expr.entityName}.count(${serializeIR(expr.criteria)})`
        : `${expr.entityName}.count()`;
    default: {
      const _exhaustive: never = expr;
      return `<unknown: ${(_exhaustive as IRExpr).kind}>`;
    }
  }
}
