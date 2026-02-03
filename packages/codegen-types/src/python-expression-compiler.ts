/**
 * Python Expression Compiler
 * 
 * Compiles ISL expressions to Python code for contract checking.
 * Mirrors the TypeScript expression compiler but targets Python semantics.
 */

import type {
  Expression,
  BinaryExpression,
  UnaryExpression,
  MemberExpression,
  CallExpression,
  QuantifiedExpression,
  OldExpression,
  Identifier,
  StringLiteral,
  NumberLiteral,
  BooleanLiteral,
  DurationLiteral,
} from '@isl-lang/isl-core';

// ============================================================================
// COMPILER CONTEXT
// ============================================================================

/**
 * Context for Python expression compilation
 */
export interface PythonCompilerContext {
  /** Entity names in the domain (e.g., ['User', 'Session']) */
  entities: Set<string>;
  /** Whether we're inside an old() expression */
  inOldExpr?: boolean;
  /** Available input parameter names */
  inputParams?: Set<string>;
}

/**
 * Create a compiler context from entity names
 */
export function createPythonCompilerContext(entityNames: string[]): PythonCompilerContext {
  return {
    entities: new Set(entityNames),
    inOldExpr: false,
    inputParams: new Set(),
  };
}

const DEFAULT_CONTEXT: PythonCompilerContext = {
  entities: new Set(),
  inOldExpr: false,
  inputParams: new Set(),
};

// ============================================================================
// MAIN COMPILER
// ============================================================================

/**
 * Compiles an ISL expression to Python code
 * 
 * @param expr - The AST expression node
 * @param ctx - Optional compiler context with entity names
 */
export function compilePythonExpression(
  expr: Expression, 
  ctx: PythonCompilerContext = DEFAULT_CONTEXT
): string {
  switch (expr.kind) {
    case 'Identifier':
      return compileIdentifier(expr, ctx);

    case 'StringLiteral':
      return JSON.stringify(expr.value);

    case 'NumberLiteral':
      return String(expr.value);

    case 'BooleanLiteral':
      return expr.value ? 'True' : 'False';

    case 'NullLiteral':
      return 'None';

    case 'DurationLiteral':
      return compileDuration(expr);

    case 'BinaryExpression':
      return compileBinaryExpr(expr, ctx);

    case 'UnaryExpression':
      return compileUnaryExpr(expr, ctx);

    case 'CallExpression':
      return compileCallExpr(expr, ctx);

    case 'MemberExpression':
      return compileMemberExpr(expr, ctx);

    case 'ComparisonExpression':
      return compileComparisonExpr(expr, ctx);

    case 'LogicalExpression':
      return compileLogicalExpr(expr, ctx);

    case 'QuantifiedExpression':
      return compileQuantifierExpr(expr, ctx);

    case 'OldExpression':
      return compileOldExpr(expr, ctx);

    default:
      return `# unsupported: ${(expr as Expression).kind}`;
  }
}

// ============================================================================
// EXPRESSION COMPILERS
// ============================================================================

function compileIdentifier(expr: Identifier, ctx: PythonCompilerContext): string {
  const name = expr.name;
  
  // Handle special identifiers
  if (name === 'result') {
    return '_result_';
  }
  if (name === 'input') {
    return '_input_';
  }
  
  // Check if this is an entity reference
  if (ctx.entities.has(name)) {
    return ctx.inOldExpr ? `_old_state_.entity("${name}")` : `_entities_["${name}"]`;
  }
  
  // Check if this is an input parameter
  if (ctx.inputParams?.has(name)) {
    return `_input_.${toSnakeCase(name)}`;
  }
  
  return toSnakeCase(name);
}

function compileDuration(expr: DurationLiteral): string {
  const msValue = convertToMs(expr.value, expr.unit);
  return String(msValue);
}

function convertToMs(value: number, unit: DurationLiteral['unit']): number {
  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value;
  }
}

function compileBinaryExpr(expr: BinaryExpression, ctx: PythonCompilerContext): string {
  const left = compilePythonExpression(expr.left, ctx);
  const right = compilePythonExpression(expr.right, ctx);
  const op = mapBinaryOperator(expr.operator);
  
  // Special case: "implies" needs to be (not a or b)
  if (expr.operator === 'implies') {
    return `(not ${left} or ${right})`;
  }
  
  // Special case: "in" operator
  if (expr.operator === 'in') {
    return `(${left} in ${right})`;
  }
  
  return `(${left} ${op} ${right})`;
}

function mapBinaryOperator(op: string): string {
  switch (op) {
    case '==':
      return '==';
    case '!=':
      return '!=';
    case 'and':
      return 'and';
    case 'or':
      return 'or';
    case 'implies':
      return 'or'; // handled specially in compileBinaryExpr
    case 'iff':
      return '=='; // boolean equality
    default:
      return op;
  }
}

function compileUnaryExpr(expr: UnaryExpression, ctx: PythonCompilerContext): string {
  const operand = compilePythonExpression(expr.operand, ctx);
  const op = expr.operator === 'not' ? 'not ' : expr.operator;
  return `${op}(${operand})`;
}

function compileCallExpr(expr: CallExpression, ctx: PythonCompilerContext): string {
  const callee = expr.callee;
  
  // Check if this is an entity method call like User.exists(...)
  if (callee.kind === 'MemberExpression') {
    const entityCall = tryCompileEntityMethodCall(callee, expr.arguments, ctx);
    if (entityCall !== null) {
      return entityCall;
    }
  }
  
  // Built-in function calls
  if (callee.kind === 'Identifier') {
    return compileBuiltinCall(callee.name, expr.arguments, ctx);
  }
  
  // Default: standard function call
  const calleeCode = compilePythonExpression(callee, ctx);
  const args = expr.arguments.map((a) => compilePythonExpression(a, ctx)).join(', ');
  return `${calleeCode}(${args})`;
}

function compileBuiltinCall(
  funcName: string, 
  args: Expression[], 
  ctx: PythonCompilerContext
): string {
  const compiledArgs = args.map(a => compilePythonExpression(a, ctx));
  
  switch (funcName) {
    case 'len':
    case 'length':
      return `len(${compiledArgs[0]})`;
    
    case 'abs':
      return `abs(${compiledArgs[0]})`;
    
    case 'min':
      return `min(${compiledArgs.join(', ')})`;
    
    case 'max':
      return `max(${compiledArgs.join(', ')})`;
    
    case 'sum':
      return `sum(${compiledArgs[0]})`;
    
    case 'count':
      return `len(${compiledArgs[0]})`;
    
    case 'isEmpty':
    case 'is_empty':
      return `len(${compiledArgs[0]}) == 0`;
    
    case 'isNotEmpty':
    case 'is_not_empty':
      return `len(${compiledArgs[0]}) > 0`;
    
    case 'contains':
      return `(${compiledArgs[1]} in ${compiledArgs[0]})`;
    
    case 'startsWith':
    case 'starts_with':
      return `${compiledArgs[0]}.startswith(${compiledArgs[1]})`;
    
    case 'endsWith':
    case 'ends_with':
      return `${compiledArgs[0]}.endswith(${compiledArgs[1]})`;
    
    case 'matches':
      return `bool(re.match(${compiledArgs[1]}, ${compiledArgs[0]}))`;
    
    case 'now':
      return 'datetime.now()';
    
    case 'uuid':
      return 'str(uuid4())';
    
    default:
      return `${toSnakeCase(funcName)}(${compiledArgs.join(', ')})`;
  }
}

function compileMemberExpr(expr: MemberExpression, ctx: PythonCompilerContext): string {
  const obj = compilePythonExpression(expr.object, ctx);
  const prop = toSnakeCase(expr.property.name);
  return `${obj}.${prop}`;
}

function compileComparisonExpr(
  expr: { operator: string; left: Expression; right: Expression },
  ctx: PythonCompilerContext
): string {
  const left = compilePythonExpression(expr.left, ctx);
  const right = compilePythonExpression(expr.right, ctx);
  return `(${left} ${expr.operator} ${right})`;
}

function compileLogicalExpr(
  expr: { operator: string; left: Expression; right: Expression },
  ctx: PythonCompilerContext
): string {
  const left = compilePythonExpression(expr.left, ctx);
  const right = compilePythonExpression(expr.right, ctx);
  const op = expr.operator === 'and' ? 'and' : 'or';
  return `(${left} ${op} ${right})`;
}

// ============================================================================
// ENTITY METHOD CALLS
// ============================================================================

/**
 * Try to compile an entity method call (User.exists, User.lookup, etc.)
 * Returns null if this is not an entity method call
 */
function tryCompileEntityMethodCall(
  callee: MemberExpression,
  args: Expression[],
  ctx: PythonCompilerContext
): string | null {
  // Check if the object is an entity name
  const entityName = getEntityName(callee.object, ctx);
  if (!entityName) {
    return null;
  }
  
  const method = callee.property.name;
  const prefix = ctx.inOldExpr 
    ? `_old_state_.entity("${entityName}")` 
    : `_entities_["${entityName}"]`;
  
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
      return `${prefix}.get_all()`;
    
    default:
      // Not a known entity method, fall back to default
      return null;
  }
}

/**
 * Get the entity name from an expression, if it refers to an entity
 */
function getEntityName(expr: Expression, ctx: PythonCompilerContext): string | null {
  if (expr.kind === 'Identifier' && ctx.entities.has(expr.name)) {
    return expr.name;
  }
  return null;
}

/**
 * Compile User.exists(...) call
 */
function compileEntityExists(prefix: string, args: Expression[], ctx: PythonCompilerContext): string {
  if (args.length === 0) {
    return `${prefix}.exists()`;
  }
  
  const arg = args[0]!;
  const value = compilePythonExpression(arg, ctx);
  const fieldName = inferFieldName(arg);
  
  return `${prefix}.exists({"${fieldName}": ${value}})`;
}

/**
 * Compile User.lookup(...) call
 */
function compileEntityLookup(prefix: string, args: Expression[], ctx: PythonCompilerContext): string {
  if (args.length === 0) {
    return `${prefix}.lookup({})`;
  }
  
  const arg = args[0]!;
  const value = compilePythonExpression(arg, ctx);
  const fieldName = inferFieldName(arg);
  
  return `${prefix}.lookup({"${fieldName}": ${value}})`;
}

/**
 * Compile User.count(...) call
 */
function compileEntityCount(prefix: string, args: Expression[], ctx: PythonCompilerContext): string {
  if (args.length === 0) {
    return `${prefix}.count()`;
  }
  
  const arg = args[0]!;
  const value = compilePythonExpression(arg, ctx);
  const fieldName = inferFieldName(arg);
  
  return `${prefix}.count({"${fieldName}": ${value}})`;
}

/**
 * Infer the field name from an expression
 */
function inferFieldName(expr: Expression): string {
  if (expr.kind === 'MemberExpression') {
    return expr.property.name;
  }
  // Default to 'id' for simple identifiers/values
  return 'id';
}

// ============================================================================
// QUANTIFIER AND OLD EXPRESSIONS
// ============================================================================

function compileQuantifierExpr(expr: QuantifiedExpression, ctx: PythonCompilerContext): string {
  const collection = compilePythonExpression(expr.collection, ctx);
  const variable = toSnakeCase(expr.variable.name);
  const predicate = compilePythonExpression(expr.predicate, ctx);

  switch (expr.quantifier) {
    case 'all':
      return `all(${predicate} for ${variable} in ${collection})`;
    case 'some':
      return `any(${predicate} for ${variable} in ${collection})`;
    case 'none':
      return `not any(${predicate} for ${variable} in ${collection})`;
    default:
      return `# unsupported quantifier: ${expr.quantifier}`;
  }
}

function compileOldExpr(expr: OldExpression, ctx: PythonCompilerContext): string {
  // Create a context for inside old()
  const oldCtx: PythonCompilerContext = { ...ctx, inOldExpr: true };
  const inner = expr.expression;
  
  // If the inner expression is an entity method call, use _old_state_.entity('X')
  if (inner.kind === 'CallExpression' && inner.callee.kind === 'MemberExpression') {
    const entityName = getEntityName(inner.callee.object, ctx);
    if (entityName) {
      // This will be handled by compileCallExpr with inOldExpr=true
      return compilePythonExpression(inner, oldCtx);
    }
  }
  
  // For property access on old state
  if (inner.kind === 'Identifier') {
    return `_old_state_.get("${inner.name}")`;
  }
  
  if (inner.kind === 'MemberExpression') {
    const obj = inner.object.kind === 'Identifier' ? inner.object.name : '';
    const prop = inner.property.name;
    return `_old_state_.get("${obj}").${toSnakeCase(prop)}`;
  }
  
  return `_old_state_.${compilePythonExpression(inner, ctx)}`;
}

// ============================================================================
// ASSERTION COMPILATION
// ============================================================================

/**
 * Compiles an expression to a Python assertion statement
 */
export function compilePythonAssertion(
  expr: Expression, 
  description?: string,
  ctx: PythonCompilerContext = DEFAULT_CONTEXT
): string {
  const compiled = compilePythonExpression(expr, ctx);
  const msg = description ? `, "${escapeString(description)}"` : '';
  return `assert ${compiled}${msg}`;
}

/**
 * Compiles a precondition check with proper error handling
 */
export function compilePreconditionCheck(
  expr: Expression,
  description?: string,
  ctx: PythonCompilerContext = DEFAULT_CONTEXT
): string {
  const compiled = compilePythonExpression(expr, ctx);
  const msg = description ?? 'Precondition failed';
  return `if not (${compiled}):
        raise PreconditionError("${escapeString(msg)}")`;
}

/**
 * Compiles a postcondition check with proper error handling
 */
export function compilePostconditionCheck(
  expr: Expression,
  description?: string,
  ctx: PythonCompilerContext = DEFAULT_CONTEXT
): string {
  const compiled = compilePythonExpression(expr, ctx);
  const msg = description ?? 'Postcondition failed';
  return `if not (${compiled}):
        raise PostconditionError("${escapeString(msg)}")`;
}

/**
 * Compiles an invariant check with proper error handling
 */
export function compileInvariantCheck(
  expr: Expression,
  description?: string,
  ctx: PythonCompilerContext = DEFAULT_CONTEXT
): string {
  const compiled = compilePythonExpression(expr, ctx);
  const msg = description ?? 'Invariant violated';
  return `if not (${compiled}):
        raise InvariantError("${escapeString(msg)}")`;
}

// ============================================================================
// UTILITIES
// ============================================================================

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__/g, '_');
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}
