// ============================================================================
// Expression Encoding for SMT-LIB
// Translates ISL expressions to SMT-LIB terms
// ============================================================================

import type * as AST from '../../../../master_contracts/ast';

// ============================================================================
// TYPES
// ============================================================================

export interface EncodingContext {
  prefix?: string;          // Variable prefix (e.g., 'input', 'result')
  entityVar?: string;       // Current entity variable name
  entityName?: string;      // Current entity type name
  hasOld?: boolean;         // Whether old() expressions are available
  quantifierVars?: Map<string, string>; // Quantifier variable mappings
}

// ============================================================================
// MAIN ENCODER
// ============================================================================

/**
 * Encode an ISL expression to SMT-LIB
 */
export function encodeExpression(expr: AST.Expression, ctx: EncodingContext = {}): string {
  switch (expr.kind) {
    case 'Identifier':
      return encodeIdentifier(expr, ctx);
    
    case 'QualifiedName':
      return encodeQualifiedName(expr, ctx);
    
    case 'StringLiteral':
      return `"${escapeString(expr.value)}"`;
    
    case 'NumberLiteral':
      return expr.isFloat ? expr.value.toFixed(10) : String(expr.value);
    
    case 'BooleanLiteral':
      return expr.value ? 'true' : 'false';
    
    case 'NullLiteral':
      return 'nil';
    
    case 'DurationLiteral':
      return encodeDuration(expr);
    
    case 'RegexLiteral':
      return `(str.to_re "${expr.pattern}")`;
    
    case 'BinaryExpr':
      return encodeBinaryExpr(expr, ctx);
    
    case 'UnaryExpr':
      return encodeUnaryExpr(expr, ctx);
    
    case 'CallExpr':
      return encodeCallExpr(expr, ctx);
    
    case 'MemberExpr':
      return encodeMemberExpr(expr, ctx);
    
    case 'IndexExpr':
      return encodeIndexExpr(expr, ctx);
    
    case 'QuantifierExpr':
      return encodeQuantifierExpr(expr, ctx);
    
    case 'ConditionalExpr':
      return encodeConditionalExpr(expr, ctx);
    
    case 'OldExpr':
      return encodeOldExpr(expr, ctx);
    
    case 'ResultExpr':
      return encodeResultExpr(expr, ctx);
    
    case 'InputExpr':
      return encodeInputExpr(expr, ctx);
    
    case 'LambdaExpr':
      return encodeLambdaExpr(expr, ctx);
    
    case 'ListExpr':
      return encodeListExpr(expr, ctx);
    
    case 'MapExpr':
      return encodeMapExpr(expr, ctx);
    
    default:
      return `; Unknown expression: ${(expr as AST.Expression).kind}`;
  }
}

// ============================================================================
// IDENTIFIER ENCODING
// ============================================================================

function encodeIdentifier(expr: AST.Identifier, ctx: EncodingContext): string {
  const name = expr.name;
  
  // Check if it's a quantifier variable
  if (ctx.quantifierVars?.has(name)) {
    return ctx.quantifierVars.get(name)!;
  }
  
  // Check if it's an entity field access
  if (ctx.entityVar && ctx.entityName) {
    return `(${ctx.entityName.toLowerCase()}-${name} ${ctx.entityVar})`;
  }
  
  // Check for prefix
  if (ctx.prefix) {
    return `${ctx.prefix}-${name}`;
  }
  
  return name;
}

function encodeQualifiedName(expr: AST.QualifiedName, ctx: EncodingContext): string {
  const parts = expr.parts.map(p => p.name);
  
  if (parts.length === 2) {
    // Entity.field or similar
    const [entity, field] = parts;
    return `(${entity.toLowerCase()}-${field})`;
  }
  
  return parts.join('-');
}

// ============================================================================
// BINARY EXPRESSIONS
// ============================================================================

function encodeBinaryExpr(expr: AST.BinaryExpr, ctx: EncodingContext): string {
  const left = encodeExpression(expr.left, ctx);
  const right = encodeExpression(expr.right, ctx);
  
  switch (expr.operator) {
    // Comparison
    case '==':
      return `(= ${left} ${right})`;
    case '!=':
      return `(not (= ${left} ${right}))`;
    case '<':
      return `(< ${left} ${right})`;
    case '>':
      return `(> ${left} ${right})`;
    case '<=':
      return `(<= ${left} ${right})`;
    case '>=':
      return `(>= ${left} ${right})`;
    
    // Arithmetic
    case '+':
      return `(+ ${left} ${right})`;
    case '-':
      return `(- ${left} ${right})`;
    case '*':
      return `(* ${left} ${right})`;
    case '/':
      return `(/ ${left} ${right})`;
    case '%':
      return `(mod ${left} ${right})`;
    
    // Logical
    case 'and':
      return `(and ${left} ${right})`;
    case 'or':
      return `(or ${left} ${right})`;
    case 'implies':
      return `(=> ${left} ${right})`;
    case 'iff':
      return `(= ${left} ${right})`; // Boolean equality
    
    // Collection
    case 'in':
      return `(select ${right} ${left})`;
    
    default:
      return `(${expr.operator} ${left} ${right})`;
  }
}

// ============================================================================
// UNARY EXPRESSIONS
// ============================================================================

function encodeUnaryExpr(expr: AST.UnaryExpr, ctx: EncodingContext): string {
  const operand = encodeExpression(expr.operand, ctx);
  
  switch (expr.operator) {
    case 'not':
      return `(not ${operand})`;
    case '-':
      return `(- ${operand})`;
    default:
      return `(${expr.operator} ${operand})`;
  }
}

// ============================================================================
// CALL EXPRESSIONS
// ============================================================================

function encodeCallExpr(expr: AST.CallExpr, ctx: EncodingContext): string {
  const callee = encodeExpression(expr.callee, ctx);
  const args = expr.arguments.map(a => encodeExpression(a, ctx));
  
  // Handle special built-in functions
  const calleeName = getCalleeName(expr.callee);
  
  switch (calleeName) {
    // Entity operations
    case 'exists':
      return `(exists ((e Entity)) (= (entity-id e) ${args[0]}))`;
    case 'lookup':
      return `(select entities ${args[0]})`;
    case 'count':
      return args.length > 0 
        ? `(count-where ${args[0]})`
        : '(entity-count)';
    
    // Collection operations
    case 'length':
    case 'size':
      return `(seq.len ${args[0]})`;
    case 'contains':
      return `(seq.contains ${args[0]} ${args[1]})`;
    case 'isEmpty':
      return `(= (seq.len ${args[0]}) 0)`;
    
    // String operations
    case 'startsWith':
      return `(str.prefixof ${args[1]} ${args[0]})`;
    case 'endsWith':
      return `(str.suffixof ${args[1]} ${args[0]})`;
    case 'matches':
      return `(str.in_re ${args[0]} ${args[1]})`;
    case 'toLowerCase':
      return `(str.to_lower ${args[0]})`;
    case 'toUpperCase':
      return `(str.to_upper ${args[0]})`;
    
    // Math operations
    case 'abs':
      return `(abs ${args[0]})`;
    case 'min':
      return `(ite (< ${args[0]} ${args[1]}) ${args[0]} ${args[1]})`;
    case 'max':
      return `(ite (> ${args[0]} ${args[1]}) ${args[0]} ${args[1]})`;
    case 'sum':
      return `(sum ${args.join(' ')})`;
    
    // Type checks
    case 'is_valid':
      return `(${args[0]}-valid ${args[0]})`;
    
    // Timestamp operations
    case 'now':
      return 'current-time';
    
    default:
      // Generic function call
      return `(${callee} ${args.join(' ')})`;
  }
}

function getCalleeName(expr: AST.Expression): string {
  if (expr.kind === 'Identifier') {
    return expr.name;
  }
  if (expr.kind === 'MemberExpr') {
    return expr.property.name;
  }
  return '';
}

// ============================================================================
// MEMBER EXPRESSIONS
// ============================================================================

function encodeMemberExpr(expr: AST.MemberExpr, ctx: EncodingContext): string {
  const obj = encodeExpression(expr.object, ctx);
  const prop = expr.property.name;
  
  // Special cases
  if (expr.object.kind === 'Identifier') {
    const objName = expr.object.name;
    
    // Entity field access: User.id -> (user-id user-instance)
    if (objName === objName.charAt(0).toUpperCase() + objName.slice(1)) {
      return `(${objName.toLowerCase()}-${prop})`;
    }
    
    // Input/result access
    if (objName === 'input' || objName === 'result') {
      return `${objName}-${prop}`;
    }
  }
  
  // Default: accessor function
  return `(${prop} ${obj})`;
}

// ============================================================================
// INDEX EXPRESSIONS
// ============================================================================

function encodeIndexExpr(expr: AST.IndexExpr, ctx: EncodingContext): string {
  const obj = encodeExpression(expr.object, ctx);
  const idx = encodeExpression(expr.index, ctx);
  
  return `(select ${obj} ${idx})`;
}

// ============================================================================
// QUANTIFIER EXPRESSIONS
// ============================================================================

function encodeQuantifierExpr(expr: AST.QuantifierExpr, ctx: EncodingContext): string {
  const varName = expr.variable.name;
  const smtVar = `qvar-${varName}`;
  
  // Add to context
  const newCtx: EncodingContext = {
    ...ctx,
    quantifierVars: new Map(ctx.quantifierVars),
  };
  newCtx.quantifierVars!.set(varName, smtVar);
  
  const collection = encodeExpression(expr.collection, ctx);
  const predicate = encodeExpression(expr.predicate, newCtx);
  
  switch (expr.quantifier) {
    case 'all':
      return `(forall ((${smtVar} Int)) (=> (and (>= ${smtVar} 0) (< ${smtVar} (seq.len ${collection}))) ${predicate}))`;
    
    case 'any':
      return `(exists ((${smtVar} Int)) (and (>= ${smtVar} 0) (< ${smtVar} (seq.len ${collection})) ${predicate}))`;
    
    case 'none':
      return `(not (exists ((${smtVar} Int)) (and (>= ${smtVar} 0) (< ${smtVar} (seq.len ${collection})) ${predicate})))`;
    
    case 'count':
      return `(count-satisfying ${collection} ${predicate})`;
    
    case 'sum':
      return `(sum-satisfying ${collection} ${predicate})`;
    
    case 'filter':
      return `(filter ${collection} ${predicate})`;
    
    default:
      return `(${expr.quantifier} ${collection} ${predicate})`;
  }
}

// ============================================================================
// CONDITIONAL EXPRESSIONS
// ============================================================================

function encodeConditionalExpr(expr: AST.ConditionalExpr, ctx: EncodingContext): string {
  const cond = encodeExpression(expr.condition, ctx);
  const thenBranch = encodeExpression(expr.thenBranch, ctx);
  const elseBranch = encodeExpression(expr.elseBranch, ctx);
  
  return `(ite ${cond} ${thenBranch} ${elseBranch})`;
}

// ============================================================================
// OLD EXPRESSIONS
// ============================================================================

function encodeOldExpr(expr: AST.OldExpr, ctx: EncodingContext): string {
  // Encode with 'old-' prefix
  const innerCtx: EncodingContext = {
    ...ctx,
    prefix: ctx.prefix ? `old-${ctx.prefix}` : 'old',
  };
  
  return encodeExpression(expr.expression, innerCtx);
}

// ============================================================================
// RESULT/INPUT EXPRESSIONS
// ============================================================================

function encodeResultExpr(expr: AST.ResultExpr, ctx: EncodingContext): string {
  if (expr.property) {
    return `result-${expr.property.name}`;
  }
  return 'result';
}

function encodeInputExpr(expr: AST.InputExpr, ctx: EncodingContext): string {
  return `input-${expr.property.name}`;
}

// ============================================================================
// LAMBDA EXPRESSIONS
// ============================================================================

function encodeLambdaExpr(expr: AST.LambdaExpr, ctx: EncodingContext): string {
  const params = expr.params.map((p, i) => `(${p.name} T${i})`).join(' ');
  const body = encodeExpression(expr.body, ctx);
  
  return `(lambda (${params}) ${body})`;
}

// ============================================================================
// COLLECTION EXPRESSIONS
// ============================================================================

function encodeListExpr(expr: AST.ListExpr, ctx: EncodingContext): string {
  if (expr.elements.length === 0) {
    return '(as seq.empty (Seq Int))';
  }
  
  const elements = expr.elements.map(e => encodeExpression(e, ctx));
  return `(seq.++ ${elements.map(e => `(seq.unit ${e})`).join(' ')})`;
}

function encodeMapExpr(expr: AST.MapExpr, ctx: EncodingContext): string {
  // Build map using store operations
  let result = '((as const (Array String Int)) 0)';
  
  for (const entry of expr.entries) {
    const key = encodeExpression(entry.key, ctx);
    const value = encodeExpression(entry.value, ctx);
    result = `(store ${result} ${key} ${value})`;
  }
  
  return result;
}

// ============================================================================
// DURATION ENCODING
// ============================================================================

function encodeDuration(expr: AST.DurationLiteral): string {
  // Convert to milliseconds
  let ms = expr.value;
  
  switch (expr.unit) {
    case 'seconds':
      ms *= 1000;
      break;
    case 'minutes':
      ms *= 60000;
      break;
    case 'hours':
      ms *= 3600000;
      break;
    case 'days':
      ms *= 86400000;
      break;
    // ms stays as is
  }
  
  return String(Math.floor(ms));
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
