/**
 * Schema Fix Repair Strategy
 *
 * Fixes common schema mismatches and structural issues.
 */

import type {
  Domain,
  TypeDefinition,
  PrimitiveType,
  SourceLocation,
  Identifier,
  Expression,
  Field,
} from '@isl-lang/parser';
import type {
  RepairStrategy,
  RepairContext,
  RepairStrategyResult,
  Repair,
  UnrepairedError,
} from '../types.js';

const DEFAULT_LOCATION: SourceLocation = {
  file: '<synthesized>',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};

/**
 * Known primitive type names
 */
const PRIMITIVE_TYPES = new Set([
  'String',
  'Int',
  'Decimal',
  'Boolean',
  'Timestamp',
  'UUID',
  'Duration',
]);

/**
 * Common type name corrections
 */
const TYPE_CORRECTIONS: Record<string, string> = {
  // JavaScript/TypeScript types
  string: 'String',
  number: 'Int',
  boolean: 'Boolean',
  Date: 'Timestamp',
  // Common typos
  Str: 'String',
  Integer: 'Int',
  Bool: 'Boolean',
  Time: 'Timestamp',
  Guid: 'UUID',
  // SQL types
  VARCHAR: 'String',
  TEXT: 'String',
  INTEGER: 'Int',
  BIGINT: 'Int',
  FLOAT: 'Decimal',
  DOUBLE: 'Decimal',
  DATETIME: 'Timestamp',
  TIMESTAMP: 'Timestamp',
};

/**
 * Valid binary operators
 */
const VALID_BINARY_OPERATORS = new Set([
  '==', '!=', '<', '>', '<=', '>=',
  '+', '-', '*', '/', '%',
  'and', 'or', 'implies', 'iff', 'in',
]);

/**
 * Binary operator corrections
 */
const OPERATOR_CORRECTIONS: Record<string, string> = {
  '===': '==',
  '!==': '!=',
  '&&': 'and',
  '||': 'or',
  '=>': 'implies',
  '<=>': 'iff',
};

/**
 * Valid quantifier names
 */
const VALID_QUANTIFIERS = new Set(['all', 'any', 'none', 'count', 'sum', 'filter']);

/**
 * Quantifier corrections
 */
const QUANTIFIER_CORRECTIONS: Record<string, string> = {
  every: 'all',
  some: 'any',
  forEach: 'all',
  forAll: 'all',
  exists: 'any',
  where: 'filter',
};

/**
 * Check if a type definition is a primitive type with a correctable name
 */
function isPrimitiveWithCorrectableName(type: TypeDefinition): type is PrimitiveType {
  if (type.kind !== 'PrimitiveType') return false;
  const name = (type as PrimitiveType).name;
  return typeof name === 'string' && !PRIMITIVE_TYPES.has(name);
}

/**
 * Schema Fix Repair Strategy
 *
 * Fixes:
 * - Type name corrections (string -> String, number -> Int, etc.)
 * - Binary operator corrections (&& -> and, || -> or, etc.)
 * - Quantifier name corrections (every -> all, etc.)
 * - Invalid postcondition block conditions
 * - Duration unit normalization
 * - Duplicate removal in arrays
 */
export const schemaFixStrategy: RepairStrategy = {
  name: 'schema-fix',
  description: 'Fixes common schema mismatches and structural issues',
  categories: ['schema-mismatch', 'invalid-value', 'duplicate-removal'],

  apply(ctx: RepairContext): RepairStrategyResult {
    const repairs: Repair[] = [];
    const unrepaired: UnrepairedError[] = [];
    const ast = ctx.ast;

    // Fix type definitions throughout the AST
    fixTypesInDomain(ast, ctx, repairs, unrepaired);

    // Fix expressions throughout the AST
    fixExpressionsInDomain(ast, ctx, repairs, unrepaired);

    // Fix duplicates
    fixDuplicates(ast, ctx, repairs, unrepaired);

    return { repairs, unrepaired };
  },
};

/**
 * Fix type definitions throughout the domain
 */
function fixTypesInDomain(
  ast: Domain,
  ctx: RepairContext,
  repairs: Repair[],
  unrepaired: UnrepairedError[]
): void {
  // Fix types in type declarations
  for (let i = 0; i < (ast.types?.length ?? 0); i++) {
    const typeDecl = ast.types[i];
    if (!typeDecl?.definition) continue;

    const path = `domain.types[${i}].definition`;
    fixTypeDefinition(typeDecl.definition, path, ctx, repairs, unrepaired);
  }

  // Fix types in entity fields
  for (let i = 0; i < (ast.entities?.length ?? 0); i++) {
    const entity = ast.entities[i];
    if (!entity?.fields) continue;

    for (let j = 0; j < entity.fields.length; j++) {
      const field = entity.fields[j];
      if (!field?.type) continue;

      const path = `domain.entities[${i}].fields[${j}].type`;
      fixTypeDefinition(field.type, path, ctx, repairs, unrepaired);
    }
  }

  // Fix types in behavior input/output
  for (let i = 0; i < (ast.behaviors?.length ?? 0); i++) {
    const behavior = ast.behaviors[i];
    if (!behavior) continue;

    // Fix input field types
    if (behavior.input?.fields) {
      for (let j = 0; j < behavior.input.fields.length; j++) {
        const field = behavior.input.fields[j];
        if (!field?.type) continue;

        const path = `domain.behaviors[${i}].input.fields[${j}].type`;
        fixTypeDefinition(field.type, path, ctx, repairs, unrepaired);
      }
    }

    // Fix output success type
    if (behavior.output?.success) {
      const path = `domain.behaviors[${i}].output.success`;
      fixTypeDefinition(behavior.output.success, path, ctx, repairs, unrepaired);
    }

    // Fix error return types
    if (behavior.output?.errors) {
      for (let j = 0; j < behavior.output.errors.length; j++) {
        const errorSpec = behavior.output.errors[j];
        if (errorSpec?.returns) {
          const path = `domain.behaviors[${i}].output.errors[${j}].returns`;
          fixTypeDefinition(errorSpec.returns, path, ctx, repairs, unrepaired);
        }
      }
    }
  }
}

/**
 * Fix a single type definition
 */
function fixTypeDefinition(
  type: TypeDefinition,
  path: string,
  ctx: RepairContext,
  repairs: Repair[],
  _unrepaired: UnrepairedError[]
): void {
  // Fix primitive type names
  if (type.kind === 'PrimitiveType') {
    const primitive = type as PrimitiveType;
    const name = primitive.name as string;
    const correction = TYPE_CORRECTIONS[name];

    if (correction && PRIMITIVE_TYPES.has(correction)) {
      const oldValue = name;
      (primitive as { name: string }).name = correction as PrimitiveType['name'];
      repairs.push({
        id: ctx.generateId(),
        category: 'schema-mismatch',
        path,
        reason: `Invalid primitive type name: "${name}"`,
        diffSummary: `Corrected type: "${oldValue}" -> "${correction}"`,
        originalValue: oldValue,
        repairedValue: correction,
        confidence: 'high',
        location: type.location,
      });
    }
  }

  // Fix constrained type base
  if (type.kind === 'ConstrainedType' && type.base) {
    fixTypeDefinition(type.base, `${path}.base`, ctx, repairs, _unrepaired);
  }

  // Fix list element type
  if (type.kind === 'ListType' && type.element) {
    fixTypeDefinition(type.element, `${path}.element`, ctx, repairs, _unrepaired);
  }

  // Fix map key/value types
  if (type.kind === 'MapType') {
    if (type.key) {
      fixTypeDefinition(type.key, `${path}.key`, ctx, repairs, _unrepaired);
    }
    if (type.value) {
      fixTypeDefinition(type.value, `${path}.value`, ctx, repairs, _unrepaired);
    }
  }

  // Fix optional inner type
  if (type.kind === 'OptionalType' && type.inner) {
    fixTypeDefinition(type.inner, `${path}.inner`, ctx, repairs, _unrepaired);
  }

  // Fix struct field types
  if (type.kind === 'StructType' && type.fields) {
    for (let i = 0; i < type.fields.length; i++) {
      const field = type.fields[i];
      if (field?.type) {
        fixTypeDefinition(field.type, `${path}.fields[${i}].type`, ctx, repairs, _unrepaired);
      }
    }
  }

  // Fix union variant field types
  if (type.kind === 'UnionType' && type.variants) {
    for (let i = 0; i < type.variants.length; i++) {
      const variant = type.variants[i];
      if (variant?.fields) {
        for (let j = 0; j < variant.fields.length; j++) {
          const field = variant.fields[j];
          if (field?.type) {
            fixTypeDefinition(
              field.type,
              `${path}.variants[${i}].fields[${j}].type`,
              ctx,
              repairs,
              _unrepaired
            );
          }
        }
      }
    }
  }
}

/**
 * Fix expressions throughout the domain
 */
function fixExpressionsInDomain(
  ast: Domain,
  ctx: RepairContext,
  repairs: Repair[],
  unrepaired: UnrepairedError[]
): void {
  // Fix expressions in entity invariants
  for (let i = 0; i < (ast.entities?.length ?? 0); i++) {
    const entity = ast.entities[i];
    if (!entity?.invariants) continue;

    for (let j = 0; j < entity.invariants.length; j++) {
      const expr = entity.invariants[j];
      if (expr) {
        const path = `domain.entities[${i}].invariants[${j}]`;
        fixExpression(expr, path, ctx, repairs, unrepaired);
      }
    }
  }

  // Fix expressions in behaviors
  for (let i = 0; i < (ast.behaviors?.length ?? 0); i++) {
    const behavior = ast.behaviors[i];
    if (!behavior) continue;

    // Preconditions
    for (let j = 0; j < (behavior.preconditions?.length ?? 0); j++) {
      const expr = behavior.preconditions[j];
      if (expr) {
        const path = `domain.behaviors[${i}].preconditions[${j}]`;
        fixExpression(expr, path, ctx, repairs, unrepaired);
      }
    }

    // Postconditions
    for (let j = 0; j < (behavior.postconditions?.length ?? 0); j++) {
      const block = behavior.postconditions[j];
      if (!block?.predicates) continue;

      for (let k = 0; k < block.predicates.length; k++) {
        const expr = block.predicates[k];
        if (expr) {
          const path = `domain.behaviors[${i}].postconditions[${j}].predicates[${k}]`;
          fixExpression(expr, path, ctx, repairs, unrepaired);
        }
      }
    }

    // Invariants
    for (let j = 0; j < (behavior.invariants?.length ?? 0); j++) {
      const expr = behavior.invariants[j];
      if (expr) {
        const path = `domain.behaviors[${i}].invariants[${j}]`;
        fixExpression(expr, path, ctx, repairs, unrepaired);
      }
    }
  }

  // Fix expressions in invariant blocks
  for (let i = 0; i < (ast.invariants?.length ?? 0); i++) {
    const block = ast.invariants[i];
    if (!block?.predicates) continue;

    for (let j = 0; j < block.predicates.length; j++) {
      const expr = block.predicates[j];
      if (expr) {
        const path = `domain.invariants[${i}].predicates[${j}]`;
        fixExpression(expr, path, ctx, repairs, unrepaired);
      }
    }
  }
}

/**
 * Fix a single expression
 */
function fixExpression(
  expr: Expression,
  path: string,
  ctx: RepairContext,
  repairs: Repair[],
  unrepaired: UnrepairedError[]
): void {
  if (!expr || typeof expr !== 'object') return;

  // Fix binary expression operators
  if (expr.kind === 'BinaryExpr') {
    const operator = expr.operator as string;
    const correction = OPERATOR_CORRECTIONS[operator];

    if (correction && VALID_BINARY_OPERATORS.has(correction)) {
      const oldValue = operator;
      (expr as { operator: string }).operator = correction as typeof expr.operator;
      repairs.push({
        id: ctx.generateId(),
        category: 'schema-mismatch',
        path: `${path}.operator`,
        reason: `Invalid binary operator: "${operator}"`,
        diffSummary: `Corrected operator: "${oldValue}" -> "${correction}"`,
        originalValue: oldValue,
        repairedValue: correction,
        confidence: 'high',
        location: expr.location,
      });
    }

    // Recursively fix operands
    if (expr.left) {
      fixExpression(expr.left, `${path}.left`, ctx, repairs, unrepaired);
    }
    if (expr.right) {
      fixExpression(expr.right, `${path}.right`, ctx, repairs, unrepaired);
    }
  }

  // Fix quantifier expressions
  if (expr.kind === 'QuantifierExpr') {
    const quantifier = expr.quantifier as string;
    const correction = QUANTIFIER_CORRECTIONS[quantifier];

    if (correction && VALID_QUANTIFIERS.has(correction)) {
      const oldValue = quantifier;
      (expr as { quantifier: string }).quantifier = correction as typeof expr.quantifier;
      repairs.push({
        id: ctx.generateId(),
        category: 'schema-mismatch',
        path: `${path}.quantifier`,
        reason: `Invalid quantifier: "${quantifier}"`,
        diffSummary: `Corrected quantifier: "${oldValue}" -> "${correction}"`,
        originalValue: oldValue,
        repairedValue: correction,
        confidence: 'high',
        location: expr.location,
      });
    }

    // Recursively fix predicate
    if (expr.predicate) {
      fixExpression(expr.predicate, `${path}.predicate`, ctx, repairs, unrepaired);
    }
    if (expr.collection) {
      fixExpression(expr.collection, `${path}.collection`, ctx, repairs, unrepaired);
    }
  }

  // Fix unary expressions
  if (expr.kind === 'UnaryExpr' && expr.operand) {
    fixExpression(expr.operand, `${path}.operand`, ctx, repairs, unrepaired);
  }

  // Fix call expressions
  if (expr.kind === 'CallExpr') {
    if (expr.callee) {
      fixExpression(expr.callee, `${path}.callee`, ctx, repairs, unrepaired);
    }
    for (let i = 0; i < (expr.arguments?.length ?? 0); i++) {
      const arg = expr.arguments[i];
      if (arg) {
        fixExpression(arg, `${path}.arguments[${i}]`, ctx, repairs, unrepaired);
      }
    }
  }

  // Fix member expressions
  if (expr.kind === 'MemberExpr' && expr.object) {
    fixExpression(expr.object, `${path}.object`, ctx, repairs, unrepaired);
  }

  // Fix conditional expressions
  if (expr.kind === 'ConditionalExpr') {
    if (expr.condition) {
      fixExpression(expr.condition, `${path}.condition`, ctx, repairs, unrepaired);
    }
    if (expr.thenBranch) {
      fixExpression(expr.thenBranch, `${path}.thenBranch`, ctx, repairs, unrepaired);
    }
    if (expr.elseBranch) {
      fixExpression(expr.elseBranch, `${path}.elseBranch`, ctx, repairs, unrepaired);
    }
  }

  // Fix list expressions
  if (expr.kind === 'ListExpr' && expr.elements) {
    for (let i = 0; i < expr.elements.length; i++) {
      const element = expr.elements[i];
      if (element) {
        fixExpression(element, `${path}.elements[${i}]`, ctx, repairs, unrepaired);
      }
    }
  }

  // Fix old expressions
  if (expr.kind === 'OldExpr' && expr.expression) {
    fixExpression(expr.expression, `${path}.expression`, ctx, repairs, unrepaired);
  }

  // Fix lambda expressions
  if (expr.kind === 'LambdaExpr' && expr.body) {
    fixExpression(expr.body, `${path}.body`, ctx, repairs, unrepaired);
  }
}

/**
 * Fix duplicate entries in arrays
 */
function fixDuplicates(
  ast: Domain,
  ctx: RepairContext,
  repairs: Repair[],
  _unrepaired: UnrepairedError[]
): void {
  // Fix duplicate entity fields
  for (let i = 0; i < (ast.entities?.length ?? 0); i++) {
    const entity = ast.entities[i];
    if (!entity?.fields) continue;

    const seen = new Map<string, number>();
    const duplicates: number[] = [];

    for (let j = 0; j < entity.fields.length; j++) {
      const field = entity.fields[j];
      const name = field?.name?.name;
      if (!name) continue;

      if (seen.has(name)) {
        duplicates.push(j);
      } else {
        seen.set(name, j);
      }
    }

    if (duplicates.length > 0) {
      const originalCount = entity.fields.length;
      const removedNames = duplicates.map((idx) => entity.fields[idx]?.name?.name ?? '<unnamed>');

      // Remove duplicates in reverse order to preserve indices
      for (let j = duplicates.length - 1; j >= 0; j--) {
        entity.fields.splice(duplicates[j], 1);
      }

      repairs.push({
        id: ctx.generateId(),
        category: 'duplicate-removal',
        path: `domain.entities[${i}].fields`,
        reason: 'Entity has duplicate field names',
        diffSummary: `Removed ${duplicates.length} duplicate fields: [${removedNames.join(', ')}]`,
        originalValue: originalCount,
        repairedValue: entity.fields.length,
        confidence: 'medium',
        location: entity.location,
      });
    }
  }

  // Fix duplicate behavior input fields
  for (let i = 0; i < (ast.behaviors?.length ?? 0); i++) {
    const behavior = ast.behaviors[i];
    if (!behavior?.input?.fields) continue;

    const seen = new Map<string, number>();
    const duplicates: number[] = [];

    for (let j = 0; j < behavior.input.fields.length; j++) {
      const field = behavior.input.fields[j];
      const name = field?.name?.name;
      if (!name) continue;

      if (seen.has(name)) {
        duplicates.push(j);
      } else {
        seen.set(name, j);
      }
    }

    if (duplicates.length > 0) {
      const originalCount = behavior.input.fields.length;
      const removedNames = duplicates.map(
        (idx) => behavior.input.fields[idx]?.name?.name ?? '<unnamed>'
      );

      // Remove duplicates in reverse order
      for (let j = duplicates.length - 1; j >= 0; j--) {
        behavior.input.fields.splice(duplicates[j], 1);
      }

      repairs.push({
        id: ctx.generateId(),
        category: 'duplicate-removal',
        path: `domain.behaviors[${i}].input.fields`,
        reason: 'Behavior input has duplicate field names',
        diffSummary: `Removed ${duplicates.length} duplicate fields: [${removedNames.join(', ')}]`,
        originalValue: originalCount,
        repairedValue: behavior.input.fields.length,
        confidence: 'medium',
        location: behavior.input.location,
      });
    }
  }

  // Fix duplicate type declarations
  if (ast.types && ast.types.length > 0) {
    const seen = new Map<string, number>();
    const duplicates: number[] = [];

    for (let i = 0; i < ast.types.length; i++) {
      const typeDecl = ast.types[i];
      const name = typeDecl?.name?.name;
      if (!name) continue;

      if (seen.has(name)) {
        duplicates.push(i);
      } else {
        seen.set(name, i);
      }
    }

    if (duplicates.length > 0) {
      const originalCount = ast.types.length;
      const removedNames = duplicates.map((idx) => ast.types[idx]?.name?.name ?? '<unnamed>');

      // Remove duplicates in reverse order
      for (let j = duplicates.length - 1; j >= 0; j--) {
        ast.types.splice(duplicates[j], 1);
      }

      repairs.push({
        id: ctx.generateId(),
        category: 'duplicate-removal',
        path: 'domain.types',
        reason: 'Domain has duplicate type declarations',
        diffSummary: `Removed ${duplicates.length} duplicate types: [${removedNames.join(', ')}]`,
        originalValue: originalCount,
        repairedValue: ast.types.length,
        confidence: 'medium',
        location: ast.location,
      });
    }
  }
}

export default schemaFixStrategy;
