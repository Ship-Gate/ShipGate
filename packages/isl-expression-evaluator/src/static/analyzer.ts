// ============================================================================
// ISL Static Analyzer - Core Implementation
// ============================================================================
// Proves/disproves ISL conditions WITHOUT executing code using type-constraint
// propagation. Returns tri-state verdicts: true | false | unknown.
//
// This runs BEFORE the runtime evaluator. Only expressions marked "unknown"
// are passed to the runtime evaluator for execution against actual values.
// ============================================================================

import type { Expression } from '@isl-lang/parser';
import type {
  TypeContext,
  TypeConstraintInfo,
  StaticAnalysisResult,
  StaticVerdict,
  AnalysisCategory,
  EntityInfo,
} from './types.js';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Statically analyze an ISL expression and return a tri-state verdict.
 *
 * @param expr - The parsed ISL expression AST node
 * @param typeContext - Type information from the typechecker's symbol table
 * @returns StaticAnalysisResult with verdict, reason, and confidence
 *
 * @example
 * ```typescript
 * // Type: Email = String { min_length: 1 }
 * // Expression: result.email.length > 0
 * // Result: { verdict: 'true', reason: 'Type constraint min_length:1 guarantees length > 0', confidence: 1.0 }
 * ```
 */
export function analyzeStatically(
  expr: Expression,
  typeContext: TypeContext
): StaticAnalysisResult {
  return analyzeExpr(expr, typeContext);
}

/**
 * Batch-analyze multiple expressions and return results.
 * Useful for analyzing all postconditions of a behavior at once.
 */
export function analyzeAll(
  exprs: Expression[],
  typeContext: TypeContext
): StaticAnalysisResult[] {
  return exprs.map(expr => analyzeStatically(expr, typeContext));
}

/**
 * Get a summary of batch analysis results.
 */
export function summarizeResults(results: StaticAnalysisResult[]): {
  total: number;
  provablyTrue: number;
  provablyFalse: number;
  unknown: number;
  needsRuntime: boolean;
} {
  const provablyTrue = results.filter(r => r.verdict === 'true').length;
  const provablyFalse = results.filter(r => r.verdict === 'false').length;
  const unknownCount = results.filter(r => r.verdict === 'unknown').length;
  return {
    total: results.length,
    provablyTrue,
    provablyFalse,
    unknown: unknownCount,
    needsRuntime: unknownCount > 0,
  };
}

// ============================================================================
// EXPRESSION STRINGIFICATION (for diagnostics)
// ============================================================================

function exprToString(expr: Expression): string {
  switch (expr.kind) {
    case 'BooleanLiteral':
      return String((expr as { value: boolean }).value);
    case 'NumberLiteral':
      return String((expr as { value: number }).value);
    case 'StringLiteral':
      return `"${(expr as { value: string }).value}"`;
    case 'NullLiteral':
      return 'null';
    case 'Identifier':
      return (expr as { name: string }).name;
    case 'QualifiedName':
      return (expr as { parts: { name: string }[] }).parts.map(p => p.name).join('.');
    case 'BinaryExpr': {
      const bin = expr as { operator: string; left: Expression; right: Expression };
      return `${exprToString(bin.left)} ${bin.operator} ${exprToString(bin.right)}`;
    }
    case 'UnaryExpr': {
      const un = expr as { operator: string; operand: Expression };
      return `${un.operator} ${exprToString(un.operand)}`;
    }
    case 'MemberExpr': {
      const mem = expr as { object: Expression; property: { name: string } };
      return `${exprToString(mem.object)}.${mem.property.name}`;
    }
    case 'CallExpr': {
      const call = expr as { callee: Expression; arguments: Expression[] };
      const args = call.arguments.map(a => exprToString(a)).join(', ');
      return `${exprToString(call.callee)}(${args})`;
    }
    case 'QuantifierExpr': {
      const q = expr as { quantifier: string; variable: { name: string }; collection: Expression; predicate: Expression };
      return `${q.quantifier}(${exprToString(q.collection)}, ${q.variable.name} => ${exprToString(q.predicate)})`;
    }
    case 'ConditionalExpr': {
      const cond = expr as { condition: Expression; thenBranch: Expression; elseBranch: Expression };
      return `${exprToString(cond.condition)} ? ${exprToString(cond.thenBranch)} : ${exprToString(cond.elseBranch)}`;
    }
    case 'ResultExpr': {
      const res = expr as { property?: { name: string } };
      return res.property ? `result.${res.property.name}` : 'result';
    }
    case 'InputExpr': {
      const inp = expr as { property: { name: string } };
      return `input.${inp.property.name}`;
    }
    case 'OldExpr': {
      const old = expr as { expression: Expression };
      return `old(${exprToString(old.expression)})`;
    }
    case 'IndexExpr': {
      const idx = expr as { object: Expression; index: Expression };
      return `${exprToString(idx.object)}[${exprToString(idx.index)}]`;
    }
    case 'LambdaExpr': {
      const lam = expr as { params: { name: string }[]; body: Expression };
      return `(${lam.params.map(p => p.name).join(', ')}) => ${exprToString(lam.body)}`;
    }
    case 'ListExpr': {
      const list = expr as { elements: Expression[] };
      return `[${list.elements.map(e => exprToString(e)).join(', ')}]`;
    }
    case 'MapExpr': {
      return '{...}';
    }
    default:
      return `<${expr.kind}>`;
  }
}

// ============================================================================
// RESULT CONSTRUCTORS
// ============================================================================

function result(
  expr: Expression,
  verdict: StaticVerdict,
  reason: string,
  confidence: number,
  category: AnalysisCategory
): StaticAnalysisResult {
  return {
    expression: exprToString(expr),
    verdict,
    reason,
    confidence: Math.max(0, Math.min(1, confidence)),
    category,
  };
}

function provablyTrue(expr: Expression, reason: string, confidence: number, category: AnalysisCategory): StaticAnalysisResult {
  return result(expr, 'true', reason, confidence, category);
}

function provablyFalse(expr: Expression, reason: string, confidence: number, category: AnalysisCategory): StaticAnalysisResult {
  return result(expr, 'false', reason, confidence, category);
}

function unknownResult(expr: Expression, reason: string, category: AnalysisCategory = 'runtime-dependent'): StaticAnalysisResult {
  return result(expr, 'unknown', reason, 0, category);
}

// ============================================================================
// TYPE RESOLUTION HELPERS
// ============================================================================

/**
 * Resolve the type of an expression from the type context.
 * Returns undefined if the type cannot be determined statically.
 */
function resolveExprType(expr: Expression, ctx: TypeContext): TypeConstraintInfo | undefined {
  switch (expr.kind) {
    case 'BooleanLiteral':
      return { baseType: 'boolean' };
    case 'NumberLiteral': {
      const num = expr as { value: number; isFloat: boolean };
      const baseType = num.isFloat ? 'float' : 'integer';
      return { baseType, constraints: { min: num.value, max: num.value } };
    }
    case 'StringLiteral': {
      const str = expr as { value: string };
      return { baseType: 'string', constraints: { minLength: str.value.length, maxLength: str.value.length } };
    }
    case 'NullLiteral':
      return { baseType: 'null' };
    case 'Identifier': {
      const id = expr as { name: string };
      // Check bindings first
      const binding = ctx.bindings.get(id.name);
      if (binding) return binding;
      // Check if it's a type name
      const typeAlias = ctx.types.get(id.name);
      if (typeAlias) return typeAlias;
      return undefined;
    }
    case 'ResultExpr': {
      const res = expr as { property?: { name: string } };
      if (!res.property) {
        return ctx.resultType;
      }
      // Resolve field type from result entity
      if (ctx.resultEntity) {
        const field = ctx.resultEntity.fields.get(res.property.name);
        if (field) return field.type;
      }
      return undefined;
    }
    case 'InputExpr': {
      const inp = expr as { property: { name: string } };
      return ctx.inputTypes?.get(inp.property.name);
    }
    case 'MemberExpr': {
      const mem = expr as { object: Expression; property: { name: string } };
      const objType = resolveExprType(mem.object, ctx);
      if (!objType) return undefined;

      // If the object is an entity type, resolve the field
      const entityName = resolveEntityName(mem.object, ctx);
      if (entityName) {
        const entity = ctx.entities.get(entityName);
        if (entity) {
          const field = entity.fields.get(mem.property.name);
          if (field) return field.type;
        }
      }

      // Special case: .length on string/array types
      if (mem.property.name === 'length') {
        if (objType.baseType === 'string' || objType.baseType === 'array') {
          const minLen = objType.constraints?.minLength ?? 0;
          const maxLen = objType.constraints?.maxLength;
          return {
            baseType: 'integer',
            constraints: {
              min: minLen,
              max: maxLen,
            },
          };
        }
      }

      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Resolve the entity name referenced by an expression.
 */
function resolveEntityName(expr: Expression, ctx: TypeContext): string | undefined {
  switch (expr.kind) {
    case 'Identifier': {
      const id = expr as { name: string };
      // Check if the binding type corresponds to an entity
      const binding = ctx.bindings.get(id.name);
      if (binding?.baseType === 'object') {
        // Look for an entity that matches
        for (const [name] of ctx.entities) {
          if (name.toLowerCase() === id.name.toLowerCase()) return name;
        }
      }
      // Check if the identifier itself is an entity name
      if (ctx.entities.has(id.name)) return id.name;
      return undefined;
    }
    case 'ResultExpr': {
      if (ctx.resultEntity) return ctx.resultEntity.name;
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Check if two base types are compatible for comparison.
 */
function areTypesCompatible(a: TypeConstraintInfo, b: TypeConstraintInfo): boolean {
  // Null is compatible with anything (nullable check)
  if (a.baseType === 'null' || b.baseType === 'null') return true;
  // Unknown is compatible with anything
  if (a.baseType === 'unknown' || b.baseType === 'unknown') return true;
  // Same base type
  if (a.baseType === b.baseType) return true;
  // Numeric types are compatible with each other
  const numericTypes = new Set(['number', 'integer', 'float']);
  if (numericTypes.has(a.baseType) && numericTypes.has(b.baseType)) return true;
  return false;
}

/**
 * Check if a type is numeric.
 */
function isNumericType(t: TypeConstraintInfo): boolean {
  return t.baseType === 'number' || t.baseType === 'integer' || t.baseType === 'float';
}

// ============================================================================
// EXPRESSION ANALYZERS
// ============================================================================

function analyzeExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  switch (expr.kind) {
    case 'BooleanLiteral':
      return analyzeBooleanLiteral(expr);
    case 'NumberLiteral':
      return analyzeNumberLiteral(expr);
    case 'StringLiteral':
      return analyzeStringLiteral(expr);
    case 'NullLiteral':
      return analyzeNullLiteral(expr);
    case 'Identifier':
      return analyzeIdentifier(expr, ctx);
    case 'BinaryExpr':
      return analyzeBinaryExpr(expr, ctx);
    case 'UnaryExpr':
      return analyzeUnaryExpr(expr, ctx);
    case 'MemberExpr':
      return analyzeMemberExpr(expr, ctx);
    case 'CallExpr':
      return analyzeCallExpr(expr, ctx);
    case 'QuantifierExpr':
      return analyzeQuantifierExpr(expr, ctx);
    case 'ConditionalExpr':
      return analyzeConditionalExpr(expr, ctx);
    case 'ResultExpr':
      return analyzeResultExpr(expr, ctx);
    case 'InputExpr':
      return analyzeInputExpr(expr, ctx);
    case 'OldExpr':
      return analyzeOldExpr(expr, ctx);
    case 'IndexExpr':
      return analyzeIndexExpr(expr, ctx);
    case 'ListExpr':
      return analyzeListExpr(expr);
    case 'LambdaExpr':
      return unknownResult(expr, 'Lambda expressions require runtime evaluation', 'unsupported');
    case 'MapExpr':
      return unknownResult(expr, 'Map expressions require runtime evaluation', 'unsupported');
    case 'QualifiedName':
      return analyzeQualifiedName(expr, ctx);
    case 'DurationLiteral':
      return provablyTrue(expr, 'Duration literal is a concrete value', 1.0, 'literal');
    case 'RegexLiteral':
      return provablyTrue(expr, 'Regex literal is a concrete value', 1.0, 'literal');
    default:
      return unknownResult(expr, `Unsupported expression kind: ${expr.kind}`, 'unsupported');
  }
}

// ---- Literals ----

function analyzeBooleanLiteral(expr: Expression): StaticAnalysisResult {
  const val = (expr as { value: boolean }).value;
  if (val) {
    return provablyTrue(expr, 'Boolean literal is true', 1.0, 'literal');
  }
  return provablyFalse(expr, 'Boolean literal is false', 1.0, 'literal');
}

function analyzeNumberLiteral(expr: Expression): StaticAnalysisResult {
  const val = (expr as { value: number }).value;
  // Numbers are truthy if non-zero (but in ISL, a number literal in boolean context is unusual)
  if (val !== 0) {
    return provablyTrue(expr, `Number literal ${val} is non-zero (truthy)`, 1.0, 'literal');
  }
  return provablyFalse(expr, 'Number literal 0 is falsy', 1.0, 'literal');
}

function analyzeStringLiteral(expr: Expression): StaticAnalysisResult {
  const val = (expr as { value: string }).value;
  if (val.length > 0) {
    return provablyTrue(expr, `String literal "${val}" is non-empty (truthy)`, 1.0, 'literal');
  }
  return provablyFalse(expr, 'Empty string literal is falsy', 1.0, 'literal');
}

function analyzeNullLiteral(expr: Expression): StaticAnalysisResult {
  return provablyFalse(expr, 'Null literal is always falsy', 1.0, 'literal');
}

// ---- Identifiers & Names ----

function analyzeIdentifier(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  const id = expr as { name: string };
  // Check if we know the type of this identifier
  if (ctx.bindings.has(id.name)) {
    const typeInfo = ctx.bindings.get(id.name)!;
    // If it's boolean with a known value via constraints, we could resolve it
    // But identifiers alone in boolean context need runtime values
    if (typeInfo.baseType === 'boolean') {
      return unknownResult(expr, `Identifier "${id.name}" is boolean but value unknown at compile time`);
    }
    return unknownResult(expr, `Identifier "${id.name}" has known type ${typeInfo.baseType} but value requires runtime`);
  }
  return unknownResult(expr, `Identifier "${id.name}" has no type information available`);
}

function analyzeQualifiedName(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  const qn = expr as { parts: { name: string }[] };
  const fullName = qn.parts.map(p => p.name).join('.');
  return unknownResult(expr, `Qualified name "${fullName}" requires runtime evaluation`);
}

// ---- Binary Expressions ----

function analyzeBinaryExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  const bin = expr as { operator: string; left: Expression; right: Expression };
  const { operator, left, right } = bin;

  // ---- Logical operators use tri-state propagation ----
  if (operator === 'and') return analyzeLogicalAnd(expr, left, right, ctx);
  if (operator === 'or') return analyzeLogicalOr(expr, left, right, ctx);
  if (operator === 'implies') return analyzeImplies(expr, left, right, ctx);
  if (operator === 'iff') return analyzeIff(expr, left, right, ctx);

  // ---- Tautology / contradiction detection ----
  const tautologyResult = checkTautologyOrContradiction(expr, operator, left, right);
  if (tautologyResult) return tautologyResult;

  // ---- Type mismatch detection ----
  const leftType = resolveExprType(left, ctx);
  const rightType = resolveExprType(right, ctx);

  if (leftType && rightType) {
    // Type mismatch: comparing incompatible types
    if (isComparisonOp(operator) && !areTypesCompatible(leftType, rightType)) {
      if (operator === '==' || operator === '<=') {
        return provablyFalse(
          expr,
          `Type mismatch: ${leftType.baseType} ${operator} ${rightType.baseType} is always false`,
          1.0,
          'type-mismatch'
        );
      }
      if (operator === '!=') {
        return provablyTrue(
          expr,
          `Type mismatch: ${leftType.baseType} != ${rightType.baseType} is always true`,
          1.0,
          'type-mismatch'
        );
      }
    }

    // ---- Range analysis for numeric comparisons ----
    if (isComparisonOp(operator) && isNumericType(leftType) && isNumericType(rightType)) {
      const rangeResult = analyzeNumericComparison(expr, operator, leftType, rightType);
      if (rangeResult) return rangeResult;
    }

    // ---- Literal comparison ----
    if (isComparisonOp(operator)) {
      const literalResult = analyzeLiteralComparison(expr, operator, left, right);
      if (literalResult) return literalResult;
    }

    // ---- Enum analysis ----
    if (operator === '==' || operator === '!=') {
      const enumResult = analyzeEnumComparison(expr, operator, leftType, rightType, left, right);
      if (enumResult) return enumResult;
    }
  }

  // ---- Membership operator 'in' ----
  if (operator === 'in') {
    return analyzeInOperator(expr, left, right, ctx);
  }

  return unknownResult(expr, `Cannot statically determine ${exprToString(left)} ${operator} ${exprToString(right)}`);
}

function isComparisonOp(op: string): boolean {
  return op === '==' || op === '!=' || op === '<' || op === '>' || op === '<=' || op === '>=';
}

// ---- Logical Operators (tri-state) ----

function analyzeLogicalAnd(
  expr: Expression, left: Expression, right: Expression, ctx: TypeContext
): StaticAnalysisResult {
  const leftResult = analyzeExpr(left, ctx);
  const rightResult = analyzeExpr(right, ctx);

  // false && anything = false (short-circuit)
  if (leftResult.verdict === 'false') {
    return provablyFalse(expr, `Left operand is provably false: ${leftResult.reason}`, leftResult.confidence, 'logical-simplification');
  }
  if (rightResult.verdict === 'false') {
    return provablyFalse(expr, `Right operand is provably false: ${rightResult.reason}`, rightResult.confidence, 'logical-simplification');
  }

  // true && true = true
  if (leftResult.verdict === 'true' && rightResult.verdict === 'true') {
    return provablyTrue(expr, 'Both operands are provably true', Math.min(leftResult.confidence, rightResult.confidence), 'logical-simplification');
  }

  // true && unknown = unknown, unknown && true = unknown
  return unknownResult(expr, 'One or both operands require runtime evaluation');
}

function analyzeLogicalOr(
  expr: Expression, left: Expression, right: Expression, ctx: TypeContext
): StaticAnalysisResult {
  const leftResult = analyzeExpr(left, ctx);
  const rightResult = analyzeExpr(right, ctx);

  // true || anything = true (short-circuit)
  if (leftResult.verdict === 'true') {
    return provablyTrue(expr, `Left operand is provably true: ${leftResult.reason}`, leftResult.confidence, 'logical-simplification');
  }
  if (rightResult.verdict === 'true') {
    return provablyTrue(expr, `Right operand is provably true: ${rightResult.reason}`, rightResult.confidence, 'logical-simplification');
  }

  // false || false = false
  if (leftResult.verdict === 'false' && rightResult.verdict === 'false') {
    return provablyFalse(expr, 'Both operands are provably false', Math.min(leftResult.confidence, rightResult.confidence), 'logical-simplification');
  }

  // false || unknown = unknown, unknown || false = unknown
  return unknownResult(expr, 'One or both operands require runtime evaluation');
}

function analyzeImplies(
  expr: Expression, left: Expression, right: Expression, ctx: TypeContext
): StaticAnalysisResult {
  const leftResult = analyzeExpr(left, ctx);
  const rightResult = analyzeExpr(right, ctx);

  // false implies anything = true
  if (leftResult.verdict === 'false') {
    return provablyTrue(expr, 'Antecedent is provably false, implication holds vacuously', leftResult.confidence, 'logical-simplification');
  }
  // anything implies true = true
  if (rightResult.verdict === 'true') {
    return provablyTrue(expr, 'Consequent is provably true, implication holds', rightResult.confidence, 'logical-simplification');
  }
  // true implies false = false
  if (leftResult.verdict === 'true' && rightResult.verdict === 'false') {
    return provablyFalse(expr, 'Antecedent is true but consequent is false', Math.min(leftResult.confidence, rightResult.confidence), 'logical-simplification');
  }

  return unknownResult(expr, 'Implication requires runtime evaluation of antecedent/consequent');
}

function analyzeIff(
  expr: Expression, left: Expression, right: Expression, ctx: TypeContext
): StaticAnalysisResult {
  const leftResult = analyzeExpr(left, ctx);
  const rightResult = analyzeExpr(right, ctx);

  // Both known and equal => true
  if (leftResult.verdict !== 'unknown' && rightResult.verdict !== 'unknown') {
    if (leftResult.verdict === rightResult.verdict) {
      return provablyTrue(expr, 'Both sides have same truth value', Math.min(leftResult.confidence, rightResult.confidence), 'logical-simplification');
    }
    return provablyFalse(expr, 'Sides have different truth values', Math.min(leftResult.confidence, rightResult.confidence), 'logical-simplification');
  }

  return unknownResult(expr, 'Biconditional requires runtime evaluation');
}

// ---- Tautology / Contradiction detection ----

function checkTautologyOrContradiction(
  expr: Expression, operator: string, left: Expression, right: Expression
): StaticAnalysisResult | null {
  // Check structural equality: x == x, x != x, x <= x, x >= x
  if (areStructurallyEqual(left, right)) {
    switch (operator) {
      case '==':
      case '<=':
      case '>=':
        return provablyTrue(expr, `Tautology: ${exprToString(left)} ${operator} ${exprToString(right)} (same expression both sides)`, 1.0, 'tautology');
      case '!=':
      case '<':
      case '>':
        return provablyFalse(expr, `Contradiction: ${exprToString(left)} ${operator} ${exprToString(right)} (same expression both sides)`, 1.0, 'contradiction');
    }
  }
  return null;
}

/**
 * Check if two expressions are structurally identical.
 */
function areStructurallyEqual(a: Expression, b: Expression): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case 'Identifier':
      return (a as { name: string }).name === (b as { name: string }).name;
    case 'NumberLiteral':
      return (a as { value: number }).value === (b as { value: number }).value;
    case 'StringLiteral':
      return (a as { value: string }).value === (b as { value: string }).value;
    case 'BooleanLiteral':
      return (a as { value: boolean }).value === (b as { value: boolean }).value;
    case 'NullLiteral':
      return true;
    case 'MemberExpr': {
      const memA = a as { object: Expression; property: { name: string } };
      const memB = b as { object: Expression; property: { name: string } };
      return memA.property.name === memB.property.name && areStructurallyEqual(memA.object, memB.object);
    }
    case 'ResultExpr': {
      const resA = a as { property?: { name: string } };
      const resB = b as { property?: { name: string } };
      return resA.property?.name === resB.property?.name;
    }
    case 'InputExpr': {
      const inpA = a as { property: { name: string } };
      const inpB = b as { property: { name: string } };
      return inpA.property.name === inpB.property.name;
    }
    default:
      return false;
  }
}

// ---- Numeric Range Analysis ----

function analyzeNumericComparison(
  expr: Expression, operator: string,
  leftType: TypeConstraintInfo, rightType: TypeConstraintInfo
): StaticAnalysisResult | null {
  const leftMin = leftType.constraints?.min;
  const leftMax = leftType.constraints?.max;
  const rightMin = rightType.constraints?.min;
  const rightMax = rightType.constraints?.max;

  // Need at least some constraint info to do range analysis
  if (leftMin === undefined && leftMax === undefined && rightMin === undefined && rightMax === undefined) {
    return null;
  }

  switch (operator) {
    case '>': {
      // leftMin > rightMax => definitely true
      if (leftMin !== undefined && rightMax !== undefined && leftMin > rightMax) {
        return provablyTrue(expr, `Range analysis: min(${leftMin}) > max(${rightMax})`, 1.0, 'range-analysis');
      }
      // leftMax <= rightMin => definitely false (or equal)
      if (leftMax !== undefined && rightMin !== undefined && leftMax <= rightMin) {
        return provablyFalse(expr, `Range analysis: max(${leftMax}) <= min(${rightMin})`, 1.0, 'range-analysis');
      }
      return null;
    }
    case '>=': {
      if (leftMin !== undefined && rightMax !== undefined && leftMin >= rightMax) {
        return provablyTrue(expr, `Range analysis: min(${leftMin}) >= max(${rightMax})`, 1.0, 'range-analysis');
      }
      if (leftMax !== undefined && rightMin !== undefined && leftMax < rightMin) {
        return provablyFalse(expr, `Range analysis: max(${leftMax}) < min(${rightMin})`, 1.0, 'range-analysis');
      }
      return null;
    }
    case '<': {
      if (leftMax !== undefined && rightMin !== undefined && leftMax < rightMin) {
        return provablyTrue(expr, `Range analysis: max(${leftMax}) < min(${rightMin})`, 1.0, 'range-analysis');
      }
      if (leftMin !== undefined && rightMax !== undefined && leftMin >= rightMax) {
        return provablyFalse(expr, `Range analysis: min(${leftMin}) >= max(${rightMax})`, 1.0, 'range-analysis');
      }
      return null;
    }
    case '<=': {
      if (leftMax !== undefined && rightMin !== undefined && leftMax <= rightMin) {
        return provablyTrue(expr, `Range analysis: max(${leftMax}) <= min(${rightMin})`, 1.0, 'range-analysis');
      }
      if (leftMin !== undefined && rightMax !== undefined && leftMin > rightMax) {
        return provablyFalse(expr, `Range analysis: min(${leftMin}) > max(${rightMax})`, 1.0, 'range-analysis');
      }
      return null;
    }
    case '==': {
      // Ranges don't overlap => definitely not equal
      if (leftMin !== undefined && rightMax !== undefined && leftMin > rightMax) {
        return provablyFalse(expr, `Range analysis: ranges don't overlap (${leftMin}..${leftMax ?? '∞'} vs ${rightMin ?? '-∞'}..${rightMax})`, 1.0, 'range-analysis');
      }
      if (leftMax !== undefined && rightMin !== undefined && leftMax < rightMin) {
        return provablyFalse(expr, `Range analysis: ranges don't overlap (${leftMin ?? '-∞'}..${leftMax} vs ${rightMin}..${rightMax ?? '∞'})`, 1.0, 'range-analysis');
      }
      // Both are exact values and equal
      if (leftMin !== undefined && leftMax !== undefined && rightMin !== undefined && rightMax !== undefined
          && leftMin === leftMax && rightMin === rightMax && leftMin === rightMin) {
        return provablyTrue(expr, `Range analysis: both sides are exactly ${leftMin}`, 1.0, 'range-analysis');
      }
      return null;
    }
    case '!=': {
      // Ranges don't overlap => definitely not equal => true
      if (leftMin !== undefined && rightMax !== undefined && leftMin > rightMax) {
        return provablyTrue(expr, `Range analysis: ranges don't overlap, always not equal`, 1.0, 'range-analysis');
      }
      if (leftMax !== undefined && rightMin !== undefined && leftMax < rightMin) {
        return provablyTrue(expr, `Range analysis: ranges don't overlap, always not equal`, 1.0, 'range-analysis');
      }
      // Both are exact same value => false
      if (leftMin !== undefined && leftMax !== undefined && rightMin !== undefined && rightMax !== undefined
          && leftMin === leftMax && rightMin === rightMax && leftMin === rightMin) {
        return provablyFalse(expr, `Range analysis: both sides are exactly ${leftMin}`, 1.0, 'range-analysis');
      }
      return null;
    }
  }

  return null;
}

// ---- Literal Comparison ----

function analyzeLiteralComparison(
  expr: Expression, operator: string, left: Expression, right: Expression
): StaticAnalysisResult | null {
  // Both sides must be literals for direct comparison
  const leftVal = extractLiteralValue(left);
  const rightVal = extractLiteralValue(right);

  if (leftVal === undefined || rightVal === undefined) return null;

  let compResult: boolean;
  switch (operator) {
    case '==': compResult = leftVal === rightVal; break;
    case '!=': compResult = leftVal !== rightVal; break;
    case '<':  compResult = (leftVal as number) < (rightVal as number); break;
    case '>':  compResult = (leftVal as number) > (rightVal as number); break;
    case '<=': compResult = (leftVal as number) <= (rightVal as number); break;
    case '>=': compResult = (leftVal as number) >= (rightVal as number); break;
    default: return null;
  }

  if (compResult) {
    return provablyTrue(expr, `Literal comparison: ${String(leftVal)} ${operator} ${String(rightVal)} is true`, 1.0, 'literal');
  }
  return provablyFalse(expr, `Literal comparison: ${String(leftVal)} ${operator} ${String(rightVal)} is false`, 1.0, 'literal');
}

function extractLiteralValue(expr: Expression): unknown | undefined {
  switch (expr.kind) {
    case 'NumberLiteral': return (expr as { value: number }).value;
    case 'StringLiteral': return (expr as { value: string }).value;
    case 'BooleanLiteral': return (expr as { value: boolean }).value;
    case 'NullLiteral': return null;
    default: return undefined;
  }
}

// ---- Enum Analysis ----

function analyzeEnumComparison(
  expr: Expression, operator: string,
  leftType: TypeConstraintInfo, rightType: TypeConstraintInfo,
  left: Expression, right: Expression
): StaticAnalysisResult | null {
  // Check if one side has enum constraints and the other is a literal
  const rightVal = extractLiteralValue(right);
  const leftVal = extractLiteralValue(left);

  if (leftType.constraints?.enumValues && rightVal !== undefined) {
    const inEnum = leftType.constraints.enumValues.includes(rightVal);
    if (operator === '==') {
      if (!inEnum) {
        return provablyFalse(expr, `Value ${String(rightVal)} is not in enum [${leftType.constraints.enumValues.join(', ')}]`, 0.9, 'enum-analysis');
      }
      // Value is in enum, but we don't know the actual runtime value
      return null;
    }
    if (operator === '!=') {
      if (!inEnum) {
        return provablyTrue(expr, `Value ${String(rightVal)} is not in enum [${leftType.constraints.enumValues.join(', ')}], always not equal`, 0.9, 'enum-analysis');
      }
      return null;
    }
  }

  if (rightType.constraints?.enumValues && leftVal !== undefined) {
    const inEnum = rightType.constraints.enumValues.includes(leftVal);
    if (operator === '==') {
      if (!inEnum) {
        return provablyFalse(expr, `Value ${String(leftVal)} is not in enum [${rightType.constraints.enumValues.join(', ')}]`, 0.9, 'enum-analysis');
      }
      return null;
    }
    if (operator === '!=') {
      if (!inEnum) {
        return provablyTrue(expr, `Value ${String(leftVal)} is not in enum [${rightType.constraints.enumValues.join(', ')}], always not equal`, 0.9, 'enum-analysis');
      }
      return null;
    }
  }

  return null;
}

// ---- In Operator ----

function analyzeInOperator(
  expr: Expression, left: Expression, right: Expression, ctx: TypeContext
): StaticAnalysisResult {
  // If the right side is a ListExpr with all literals, and left is a literal, we can check
  if (right.kind === 'ListExpr') {
    const list = right as { elements: Expression[] };
    const leftVal = extractLiteralValue(left);
    if (leftVal !== undefined) {
      const allLiterals = list.elements.every(e =>
        e.kind === 'NumberLiteral' || e.kind === 'StringLiteral' || e.kind === 'BooleanLiteral' || e.kind === 'NullLiteral'
      );
      if (allLiterals) {
        const values = list.elements.map(e => extractLiteralValue(e));
        const found = values.includes(leftVal);
        if (found) {
          return provablyTrue(expr, `Literal ${String(leftVal)} is in the list`, 1.0, 'literal');
        }
        return provablyFalse(expr, `Literal ${String(leftVal)} is not in the list`, 1.0, 'literal');
      }
    }
  }
  return unknownResult(expr, 'Membership check requires runtime evaluation');
}

// ---- Unary Expressions ----

function analyzeUnaryExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  const un = expr as { operator: string; operand: Expression };

  if (un.operator === 'not') {
    const operandResult = analyzeExpr(un.operand, ctx);
    if (operandResult.verdict === 'true') {
      return provablyFalse(expr, `Negation of provably true: ${operandResult.reason}`, operandResult.confidence, 'logical-simplification');
    }
    if (operandResult.verdict === 'false') {
      return provablyTrue(expr, `Negation of provably false: ${operandResult.reason}`, operandResult.confidence, 'logical-simplification');
    }
    return unknownResult(expr, `Negation of unknown: ${operandResult.reason}`);
  }

  if (un.operator === '-') {
    // Numeric negation - the expression evaluates to a number, not a boolean
    return unknownResult(expr, 'Numeric negation requires runtime evaluation');
  }

  return unknownResult(expr, `Unsupported unary operator: ${un.operator}`, 'unsupported');
}

// ---- Member Expressions ----

function analyzeMemberExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  const mem = expr as { object: Expression; property: { name: string } };
  const propName = mem.property.name;

  // Try to resolve the entity type of the object
  const entityName = resolveEntityName(mem.object, ctx);
  if (entityName) {
    const entity = ctx.entities.get(entityName);
    if (entity) {
      const field = entity.fields.get(propName);
      if (field) {
        if (field.required) {
          // Required field on a known entity → exists (truthy in boolean context depends on type)
          return provablyTrue(
            expr,
            `Field "${propName}" is required on entity "${entityName}" and is guaranteed to exist`,
            0.9,
            'field-existence'
          );
        }
        // Optional field → unknown
        return unknownResult(expr, `Field "${propName}" is optional on entity "${entityName}", may not be present`);
      }
      // Field not declared on entity → provably false (field doesn't exist)
      return provablyFalse(
        expr,
        `Field "${propName}" is not declared on entity "${entityName}"`,
        0.9,
        'field-existence'
      );
    }
  }

  // Check result entity
  if (mem.object.kind === 'ResultExpr' && ctx.resultEntity) {
    const field = ctx.resultEntity.fields.get(propName);
    if (field) {
      if (field.required) {
        return provablyTrue(
          expr,
          `Field "${propName}" is required on result entity "${ctx.resultEntity.name}"`,
          0.9,
          'field-existence'
        );
      }
      return unknownResult(expr, `Field "${propName}" is optional on result, may not be present`);
    }
    return provablyFalse(
      expr,
      `Field "${propName}" is not declared on result entity "${ctx.resultEntity.name}"`,
      0.9,
      'field-existence'
    );
  }

  // Check if object type is known and has property type info via member access
  const resolvedType = resolveExprType(expr, ctx);
  if (resolvedType) {
    // We know the type but not the value → unknown for boolean evaluation
    return unknownResult(expr, `Property "${propName}" has type ${resolvedType.baseType} but value requires runtime`);
  }

  return unknownResult(expr, `Cannot determine type of ${exprToString(mem.object)}.${propName}`);
}

// ---- Call Expressions ----

function analyzeCallExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  const call = expr as { callee: Expression; arguments: Expression[] };
  const calleeName = getCalleeName(call.callee);

  switch (calleeName) {
    case 'exists':
      // exists() always needs runtime data to check entity existence
      return unknownResult(expr, 'exists() requires runtime lookup against actual data store', 'runtime-dependent');

    case 'is_valid':
      return analyzeIsValidCall(expr, call.arguments, ctx);

    case 'length':
      return analyzeLengthCall(expr, call.arguments, ctx);

    case 'now':
      return unknownResult(expr, 'now() is non-deterministic, always requires runtime', 'runtime-dependent');

    case 'lookup':
      return unknownResult(expr, 'lookup() requires runtime data store access', 'runtime-dependent');

    case 'contains':
      return analyzeContainsCall(expr, call.arguments, ctx);

    case 'is_valid_format':
    case 'regex':
      return unknownResult(expr, `${calleeName}() requires runtime value to validate`, 'runtime-dependent');

    default:
      return unknownResult(expr, `Unknown function "${calleeName}" requires runtime evaluation`, 'runtime-dependent');
  }
}

function getCalleeName(callee: Expression): string {
  if (callee.kind === 'Identifier') {
    return (callee as { name: string }).name;
  }
  if (callee.kind === 'MemberExpr') {
    const mem = callee as { object: Expression; property: { name: string } };
    return mem.property.name;
  }
  return '';
}

function analyzeIsValidCall(
  expr: Expression, args: Expression[], ctx: TypeContext
): StaticAnalysisResult {
  if (args.length === 0) {
    return unknownResult(expr, 'is_valid() called with no arguments');
  }

  const argType = resolveExprType(args[0], ctx);
  if (argType) {
    // If the type is non-nullable and has min constraints, it's always valid
    if (!argType.constraints?.nullable) {
      if (argType.baseType === 'string' && argType.constraints?.minLength && argType.constraints.minLength > 0) {
        return provablyTrue(expr, `Type constraint guarantees non-empty string (min_length: ${argType.constraints.minLength})`, 0.9, 'type-constraint');
      }
      if (isNumericType(argType) && argType.constraints?.min !== undefined) {
        return provablyTrue(expr, 'Type constraint guarantees valid number', 0.9, 'type-constraint');
      }
    }
  }

  return unknownResult(expr, 'is_valid() requires runtime value inspection');
}

function analyzeLengthCall(
  expr: Expression, args: Expression[], ctx: TypeContext
): StaticAnalysisResult {
  // length() returns a number, not a boolean - in boolean context it's truthy if > 0
  if (args.length === 0) {
    return unknownResult(expr, 'length() called with no arguments');
  }

  const argType = resolveExprType(args[0], ctx);
  if (argType && (argType.baseType === 'string' || argType.baseType === 'array')) {
    if (argType.constraints?.minLength && argType.constraints.minLength > 0) {
      return provablyTrue(expr, `Type constraint guarantees length >= ${argType.constraints.minLength} (truthy)`, 0.9, 'type-constraint');
    }
  }

  return unknownResult(expr, 'length() requires runtime value');
}

function analyzeContainsCall(
  expr: Expression, args: Expression[], ctx: TypeContext
): StaticAnalysisResult {
  // contains(collection, value) - usually needs runtime data
  return unknownResult(expr, 'contains() requires runtime data to check membership');
}

// ---- Quantifier Expressions ----

function analyzeQuantifierExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  const q = expr as { quantifier: string; variable: { name: string }; collection: Expression; predicate: Expression };

  // Quantifiers always need runtime data because we don't know the collection contents
  // Exception: empty collection checks or type-constraint-based analysis

  // If collection is a known empty list literal
  if (q.collection.kind === 'ListExpr') {
    const list = q.collection as { elements: Expression[] };
    if (list.elements.length === 0) {
      switch (q.quantifier) {
        case 'all':
          return provablyTrue(expr, 'all() over empty collection is vacuously true', 1.0, 'logical-simplification');
        case 'any':
          return provablyFalse(expr, 'any() over empty collection is false', 1.0, 'logical-simplification');
        case 'none':
          return provablyTrue(expr, 'none() over empty collection is vacuously true', 1.0, 'logical-simplification');
        case 'count':
          return provablyFalse(expr, 'count() over empty collection is 0 (falsy)', 1.0, 'literal');
        case 'sum':
          return provablyFalse(expr, 'sum() over empty collection is 0 (falsy)', 1.0, 'literal');
      }
    }
  }

  // For non-empty literal lists, we can try to evaluate each element statically
  if (q.collection.kind === 'ListExpr') {
    const list = q.collection as { elements: Expression[] };
    if (list.elements.length > 0 && (q.quantifier === 'all' || q.quantifier === 'any' || q.quantifier === 'none')) {
      return analyzeQuantifierOverLiteralList(expr, q, list.elements, ctx);
    }
  }

  return unknownResult(
    expr,
    `${q.quantifier}() over runtime collection requires runtime evaluation`,
    'runtime-dependent'
  );
}

function analyzeQuantifierOverLiteralList(
  expr: Expression,
  q: { quantifier: string; variable: { name: string }; predicate: Expression },
  elements: Expression[],
  ctx: TypeContext
): StaticAnalysisResult {
  // For each element, bind the quantifier variable and analyze the predicate
  const results: StaticAnalysisResult[] = [];

  for (const elem of elements) {
    const elemType = resolveExprType(elem, ctx);
    if (!elemType) {
      return unknownResult(expr, `Cannot resolve type for element in quantifier`, 'runtime-dependent');
    }

    // Create a new context with the variable bound
    const extendedCtx: TypeContext = {
      ...ctx,
      bindings: new Map([...ctx.bindings, [q.variable.name, elemType]]),
    };
    results.push(analyzeExpr(q.predicate, extendedCtx));
  }

  // Check if any results are unknown
  const hasUnknown = results.some(r => r.verdict === 'unknown');
  if (hasUnknown) {
    return unknownResult(expr, `Some elements in ${q.quantifier}() predicate require runtime evaluation`);
  }

  const allTrue = results.every(r => r.verdict === 'true');
  const anyTrue = results.some(r => r.verdict === 'true');
  const allFalse = results.every(r => r.verdict === 'false');

  switch (q.quantifier) {
    case 'all':
      if (allTrue) return provablyTrue(expr, 'All elements satisfy the predicate statically', 0.9, 'type-constraint');
      if (!allTrue) return provablyFalse(expr, 'Not all elements satisfy the predicate', 0.9, 'type-constraint');
      break;
    case 'any':
      if (anyTrue) return provablyTrue(expr, 'At least one element satisfies the predicate', 0.9, 'type-constraint');
      if (allFalse) return provablyFalse(expr, 'No elements satisfy the predicate', 0.9, 'type-constraint');
      break;
    case 'none':
      if (allFalse) return provablyTrue(expr, 'No elements satisfy the predicate (none is true)', 0.9, 'type-constraint');
      if (anyTrue) return provablyFalse(expr, 'At least one element satisfies the predicate (none fails)', 0.9, 'type-constraint');
      break;
  }

  return unknownResult(expr, `${q.quantifier}() result is indeterminate`);
}

// ---- Conditional Expressions ----

function analyzeConditionalExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  const cond = expr as { condition: Expression; thenBranch: Expression; elseBranch: Expression };

  const condResult = analyzeExpr(cond.condition, ctx);

  // If condition is statically known, we know which branch is taken
  if (condResult.verdict === 'true') {
    const thenResult = analyzeExpr(cond.thenBranch, ctx);
    return result(expr, thenResult.verdict, `Condition is true, taking then branch: ${thenResult.reason}`, thenResult.confidence, thenResult.category ?? 'logical-simplification');
  }
  if (condResult.verdict === 'false') {
    const elseResult = analyzeExpr(cond.elseBranch, ctx);
    return result(expr, elseResult.verdict, `Condition is false, taking else branch: ${elseResult.reason}`, elseResult.confidence, elseResult.category ?? 'logical-simplification');
  }

  // Both branches might be the same verdict
  const thenResult = analyzeExpr(cond.thenBranch, ctx);
  const elseResult = analyzeExpr(cond.elseBranch, ctx);
  if (thenResult.verdict === elseResult.verdict && thenResult.verdict !== 'unknown') {
    return result(expr, thenResult.verdict, 'Both branches have the same verdict regardless of condition', Math.min(thenResult.confidence, elseResult.confidence), 'logical-simplification');
  }

  return unknownResult(expr, 'Conditional requires runtime evaluation of condition');
}

// ---- Result / Input / Old Expressions ----

function analyzeResultExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  const res = expr as { property?: { name: string } };

  if (res.property) {
    // result.field - check if the field exists on the result entity
    if (ctx.resultEntity) {
      const field = ctx.resultEntity.fields.get(res.property.name);
      if (field && field.required) {
        return provablyTrue(
          expr,
          `Field "${res.property.name}" is required on result entity, guaranteed to exist`,
          0.9,
          'field-existence'
        );
      }
      if (!field) {
        return provablyFalse(
          expr,
          `Field "${res.property.name}" does not exist on result entity "${ctx.resultEntity.name}"`,
          0.9,
          'field-existence'
        );
      }
    }
    return unknownResult(expr, `result.${res.property.name} requires runtime evaluation`);
  }

  // bare "result" - needs runtime
  return unknownResult(expr, 'result requires runtime evaluation');
}

function analyzeInputExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  const inp = expr as { property: { name: string } };

  if (ctx.inputTypes?.has(inp.property.name)) {
    // We know the type but not the runtime value
    return unknownResult(expr, `input.${inp.property.name} has known type but value requires runtime`);
  }

  return unknownResult(expr, `input.${inp.property.name} type information not available`);
}

function analyzeOldExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  // old() always needs runtime - it references the previous state snapshot
  return unknownResult(expr, 'old() expressions always require runtime state comparison', 'runtime-dependent');
}

// ---- Index & List Expressions ----

function analyzeIndexExpr(expr: Expression, ctx: TypeContext): StaticAnalysisResult {
  return unknownResult(expr, 'Index expressions require runtime value resolution');
}

function analyzeListExpr(expr: Expression): StaticAnalysisResult {
  const list = expr as { elements: Expression[] };
  if (list.elements.length > 0) {
    return provablyTrue(expr, 'Non-empty list literal is truthy', 1.0, 'literal');
  }
  return provablyFalse(expr, 'Empty list literal is falsy', 1.0, 'literal');
}
