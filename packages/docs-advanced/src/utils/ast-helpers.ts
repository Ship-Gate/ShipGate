// ============================================================================
// AST Helper Functions
// ============================================================================

import type * as AST from '@isl-lang/parser';

/**
 * Convert an expression to string representation
 */
export function expressionToString(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;

    case 'QualifiedName':
      return expr.parts.map((p) => p.name).join('.');

    case 'StringLiteral':
      return JSON.stringify(expr.value);

    case 'NumberLiteral':
      return String(expr.value);

    case 'BooleanLiteral':
      return String(expr.value);

    case 'NullLiteral':
      return 'null';

    case 'DurationLiteral':
      return `${expr.value}.${expr.unit}`;

    case 'RegexLiteral':
      return `/${expr.pattern}/${expr.flags}`;

    case 'BinaryExpr':
      return `(${expressionToString(expr.left)} ${expr.operator} ${expressionToString(expr.right)})`;

    case 'UnaryExpr':
      return `${expr.operator}(${expressionToString(expr.operand)})`;

    case 'CallExpr':
      return `${expressionToString(expr.callee)}(${expr.arguments.map(expressionToString).join(', ')})`;

    case 'MemberExpr':
      return `${expressionToString(expr.object)}.${expr.property.name}`;

    case 'IndexExpr':
      return `${expressionToString(expr.object)}[${expressionToString(expr.index)}]`;

    case 'QuantifierExpr':
      return `${expr.quantifier}(${expr.variable.name} in ${expressionToString(expr.collection)}, ${expressionToString(expr.predicate)})`;

    case 'ConditionalExpr':
      return `${expressionToString(expr.condition)} ? ${expressionToString(expr.thenBranch)} : ${expressionToString(expr.elseBranch)}`;

    case 'OldExpr':
      return `old(${expressionToString(expr.expression)})`;

    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';

    case 'InputExpr':
      return `input.${expr.property.name}`;

    case 'LambdaExpr':
      return `(${expr.params.map((p) => p.name).join(', ')}) => ${expressionToString(expr.body)}`;

    case 'ListExpr':
      return `[${expr.elements.map(expressionToString).join(', ')}]`;

    case 'MapExpr':
      return `{ ${expr.entries.map((e) => `${expressionToString(e.key)}: ${expressionToString(e.value)}`).join(', ')} }`;

    default:
      return `<${(expr as AST.ASTNode).kind}>`;
  }
}

/**
 * Convert a type definition to string representation
 */
export function typeToString(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return type.name;

    case 'ConstrainedType':
      const constraints = type.constraints
        .map((c) => `${c.name}: ${expressionToString(c.value)}`)
        .join(', ');
      return `${typeToString(type.base)} { ${constraints} }`;

    case 'EnumType':
      return type.variants.map((v) => v.name.name).join(' | ');

    case 'StructType':
      const fields = type.fields
        .map((f) => `${f.name.name}${f.optional ? '?' : ''}: ${typeToString(f.type)}`)
        .join(', ');
      return `{ ${fields} }`;

    case 'UnionType':
      return type.variants.map((v) => v.name.name).join(' | ');

    case 'ListType':
      return `List<${typeToString(type.element)}>`;

    case 'MapType':
      return `Map<${typeToString(type.key)}, ${typeToString(type.value)}>`;

    case 'OptionalType':
      return `${typeToString(type.inner)}?`;

    case 'ReferenceType':
      return type.name.parts.map((p) => p.name).join('.');

    default:
      return 'unknown';
  }
}

/**
 * Find all referenced types in an expression
 */
export function findReferencedTypes(expr: AST.Expression): string[] {
  const types: string[] = [];

  function visit(e: AST.Expression): void {
    switch (e.kind) {
      case 'Identifier':
        // Could be a type reference
        if (e.name[0] === e.name[0]?.toUpperCase()) {
          types.push(e.name);
        }
        break;

      case 'QualifiedName':
        types.push(e.parts[0]?.name ?? '');
        break;

      case 'BinaryExpr':
        visit(e.left);
        visit(e.right);
        break;

      case 'UnaryExpr':
        visit(e.operand);
        break;

      case 'CallExpr':
        visit(e.callee);
        e.arguments.forEach(visit);
        break;

      case 'MemberExpr':
        visit(e.object);
        break;

      case 'QuantifierExpr':
        visit(e.collection);
        visit(e.predicate);
        break;

      case 'ConditionalExpr':
        visit(e.condition);
        visit(e.thenBranch);
        visit(e.elseBranch);
        break;

      case 'OldExpr':
        visit(e.expression);
        break;

      case 'LambdaExpr':
        visit(e.body);
        break;

      case 'ListExpr':
        e.elements.forEach(visit);
        break;

      case 'MapExpr':
        e.entries.forEach((entry) => {
          visit(entry.key);
          visit(entry.value);
        });
        break;
    }
  }

  visit(expr);
  return [...new Set(types)];
}

/**
 * Find all entity references in a behavior
 */
export function findEntityReferences(behavior: AST.Behavior, domain: AST.Domain): string[] {
  const entities = new Set<string>();
  const entityNames = domain.entities.map((e) => e.name.name);

  function checkExpression(expr: AST.Expression): void {
    const refs = findReferencedTypes(expr);
    for (const ref of refs) {
      if (entityNames.includes(ref)) {
        entities.add(ref);
      }
    }
  }

  // Check preconditions
  behavior.preconditions.forEach(checkExpression);

  // Check postconditions
  for (const block of behavior.postconditions) {
    block.predicates.forEach(checkExpression);
  }

  // Check invariants
  behavior.invariants.forEach(checkExpression);

  return Array.from(entities);
}

/**
 * Extract field path from member expression
 */
export function extractFieldPath(expr: AST.Expression): string[] {
  const path: string[] = [];

  function visit(e: AST.Expression): void {
    if (e.kind === 'Identifier') {
      path.unshift(e.name);
    } else if (e.kind === 'MemberExpr') {
      path.unshift(e.property.name);
      visit(e.object);
    } else if (e.kind === 'InputExpr') {
      path.unshift(e.property.name);
      path.unshift('input');
    } else if (e.kind === 'ResultExpr') {
      if (e.property) {
        path.unshift(e.property.name);
      }
      path.unshift('result');
    }
  }

  visit(expr);
  return path;
}

/**
 * Check if an expression is a simple comparison
 */
export function isSimpleComparison(expr: AST.Expression): boolean {
  if (expr.kind !== 'BinaryExpr') return false;
  const ops = ['==', '!=', '<', '>', '<=', '>='];
  return ops.includes(expr.operator);
}

/**
 * Extract comparison info from a binary expression
 */
export function extractComparison(expr: AST.BinaryExpr): {
  left: string;
  operator: string;
  right: string;
} {
  return {
    left: expressionToString(expr.left),
    operator: expr.operator,
    right: expressionToString(expr.right),
  };
}
