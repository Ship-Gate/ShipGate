// ============================================================================
// Expression Compiler - Converts ISL expressions to TypeScript assertions
// ============================================================================

import type * as AST from '@isl-lang/parser';

// ============================================================================
// COMPILER CONTEXT
// ============================================================================

/**
 * Context for expression compilation
 */
export interface CompilerContext {
  /** Entity names in the domain (e.g., ['User', 'Session']) */
  entities: Set<string>;
  /** Whether we're inside an old() expression */
  inOldExpr?: boolean;
}

/**
 * Create a compiler context from entity names
 */
export function createCompilerContext(entityNames: string[]): CompilerContext {
  return {
    entities: new Set(entityNames),
    inOldExpr: false,
  };
}

/**
 * Default context (no entities - backward compatible)
 */
const DEFAULT_CONTEXT: CompilerContext = {
  entities: new Set(),
  inOldExpr: false,
};

// ============================================================================
// MAIN COMPILER
// ============================================================================

/**
 * Compiles an ISL expression to TypeScript code
 * 
 * @param expr - The AST expression node
 * @param ctx - Optional compiler context with entity names
 */
export function compileExpression(expr: AST.Expression, ctx: CompilerContext = DEFAULT_CONTEXT): string {
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
      return compileBinaryExpr(expr, ctx);

    case 'UnaryExpr':
      return compileUnaryExpr(expr, ctx);

    case 'CallExpr':
      return compileCallExpr(expr, ctx);

    case 'MemberExpr':
      return `${compileExpression(expr.object, ctx)}.${expr.property.name}`;

    case 'IndexExpr':
      return `${compileExpression(expr.object, ctx)}[${compileExpression(expr.index, ctx)}]`;

    case 'QuantifierExpr':
      return compileQuantifierExpr(expr, ctx);

    case 'ConditionalExpr':
      return `(${compileExpression(expr.condition, ctx)} ? ${compileExpression(expr.thenBranch, ctx)} : ${compileExpression(expr.elseBranch, ctx)})`;

    case 'OldExpr':
      return compileOldExpr(expr, ctx);

    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';

    case 'InputExpr':
      return `input.${expr.property.name}`;

    case 'LambdaExpr':
      return `(${expr.params.map((p) => p.name).join(', ')}) => ${compileExpression(expr.body, ctx)}`;

    case 'ListExpr':
      return `[${expr.elements.map((e) => compileExpression(e, ctx)).join(', ')}]`;

    case 'MapExpr':
      return `{ ${expr.entries.map((e) => `[${compileExpression(e.key, ctx)}]: ${compileExpression(e.value, ctx)}`).join(', ')} }`;

    default:
      return `/* unsupported: ${(expr as AST.ASTNode).kind} */`;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

function compileBinaryExpr(expr: AST.BinaryExpr, ctx: CompilerContext): string {
  const left = compileExpression(expr.left, ctx);
  const right = compileExpression(expr.right, ctx);
  const op = mapBinaryOperator(expr.operator);
  
  // Special case: "implies" needs to be (!a || b)
  if (expr.operator === 'implies') {
    return `(!${left} || ${right})`;
  }
  
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
      return '||'; // handled specially in compileBinaryExpr
    case 'iff':
      return '==='; // boolean equality
    case 'in':
      return 'in';
    default:
      return op;
  }
}

function compileUnaryExpr(expr: AST.UnaryExpr, ctx: CompilerContext): string {
  const operand = compileExpression(expr.operand, ctx);
  const op = expr.operator === 'not' ? '!' : expr.operator;
  return `${op}(${operand})`;
}

/**
 * Compile a call expression, with special handling for entity methods
 */
function compileCallExpr(expr: AST.CallExpr, ctx: CompilerContext): string {
  const callee = expr.callee;
  
  // Check if this is an entity method call like User.exists(...)
  if (callee.kind === 'MemberExpr') {
    const entityCall = tryCompileEntityMethodCall(callee, expr.arguments, ctx);
    if (entityCall !== null) {
      return entityCall;
    }
  }
  
  // Default: standard function call
  const calleeCode = compileExpression(callee, ctx);
  const args = expr.arguments.map((a) => compileExpression(a, ctx)).join(', ');
  return `${calleeCode}(${args})`;
}

/**
 * Try to compile an entity method call (User.exists, User.lookup, etc.)
 * Returns null if this is not an entity method call
 */
function tryCompileEntityMethodCall(
  callee: AST.MemberExpr,
  args: AST.Expression[],
  ctx: CompilerContext
): string | null {
  // Check if the object is an entity name
  const entityName = getEntityName(callee.object, ctx);
  if (!entityName) {
    return null;
  }
  
  const method = callee.property.name;
  const prefix = ctx.inOldExpr ? `__old__.entity('${entityName}')` : entityName;
  
  // Handle entity methods
  switch (method) {
    case 'exists':
      return compileEntityExists(prefix, args, ctx);
    
    case 'lookup':
      return compileEntityLookup(prefix, args, ctx);
    
    case 'count':
      return compileEntityCount(prefix, args, ctx);
    
    case 'getAll':
    case 'all':
      return `${prefix}.getAll()`;
    
    default:
      // Not a known entity method, fall back to default
      return null;
  }
}

/**
 * Get the entity name from an expression, if it refers to an entity
 */
function getEntityName(expr: AST.Expression, ctx: CompilerContext): string | null {
  if (expr.kind === 'Identifier' && ctx.entities.has(expr.name)) {
    return expr.name;
  }
  return null;
}

/**
 * Compile User.exists(...) call
 * 
 * ISL patterns:
 *   User.exists(result.id)          -> User.exists({ id: result.id })
 *   User.exists({ email: x })       -> User.exists({ email: x })
 *   User.exists()                   -> User.exists()
 */
function compileEntityExists(prefix: string, args: AST.Expression[], ctx: CompilerContext): string {
  if (args.length === 0) {
    return `${prefix}.exists()`;
  }
  
  const arg = args[0]!;
  
  // If it's already a map/object, use as-is
  if (arg.kind === 'MapExpr') {
    const criteria = compileExpression(arg, ctx);
    return `${prefix}.exists(${criteria})`;
  }
  
  // If it's a single value (like result.id), wrap in { id: value }
  // This handles the common pattern: User.exists(result.id) -> User.exists({ id: result.id })
  const value = compileExpression(arg, ctx);
  
  // Try to infer the field name from the expression
  const fieldName = inferFieldName(arg);
  
  return `${prefix}.exists({ ${fieldName}: ${value} })`;
}

/**
 * Compile User.lookup(...) call
 */
function compileEntityLookup(prefix: string, args: AST.Expression[], ctx: CompilerContext): string {
  if (args.length === 0) {
    return `${prefix}.lookup({})`;
  }
  
  const arg = args[0]!;
  
  // If it's already a map/object, use as-is
  if (arg.kind === 'MapExpr') {
    const criteria = compileExpression(arg, ctx);
    return `${prefix}.lookup(${criteria})`;
  }
  
  // Single value lookup by ID
  const value = compileExpression(arg, ctx);
  const fieldName = inferFieldName(arg);
  
  return `${prefix}.lookup({ ${fieldName}: ${value} })`;
}

/**
 * Compile User.count(...) call
 */
function compileEntityCount(prefix: string, args: AST.Expression[], ctx: CompilerContext): string {
  if (args.length === 0) {
    return `${prefix}.count()`;
  }
  
  const arg = args[0]!;
  
  // If it's already a map/object, use as-is
  if (arg.kind === 'MapExpr') {
    const criteria = compileExpression(arg, ctx);
    return `${prefix}.count(${criteria})`;
  }
  
  // Single criteria
  const value = compileExpression(arg, ctx);
  const fieldName = inferFieldName(arg);
  
  return `${prefix}.count({ ${fieldName}: ${value} })`;
}

/**
 * Infer the field name from an expression
 * 
 * Examples:
 *   result.id     -> 'id'
 *   input.email   -> 'email'
 *   user.name     -> 'name'
 *   x             -> 'id' (default)
 */
function inferFieldName(expr: AST.Expression): string {
  if (expr.kind === 'MemberExpr') {
    return expr.property.name;
  }
  if (expr.kind === 'ResultExpr' && expr.property) {
    return expr.property.name;
  }
  if (expr.kind === 'InputExpr') {
    return expr.property.name;
  }
  // Default to 'id' for simple identifiers/values
  return 'id';
}

/**
 * Compile old() expression with proper entity proxy binding
 */
function compileOldExpr(expr: AST.OldExpr, ctx: CompilerContext): string {
  // Create a context for inside old()
  const oldCtx: CompilerContext = { ...ctx, inOldExpr: true };
  const inner = expr.expression;
  
  // If the inner expression is an entity method call, use __old__.entity('X')
  if (inner.kind === 'CallExpr' && inner.callee.kind === 'MemberExpr') {
    const entityName = getEntityName(inner.callee.object, ctx);
    if (entityName) {
      // This will be handled by compileCallExpr with inOldExpr=true
      return compileExpression(inner, oldCtx);
    }
  }
  
  // For property access on old state, use direct access
  return `__old__.${compileExpression(inner, ctx)}`;
}

function compileQuantifierExpr(expr: AST.QuantifierExpr, ctx: CompilerContext): string {
  const collection = compileExpression(expr.collection, ctx);
  const variable = expr.variable.name;
  const predicate = compileExpression(expr.predicate, ctx);

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

// ============================================================================
// ASSERTION COMPILATION
// ============================================================================

/**
 * Compiles an expression to an assertion statement
 * 
 * @param expr - The AST expression
 * @param framework - Test framework ('jest' or 'vitest')
 * @param ctx - Optional compiler context with entity names
 */
export function compileAssertion(
  expr: AST.Expression, 
  framework: 'jest' | 'vitest',
  ctx: CompilerContext = DEFAULT_CONTEXT
): string {
  const compiled = compileExpression(expr, ctx);

  // Handle specific patterns
  if (expr.kind === 'BinaryExpr') {
    const left = compileExpression(expr.left, ctx);
    const right = compileExpression(expr.right, ctx);

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
      case 'implies':
        // a implies b -> if a then b must be true
        return `expect(${compiled}).toBe(true);`;
    }
  }

  // Default: use toBe for truthy check
  return `expect(${compiled}).toBe(true);`;
}

/**
 * Compiles an expression to check if result is success/error
 */
export function compileResultCheck(
  expr: AST.Expression,
  ctx: CompilerContext = DEFAULT_CONTEXT
): { type: 'success' | 'error'; code: string } {
  if (expr.kind === 'BinaryExpr' && expr.operator === '==' && expr.left.kind === 'Identifier') {
    if (expr.left.name === 'result') {
      if (expr.right.kind === 'Identifier') {
        if (expr.right.name === 'success') {
          return { type: 'success', code: 'expect(result.success).toBe(true);' };
        } else {
          return { type: 'error', code: `expect(result.error?.code).toBe('${expr.right.name}');` };
        }
      }
    }
  }

  // Check for "result is success" pattern (would be parsed as binary 'is' op)
  const compiled = compileExpression(expr, ctx);
  if (compiled.includes('result') && compiled.includes('success')) {
    return { type: 'success', code: 'expect(result.success).toBe(true);' };
  }

  return { type: 'success', code: `expect(${compiled}).toBe(true);` };
}
