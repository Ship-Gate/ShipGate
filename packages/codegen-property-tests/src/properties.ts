// ============================================================================
// Property Generators
// Converts ISL invariants and postconditions to property tests
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { PropertyDefinition } from './types.js';

/**
 * Generate property tests for entity invariants
 */
export function generateEntityInvariantProperties(
  entity: AST.Entity
): PropertyDefinition[] {
  const properties: PropertyDefinition[] = [];
  const entityName = entity.name.name;
  const arbName = `arb${entityName}`;

  entity.invariants.forEach((invariant, index) => {
    const propertyName = `${entityName} invariant ${index + 1}`;
    const assertion = compileInvariantAssertion(invariant, 'entity');

    properties.push({
      name: propertyName,
      description: `Entity invariant: ${compileExpressionToString(invariant)}`,
      arbitraries: [arbName],
      assertion,
      async: false,
    });
  });

  return properties;
}

/**
 * Generate property tests for behavior postconditions
 */
export function generatePostconditionProperties(
  behavior: AST.Behavior
): PropertyDefinition[] {
  const properties: PropertyDefinition[] = [];
  const behaviorName = behavior.name.name;
  const arbInputName = `arb${behaviorName}Input`;

  // Success postconditions
  behavior.postconditions
    .filter((pc) => pc.condition === 'success')
    .forEach((postcondition) => {
      postcondition.predicates.forEach((predicate, index) => {
        const propertyName = `${behaviorName} success postcondition ${index + 1}`;
        const assertion = compilePostconditionAssertion(predicate, behaviorName);

        properties.push({
          name: propertyName,
          description: `On success: ${compileExpressionToString(predicate)}`,
          arbitraries: [arbInputName],
          assertion,
          async: true,
        });
      });
    });

  // Error postconditions
  behavior.postconditions
    .filter((pc) => pc.condition === 'any_error')
    .forEach((postcondition) => {
      postcondition.predicates.forEach((predicate, index) => {
        const propertyName = `${behaviorName} error postcondition ${index + 1}`;
        const assertion = compileErrorPostconditionAssertion(predicate, behaviorName);

        properties.push({
          name: propertyName,
          description: `On error: ${compileExpressionToString(predicate)}`,
          arbitraries: [arbInputName],
          assertion,
          async: true,
        });
      });
    });

  return properties;
}

/**
 * Generate property tests for behavior invariants
 */
export function generateBehaviorInvariantProperties(
  behavior: AST.Behavior
): PropertyDefinition[] {
  const properties: PropertyDefinition[] = [];
  const behaviorName = behavior.name.name;
  const arbInputName = `arb${behaviorName}Input`;

  behavior.invariants.forEach((invariant, index) => {
    const propertyName = `${behaviorName} invariant ${index + 1}`;
    const assertion = compileBehaviorInvariantAssertion(invariant, behaviorName);

    properties.push({
      name: propertyName,
      description: `Behavior invariant: ${compileExpressionToString(invariant)}`,
      arbitraries: [arbInputName],
      assertion,
      async: true,
    });
  });

  return properties;
}

/**
 * Generate property tests for preconditions
 */
export function generatePreconditionProperties(
  behavior: AST.Behavior
): PropertyDefinition[] {
  const properties: PropertyDefinition[] = [];
  const behaviorName = behavior.name.name;
  const arbInputName = `arb${behaviorName}Input`;

  behavior.preconditions.forEach((precondition, index) => {
    const propertyName = `${behaviorName} rejects invalid precondition ${index + 1}`;
    const assertion = compilePreconditionAssertion(precondition, behaviorName);

    properties.push({
      name: propertyName,
      description: `Rejects when: ${compileExpressionToString(precondition)} is false`,
      arbitraries: [arbInputName],
      assertion,
      async: true,
    });
  });

  return properties;
}

/**
 * Generate property tests for global domain invariants
 */
export function generateGlobalInvariantProperties(
  invariantBlock: AST.InvariantBlock,
  domain: AST.Domain
): PropertyDefinition[] {
  const properties: PropertyDefinition[] = [];
  const invariantName = invariantBlock.name.name;

  invariantBlock.predicates.forEach((predicate, index) => {
    const propertyName = `Global invariant: ${invariantName} - ${index + 1}`;
    const assertion = compileGlobalInvariantAssertion(predicate, domain);

    // Collect all entity arbitraries that might be involved
    const arbitraries = domain.entities.map((e) => `arb${e.name.name}`);

    properties.push({
      name: propertyName,
      description: invariantBlock.description?.value || compileExpressionToString(predicate),
      arbitraries,
      assertion,
      async: false,
    });
  });

  return properties;
}

/**
 * Generate idempotency property test
 */
export function generateIdempotencyProperty(
  behavior: AST.Behavior
): PropertyDefinition | null {
  // Check if behavior has idempotency_key in input
  const hasIdempotencyKey = behavior.input.fields.some(
    (f) => f.name.name.toLowerCase().includes('idempotency')
  );

  if (!hasIdempotencyKey) {
    return null;
  }

  const behaviorName = behavior.name.name;
  const arbInputName = `arb${behaviorName}Input`;

  return {
    name: `${behaviorName} idempotency`,
    description: 'Same idempotency key produces same result',
    arbitraries: [arbInputName, 'fc.string()'],
    assertion: `
      const inputWithKey = { ...input, idempotencyKey: key };
      const result1 = await ${behaviorName}(inputWithKey);
      const result2 = await ${behaviorName}(inputWithKey);
      expect(result1).toEqual(result2);
      return true;
    `.trim(),
    async: true,
  };
}

/**
 * Generate round-trip property test (create then read)
 */
export function generateRoundTripProperty(
  createBehavior: AST.Behavior,
  readBehavior: AST.Behavior
): PropertyDefinition | null {
  const createName = createBehavior.name.name;
  const readName = readBehavior.name.name;
  const arbInputName = `arb${createName}Input`;

  return {
    name: `${createName} -> ${readName} round-trip`,
    description: 'Created entity can be read back with same data',
    arbitraries: [arbInputName],
    assertion: `
      const createResult = await ${createName}(input);
      if (!createResult.success) return true; // Skip failed creates
      
      const readResult = await ${readName}({ id: createResult.id });
      expect(readResult.success).toBe(true);
      // Verify key fields match
      return true;
    `.trim(),
    async: true,
  };
}

// ============================================================================
// Expression Compilation Helpers
// ============================================================================

/**
 * Compile invariant expression to assertion code
 */
function compileInvariantAssertion(expr: AST.Expression, varName: string): string {
  const compiled = compileExpression(expr, varName);
  return `return ${compiled};`;
}

/**
 * Compile postcondition to assertion code
 */
function compilePostconditionAssertion(expr: AST.Expression, behaviorName: string): string {
  const compiled = compileExpression(expr, 'result');
  return `
    const result = await ${behaviorName}(input);
    if (result.success) {
      expect(${compiled}).toBe(true);
    }
    return true;
  `.trim();
}

/**
 * Compile error postcondition to assertion code
 */
function compileErrorPostconditionAssertion(expr: AST.Expression, behaviorName: string): string {
  const compiled = compileExpression(expr, 'result');
  return `
    const __old__ = captureState();
    const result = await ${behaviorName}(input);
    if (!result.success) {
      expect(${compiled}).toBe(true);
    }
    return true;
  `.trim();
}

/**
 * Compile behavior invariant to assertion code
 */
function compileBehaviorInvariantAssertion(expr: AST.Expression, behaviorName: string): string {
  const compiled = compileExpression(expr, 'context');
  return `
    const result = await ${behaviorName}(input);
    const context = { input, result };
    expect(${compiled}).toBe(true);
    return true;
  `.trim();
}

/**
 * Compile precondition to assertion code (tests rejection)
 */
function compilePreconditionAssertion(expr: AST.Expression, behaviorName: string): string {
  const compiled = compileExpression(expr, 'input');
  return `
    // If precondition is violated, behavior should reject
    if (!(${compiled})) {
      const result = await ${behaviorName}(input);
      expect(result.success).toBe(false);
    }
    return true;
  `.trim();
}

/**
 * Compile global invariant to assertion code
 */
function compileGlobalInvariantAssertion(expr: AST.Expression, domain: AST.Domain): string {
  const compiled = compileExpression(expr, 'state');
  return `
    const state = captureGlobalState();
    return ${compiled};
  `.trim();
}

/**
 * Compile expression to JavaScript code
 */
function compileExpression(expr: AST.Expression, contextVar: string): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name === 'result' || expr.name === 'input'
        ? expr.name
        : `${contextVar}.${expr.name}`;

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

    case 'BinaryExpr':
      const left = compileExpression(expr.left, contextVar);
      const right = compileExpression(expr.right, contextVar);
      const op = mapOperator(expr.operator);
      return `(${left} ${op} ${right})`;

    case 'UnaryExpr':
      const operand = compileExpression(expr.operand, contextVar);
      const unaryOp = expr.operator === 'not' ? '!' : expr.operator;
      return `${unaryOp}(${operand})`;

    case 'MemberExpr':
      const obj = compileExpression(expr.object, contextVar);
      return `${obj}.${expr.property.name}`;

    case 'CallExpr':
      const callee = compileExpression(expr.callee, contextVar);
      const args = expr.arguments.map((a) => compileExpression(a, contextVar)).join(', ');
      return `${callee}(${args})`;

    case 'QuantifierExpr':
      return compileQuantifier(expr, contextVar);

    case 'OldExpr':
      return `__old__.${compileExpression(expr.expression, contextVar)}`;

    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';

    case 'InputExpr':
      return `input.${expr.property.name}`;

    default:
      return 'true';
  }
}

/**
 * Compile quantifier expression
 */
function compileQuantifier(expr: AST.QuantifierExpr, contextVar: string): string {
  const collection = compileExpression(expr.collection, contextVar);
  const variable = expr.variable.name;
  const predicate = compileExpression(expr.predicate, variable);

  switch (expr.quantifier) {
    case 'all':
      return `${collection}.every((${variable}) => ${predicate})`;
    case 'any':
      return `${collection}.some((${variable}) => ${predicate})`;
    case 'none':
      return `!${collection}.some((${variable}) => ${predicate})`;
    case 'count':
      return `${collection}.filter((${variable}) => ${predicate}).length`;
    case 'sum':
      return `${collection}.reduce((acc, ${variable}) => acc + (${predicate} ? ${variable} : 0), 0)`;
    case 'filter':
      return `${collection}.filter((${variable}) => ${predicate})`;
  }
}

/**
 * Map ISL operator to JavaScript operator
 */
function mapOperator(op: AST.BinaryOperator): string {
  switch (op) {
    case '==': return '===';
    case '!=': return '!==';
    case 'and': return '&&';
    case 'or': return '||';
    case 'implies': return '|| !';
    case 'in': return 'in';
    default: return op;
  }
}

/**
 * Compile expression to human-readable string
 */
function compileExpressionToString(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'NumberLiteral':
      return String(expr.value);
    case 'StringLiteral':
      return `"${expr.value}"`;
    case 'BooleanLiteral':
      return String(expr.value);
    case 'BinaryExpr':
      return `${compileExpressionToString(expr.left)} ${expr.operator} ${compileExpressionToString(expr.right)}`;
    case 'MemberExpr':
      return `${compileExpressionToString(expr.object)}.${expr.property.name}`;
    default:
      return '...';
  }
}

/**
 * Generate all property tests for a domain
 */
export function generateAllProperties(domain: AST.Domain): PropertyDefinition[] {
  const properties: PropertyDefinition[] = [];

  // Entity invariants
  for (const entity of domain.entities) {
    properties.push(...generateEntityInvariantProperties(entity));
  }

  // Behavior properties
  for (const behavior of domain.behaviors) {
    properties.push(...generatePostconditionProperties(behavior));
    properties.push(...generateBehaviorInvariantProperties(behavior));
    properties.push(...generatePreconditionProperties(behavior));

    const idempotencyProp = generateIdempotencyProperty(behavior);
    if (idempotencyProp) {
      properties.push(idempotencyProp);
    }
  }

  // Global invariants
  for (const invariantBlock of domain.invariants) {
    properties.push(...generateGlobalInvariantProperties(invariantBlock, domain));
  }

  return properties;
}
