// ============================================================================
// Expression Compiler - Converts ISL expressions to TypeScript assertions
// ============================================================================

import type * as AST from '../../../master_contracts/ast';

/**
 * Compiles an ISL expression to TypeScript code
 */
export function compileExpression(expr: AST.Expression): string {
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
      return compileDuration(expr);

    case 'RegexLiteral':
      return `/${expr.pattern}/${expr.flags}`;

    case 'BinaryExpr':
      return compileBinaryExpr(expr);

    case 'UnaryExpr':
      return compileUnaryExpr(expr);

    case 'CallExpr':
      return compileCallExpr(expr);

    case 'MemberExpr':
      return `${compileExpression(expr.object)}.${expr.property.name}`;

    case 'IndexExpr':
      return `${compileExpression(expr.object)}[${compileExpression(expr.index)}]`;

    case 'QuantifierExpr':
      return compileQuantifierExpr(expr);

    case 'ConditionalExpr':
      return `(${compileExpression(expr.condition)} ? ${compileExpression(expr.thenBranch)} : ${compileExpression(expr.elseBranch)})`;

    case 'OldExpr':
      return `__old__.${compileExpression(expr.expression)}`;

    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';

    case 'InputExpr':
      return `input.${expr.property.name}`;

    case 'LambdaExpr':
      return `(${expr.params.map((p) => p.name).join(', ')}) => ${compileExpression(expr.body)}`;

    case 'ListExpr':
      return `[${expr.elements.map(compileExpression).join(', ')}]`;

    case 'MapExpr':
      return `{ ${expr.entries.map((e) => `[${compileExpression(e.key)}]: ${compileExpression(e.value)}`).join(', ')} }`;

    default:
      return `/* unsupported: ${(expr as AST.ASTNode).kind} */`;
  }
}

function compileDuration(expr: AST.DurationLiteral): string {
  const msValue = convertToMs(expr.value, expr.unit);
  return String(msValue);
}

function convertToMs(value: number, unit: AST.DurationLiteral['unit']): number {
  switch (unit) {
    case 'ms':
      return value;
    case 'seconds':
      return value * 1000;
    case 'minutes':
      return value * 60 * 1000;
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'days':
      return value * 24 * 60 * 60 * 1000;
  }
}

function compileBinaryExpr(expr: AST.BinaryExpr): string {
  const left = compileExpression(expr.left);
  const right = compileExpression(expr.right);
  const op = mapBinaryOperator(expr.operator);
  return `(${left} ${op} ${right})`;
}

function mapBinaryOperator(op: AST.BinaryOperator): string {
  switch (op) {
    case '==':
      return '===';
    case '!=':
      return '!==';
    case 'and':
      return '&&';
    case 'or':
      return '||';
    case 'implies':
      return '|| !'; // a implies b === !a || b
    case 'iff':
      return '==='; // boolean equality
    case 'in':
      return 'in';
    default:
      return op;
  }
}

function compileUnaryExpr(expr: AST.UnaryExpr): string {
  const operand = compileExpression(expr.operand);
  const op = expr.operator === 'not' ? '!' : expr.operator;
  return `${op}(${operand})`;
}

function compileCallExpr(expr: AST.CallExpr): string {
  const callee = compileExpression(expr.callee);
  const args = expr.arguments.map(compileExpression).join(', ');
  return `${callee}(${args})`;
}

function compileQuantifierExpr(expr: AST.QuantifierExpr): string {
  const collection = compileExpression(expr.collection);
  const variable = expr.variable.name;
  const predicate = compileExpression(expr.predicate);

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
      return `${collection}.filter((${variable}) => ${predicate}).reduce((a, b) => a + b, 0)`;
    case 'filter':
      return `${collection}.filter((${variable}) => ${predicate})`;
  }
}

/**
 * Compiles an expression to an assertion statement
 */
export function compileAssertion(expr: AST.Expression, framework: 'jest' | 'vitest'): string {
  const compiled = compileExpression(expr);

  // Handle specific patterns
  if (expr.kind === 'BinaryExpr') {
    const left = compileExpression(expr.left);
    const right = compileExpression(expr.right);

    switch (expr.operator) {
      case '==':
        return `expect(${left}).toEqual(${right});`;
      case '!=':
        return `expect(${left}).not.toEqual(${right});`;
      case '<':
        return `expect(${left}).toBeLessThan(${right});`;
      case '>':
        return `expect(${left}).toBeGreaterThan(${right});`;
      case '<=':
        return `expect(${left}).toBeLessThanOrEqual(${right});`;
      case '>=':
        return `expect(${left}).toBeGreaterThanOrEqual(${right});`;
    }
  }

  // Default: use toBe for truthy check
  return `expect(${compiled}).toBe(true);`;
}

/**
 * Compiles an expression to check if result is success/error
 */
export function compileResultCheck(expr: AST.Expression): { type: 'success' | 'error'; code: string } {
  if (expr.kind === 'BinaryExpr' && expr.operator === '==' && expr.left.kind === 'Identifier') {
    if (expr.left.name === 'result') {
      if (expr.right.kind === 'Identifier') {
        if (expr.right.name === 'success') {
          return { type: 'success', code: 'expect(result.success).toBe(true);' };
        } else {
          return { type: 'error', code: `expect(result.error).toBe('${expr.right.name}');` };
        }
      }
    }
  }

  // Check for "result is success" pattern (would be parsed as binary 'is' op)
  const compiled = compileExpression(expr);
  if (compiled.includes('result') && compiled.includes('success')) {
    return { type: 'success', code: 'expect(result.success).toBe(true);' };
  }

  return { type: 'success', code: `expect(${compiled}).toBe(true);` };
}
