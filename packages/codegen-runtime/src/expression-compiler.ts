/**
 * Expression Compiler
 * 
 * Compiles ISL expressions into TypeScript runtime assertions.
 */

import type { Expression, Identifier } from '@isl-lang/parser';

interface CompileContext {
  /** Variables in scope */
  variables: Set<string>;
  /** Whether we're in a postcondition (can use old()) */
  inPostcondition: boolean;
  /** The behavior name for error messages */
  behaviorName: string;
}

/**
 * Compile an ISL expression to TypeScript code
 */
export function compileExpression(expr: Expression, ctx: CompileContext): string {
  switch (expr.kind) {
    case 'Identifier':
      return compileIdentifier(expr, ctx);
    
    case 'NumberLiteral':
      return String(expr.value);
    
    case 'StringLiteral':
      return JSON.stringify(expr.value);
    
    case 'BooleanLiteral':
      return String(expr.value);
    
    case 'NullLiteral':
      return 'null';
    
    case 'BinaryExpr':
      return compileBinaryExpr(expr, ctx);
    
    case 'UnaryExpr':
      return compileUnaryExpr(expr, ctx);
    
    case 'MemberExpr':
      return compileMemberExpr(expr, ctx);
    
    case 'CallExpr':
      return compileCallExpr(expr, ctx);
    
    case 'OldExpr':
      if (!ctx.inPostcondition) {
        throw new Error('old() can only be used in postconditions');
      }
      return `__old.${compileExpression(expr.expression, ctx)}`;
    
    case 'ResultExpr':
      if (!ctx.inPostcondition) {
        throw new Error('result can only be used in postconditions');
      }
      return expr.property ? `__result.${expr.property.name}` : '__result';
    
    case 'InputExpr':
      return `__input.${expr.property.name}`;
    
    case 'QuantifierExpr':
      return compileQuantifierExpr(expr, ctx);
    
    case 'ConditionalExpr':
      return `(${compileExpression(expr.condition, ctx)} ? ${compileExpression(expr.thenBranch, ctx)} : ${compileExpression(expr.elseBranch, ctx)})`;
    
    case 'ListExpr':
      const elements = (expr.elements ?? []).map(e => compileExpression(e, ctx));
      return `[${elements.join(', ')}]`;
    
    default:
      return `/* unsupported: ${expr.kind} */`;
  }
}

function compileIdentifier(expr: Identifier, ctx: CompileContext): string {
  const name = expr.name;
  
  // Check if it's in variables scope
  if (ctx.variables.has(name)) {
    return name;
  }
  
  // It might be an input parameter
  return name;
}

function compileBinaryExpr(expr: { kind: 'BinaryExpr'; operator: string; left: Expression; right: Expression }, ctx: CompileContext): string {
  const left = compileExpression(expr.left, ctx);
  const right = compileExpression(expr.right, ctx);
  
  // Map ISL operators to TypeScript
  const opMap: Record<string, string> = {
    '==': '===',
    '!=': '!==',
    'and': '&&',
    'or': '||',
    'implies': '? true :',
    'iff': '===',
  };
  
  const op = opMap[expr.operator] ?? expr.operator;
  
  // Special handling for 'implies'
  if (expr.operator === 'implies') {
    return `(!${left} || ${right})`;
  }
  
  // Special handling for 'in'
  if (expr.operator === 'in') {
    return `(${right}).includes(${left})`;
  }
  
  return `(${left} ${op} ${right})`;
}

function compileUnaryExpr(expr: { kind: 'UnaryExpr'; operator: string; operand: Expression }, ctx: CompileContext): string {
  const operand = compileExpression(expr.operand, ctx);
  
  const opMap: Record<string, string> = {
    'not': '!',
    '-': '-',
    '+': '+',
  };
  
  const op = opMap[expr.operator] ?? expr.operator;
  return `${op}(${operand})`;
}

function compileMemberExpr(expr: { kind: 'MemberExpr'; object: Expression; property: Identifier }, ctx: CompileContext): string {
  const object = compileExpression(expr.object, ctx);
  return `${object}.${expr.property.name}`;
}

function compileCallExpr(expr: { kind: 'CallExpr'; callee: Expression; arguments: Expression[] }, ctx: CompileContext): string {
  const callee = compileExpression(expr.callee, ctx);
  const args = (expr.arguments ?? []).map(a => compileExpression(a, ctx));
  
  // Handle built-in ISL methods
  if (callee.endsWith('.exists')) {
    // entity.exists(id) -> __entityStore.has('entity', id)
    const entity = callee.replace('.exists', '');
    return `__entityStore.has('${entity}', ${args[0] ?? 'undefined'})`;
  }
  
  if (callee.endsWith('.lookup')) {
    // entity.lookup(id) -> __entityStore.get('entity', id)
    const entity = callee.replace('.lookup', '');
    return `__entityStore.get('${entity}', ${args[0] ?? 'undefined'})`;
  }
  
  if (callee.endsWith('.count')) {
    // entity.count() -> __entityStore.count('entity')
    const entity = callee.replace('.count', '');
    return `__entityStore.count('${entity}')`;
  }
  
  return `${callee}(${args.join(', ')})`;
}

function compileQuantifierExpr(expr: { kind: 'QuantifierExpr'; quantifier: string; variable: Identifier; collection: Expression; predicate: Expression }, ctx: CompileContext): string {
  const collection = compileExpression(expr.collection, ctx);
  const varName = expr.variable.name;
  
  // Add variable to scope for predicate compilation
  const newCtx = { ...ctx, variables: new Set([...ctx.variables, varName]) };
  const predicate = compileExpression(expr.predicate, newCtx);
  
  switch (expr.quantifier) {
    case 'all':
      return `(${collection}).every((${varName}) => ${predicate})`;
    case 'any':
      return `(${collection}).some((${varName}) => ${predicate})`;
    case 'none':
      return `!(${collection}).some((${varName}) => ${predicate})`;
    case 'count':
      return `(${collection}).filter((${varName}) => ${predicate}).length`;
    case 'sum':
      return `(${collection}).filter((${varName}) => ${predicate}).reduce((a, b) => a + b, 0)`;
    case 'filter':
      return `(${collection}).filter((${varName}) => ${predicate})`;
    default:
      return `/* unsupported quantifier: ${expr.quantifier} */`;
  }
}

/**
 * Generate assertion code for a list of conditions
 */
export function compileAssertions(
  conditions: Expression[],
  type: 'precondition' | 'postcondition' | 'invariant',
  behaviorName: string,
  throwOnFailure: boolean = true
): string {
  const ctx: CompileContext = {
    variables: new Set(),
    inPostcondition: type === 'postcondition',
    behaviorName,
  };
  
  const lines: string[] = [];
  
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    if (!condition) continue;
    
    const compiled = compileExpression(condition, ctx);
    const conditionStr = expressionToReadable(condition);
    
    if (throwOnFailure) {
      lines.push(`  if (!(${compiled})) {`);
      lines.push(`    throw new ${capitalize(type)}Error('${behaviorName}', '${conditionStr}', { index: ${i} });`);
      lines.push(`  }`);
    } else {
      lines.push(`  __violations.push({ type: '${type}', behavior: '${behaviorName}', condition: '${conditionStr}', passed: ${compiled} });`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Convert expression to human-readable string for error messages
 */
function expressionToReadable(expr: Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'BinaryExpr':
      return `${expressionToReadable(expr.left)} ${expr.operator} ${expressionToReadable(expr.right)}`;
    case 'MemberExpr':
      return `${expressionToReadable(expr.object)}.${expr.property.name}`;
    case 'NumberLiteral':
      return String(expr.value);
    case 'StringLiteral':
      return `"${expr.value}"`;
    case 'BooleanLiteral':
      return String(expr.value);
    default:
      return `[${expr.kind}]`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
