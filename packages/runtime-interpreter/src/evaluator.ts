// ============================================================================
// ISL Runtime Interpreter - Expression Evaluator
// @isl-lang/runtime-interpreter/evaluator
// ============================================================================

import type {
  Value,
  Expression,
  Environment,
  ExecutionContext,
  Pattern,
  MatchCase,
} from './types';
import { extendEnvironment, lookupBinding } from './environment';
import { InterpreterError, TypeMismatchError, UnhandledEffectError } from './types';

// ============================================================================
// EXPRESSION EVALUATOR
// ============================================================================

/**
 * Evaluate an expression in the given environment.
 */
export async function evaluate(
  expr: Expression,
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  switch (expr.tag) {
    case 'literal':
      return expr.value;

    case 'identifier':
      return evaluateIdentifier(expr.name, env);

    case 'binary':
      return evaluateBinary(expr.op, expr.left, expr.right, env, ctx);

    case 'unary':
      return evaluateUnary(expr.op, expr.operand, env, ctx);

    case 'call':
      return evaluateCall(expr.fn, expr.args, env, ctx);

    case 'member':
      return evaluateMember(expr.object, expr.field, env, ctx);

    case 'index':
      return evaluateIndex(expr.collection, expr.index, env, ctx);

    case 'conditional':
      return evaluateConditional(expr.condition, expr.then, expr.else, env, ctx);

    case 'lambda':
      return evaluateLambda(expr.params, expr.body, env);

    case 'let':
      return evaluateLet(expr.bindings, expr.body, env, ctx);

    case 'match':
      return evaluateMatch(expr.scrutinee, expr.cases, env, ctx);

    case 'record_construct':
      return evaluateRecordConstruct(expr.type, expr.fields, env, ctx);

    case 'list_construct':
      return evaluateListConstruct(expr.elements, env, ctx);

    case 'map_construct':
      return evaluateMapConstruct(expr.entries, env, ctx);

    case 'effect_perform':
      return evaluateEffectPerform(expr.effect, expr.operation, expr.args, env, ctx);

    case 'quantifier':
      return evaluateQuantifier(expr.kind, expr.variable, expr.domain, expr.body, env, ctx);

    case 'old':
      // old() should be substituted before evaluation
      throw new InterpreterError('old() not substituted');

    case 'result': {
      const result = lookupBinding('result', env);
      if (result === undefined) {
        throw new InterpreterError('result is not defined');
      }
      return result;
    }

    default:
      throw new InterpreterError(`Unknown expression type: ${(expr as any).tag}`);
  }
}

// ============================================================================
// IDENTIFIER EVALUATION
// ============================================================================

function evaluateIdentifier(name: string, env: Environment): Value {
  const value = lookupBinding(name, env);
  if (value === undefined) {
    throw new InterpreterError(`Undefined identifier: ${name}`);
  }
  return value;
}

// ============================================================================
// BINARY OPERATIONS
// ============================================================================

async function evaluateBinary(
  op: string,
  left: Expression,
  right: Expression,
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  // Short-circuit evaluation for boolean operators
  if (op === '&&') {
    const leftVal = await evaluate(left, env, ctx);
    if (leftVal.tag !== 'boolean') throw new TypeMismatchError('boolean', leftVal.tag);
    if (!leftVal.value) return { tag: 'boolean', value: false };
    return evaluate(right, env, ctx);
  }
  
  if (op === '||') {
    const leftVal = await evaluate(left, env, ctx);
    if (leftVal.tag !== 'boolean') throw new TypeMismatchError('boolean', leftVal.tag);
    if (leftVal.value) return { tag: 'boolean', value: true };
    return evaluate(right, env, ctx);
  }

  const leftVal = await evaluate(left, env, ctx);
  const rightVal = await evaluate(right, env, ctx);

  switch (op) {
    // Arithmetic
    case '+':
      return binaryAdd(leftVal, rightVal);
    case '-':
      return binarySubtract(leftVal, rightVal);
    case '*':
      return binaryMultiply(leftVal, rightVal);
    case '/':
      return binaryDivide(leftVal, rightVal);
    case '%':
      return binaryModulo(leftVal, rightVal);
    case '**':
      return binaryPower(leftVal, rightVal);

    // Comparison
    case '==':
      return { tag: 'boolean', value: valuesEqual(leftVal, rightVal) };
    case '!=':
      return { tag: 'boolean', value: !valuesEqual(leftVal, rightVal) };
    case '<':
      return binaryLessThan(leftVal, rightVal);
    case '<=':
      return binaryLessOrEqual(leftVal, rightVal);
    case '>':
      return binaryGreaterThan(leftVal, rightVal);
    case '>=':
      return binaryGreaterOrEqual(leftVal, rightVal);

    // Collection operations
    case '++':
      return listConcat(leftVal, rightVal);
    case 'in':
      return memberOf(leftVal, rightVal);
    case 'contains':
      return contains(leftVal, rightVal);

    default:
      throw new InterpreterError(`Unknown binary operator: ${op}`);
  }
}

function binaryAdd(left: Value, right: Value): Value {
  if (left.tag === 'int' && right.tag === 'int') {
    return { tag: 'int', value: left.value + right.value };
  }
  if (left.tag === 'float' && right.tag === 'float') {
    return { tag: 'float', value: left.value + right.value };
  }
  if (left.tag === 'string' && right.tag === 'string') {
    return { tag: 'string', value: left.value + right.value };
  }
  throw new TypeMismatchError('numeric or string', `${left.tag} and ${right.tag}`);
}

function binarySubtract(left: Value, right: Value): Value {
  if (left.tag === 'int' && right.tag === 'int') {
    return { tag: 'int', value: left.value - right.value };
  }
  if (left.tag === 'float' && right.tag === 'float') {
    return { tag: 'float', value: left.value - right.value };
  }
  throw new TypeMismatchError('numeric', `${left.tag} and ${right.tag}`);
}

function binaryMultiply(left: Value, right: Value): Value {
  if (left.tag === 'int' && right.tag === 'int') {
    return { tag: 'int', value: left.value * right.value };
  }
  if (left.tag === 'float' && right.tag === 'float') {
    return { tag: 'float', value: left.value * right.value };
  }
  throw new TypeMismatchError('numeric', `${left.tag} and ${right.tag}`);
}

function binaryDivide(left: Value, right: Value): Value {
  if (left.tag === 'int' && right.tag === 'int') {
    if (right.value === 0n) throw new InterpreterError('Division by zero');
    return { tag: 'int', value: left.value / right.value };
  }
  if (left.tag === 'float' && right.tag === 'float') {
    return { tag: 'float', value: left.value / right.value };
  }
  throw new TypeMismatchError('numeric', `${left.tag} and ${right.tag}`);
}

function binaryModulo(left: Value, right: Value): Value {
  if (left.tag === 'int' && right.tag === 'int') {
    return { tag: 'int', value: left.value % right.value };
  }
  throw new TypeMismatchError('int', `${left.tag} and ${right.tag}`);
}

function binaryPower(left: Value, right: Value): Value {
  if (left.tag === 'int' && right.tag === 'int') {
    return { tag: 'int', value: left.value ** right.value };
  }
  if (left.tag === 'float' && right.tag === 'float') {
    return { tag: 'float', value: left.value ** right.value };
  }
  throw new TypeMismatchError('numeric', `${left.tag} and ${right.tag}`);
}

function binaryLessThan(left: Value, right: Value): Value {
  return { tag: 'boolean', value: compareValues(left, right) < 0 };
}

function binaryLessOrEqual(left: Value, right: Value): Value {
  return { tag: 'boolean', value: compareValues(left, right) <= 0 };
}

function binaryGreaterThan(left: Value, right: Value): Value {
  return { tag: 'boolean', value: compareValues(left, right) > 0 };
}

function binaryGreaterOrEqual(left: Value, right: Value): Value {
  return { tag: 'boolean', value: compareValues(left, right) >= 0 };
}

function listConcat(left: Value, right: Value): Value {
  if (left.tag !== 'list' || right.tag !== 'list') {
    throw new TypeMismatchError('list', `${left.tag} and ${right.tag}`);
  }
  return { tag: 'list', elements: [...left.elements, ...right.elements] };
}

function memberOf(left: Value, right: Value): Value {
  if (right.tag === 'list') {
    return { tag: 'boolean', value: right.elements.some(e => valuesEqual(e, left)) };
  }
  if (right.tag === 'set') {
    return { tag: 'boolean', value: Array.from(right.elements).some(e => valuesEqual(e, left)) };
  }
  throw new TypeMismatchError('list or set', right.tag);
}

function contains(left: Value, right: Value): Value {
  return memberOf(right, left);
}

// ============================================================================
// UNARY OPERATIONS
// ============================================================================

async function evaluateUnary(
  op: string,
  operand: Expression,
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const val = await evaluate(operand, env, ctx);

  switch (op) {
    case '-':
      if (val.tag === 'int') return { tag: 'int', value: -val.value };
      if (val.tag === 'float') return { tag: 'float', value: -val.value };
      throw new TypeMismatchError('numeric', val.tag);

    case '!':
    case 'not':
      if (val.tag !== 'boolean') throw new TypeMismatchError('boolean', val.tag);
      return { tag: 'boolean', value: !val.value };

    default:
      throw new InterpreterError(`Unknown unary operator: ${op}`);
  }
}

// ============================================================================
// FUNCTION CALLS
// ============================================================================

async function evaluateCall(
  fn: Expression,
  args: Expression[],
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const fnVal = await evaluate(fn, env, ctx);
  const argVals = await Promise.all(args.map(a => evaluate(a, env, ctx)));

  if (fnVal.tag === 'function') {
    const callEnv = extendEnvironment(fnVal.closure);
    for (let i = 0; i < fnVal.params.length; i++) {
      const paramName = fnVal.params[i];
      if (paramName !== undefined) {
        callEnv.bindings.set(paramName, argVals[i] ?? { tag: 'unit' });
      }
    }
    return evaluate(fnVal.body, callEnv, ctx);
  }

  if (fnVal.tag === 'native') {
    return fnVal.fn(argVals, env);
  }

  throw new TypeMismatchError('function', fnVal.tag);
}

// ============================================================================
// MEMBER ACCESS
// ============================================================================

async function evaluateMember(
  object: Expression,
  field: string,
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const objVal = await evaluate(object, env, ctx);

  if (objVal.tag === 'record' || objVal.tag === 'entity') {
    const value = objVal.fields.get(field);
    if (value === undefined) {
      throw new InterpreterError(`Unknown field: ${field}`);
    }
    return value;
  }

  if (objVal.tag === 'map') {
    const value = objVal.entries.get(field);
    return value ?? { tag: 'option', value: null };
  }

  throw new TypeMismatchError('record, entity, or map', objVal.tag);
}

// ============================================================================
// INDEX ACCESS
// ============================================================================

async function evaluateIndex(
  collection: Expression,
  index: Expression,
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const collVal = await evaluate(collection, env, ctx);
  const indexVal = await evaluate(index, env, ctx);

  if (collVal.tag === 'list') {
    if (indexVal.tag !== 'int') throw new TypeMismatchError('int', indexVal.tag);
    const i = Number(indexVal.value);
    if (i < 0 || i >= collVal.elements.length) {
      throw new InterpreterError(`Index out of bounds: ${i}`);
    }
    const element = collVal.elements[i];
    if (element === undefined) {
      throw new InterpreterError(`Index out of bounds: ${i}`);
    }
    return element;
  }

  if (collVal.tag === 'map') {
    if (indexVal.tag !== 'string') throw new TypeMismatchError('string', indexVal.tag);
    return collVal.entries.get(indexVal.value) ?? { tag: 'option', value: null };
  }

  throw new TypeMismatchError('list or map', collVal.tag);
}

// ============================================================================
// CONDITIONAL
// ============================================================================

async function evaluateConditional(
  condition: Expression,
  thenExpr: Expression,
  elseExpr: Expression,
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const condVal = await evaluate(condition, env, ctx);
  if (condVal.tag !== 'boolean') throw new TypeMismatchError('boolean', condVal.tag);
  return condVal.value ? evaluate(thenExpr, env, ctx) : evaluate(elseExpr, env, ctx);
}

// ============================================================================
// LAMBDA
// ============================================================================

function evaluateLambda(
  params: any[],
  body: Expression,
  env: Environment
): Value {
  return {
    tag: 'function',
    params: params.map(p => p.name),
    body,
    closure: env,
  };
}

// ============================================================================
// LET BINDING
// ============================================================================

async function evaluateLet(
  bindings: any[],
  body: Expression,
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const letEnv = extendEnvironment(env);
  
  for (const binding of bindings) {
    const value = await evaluate(binding.value, letEnv, ctx);
    letEnv.bindings.set(binding.name, value);
  }
  
  return evaluate(body, letEnv, ctx);
}

// ============================================================================
// PATTERN MATCHING
// ============================================================================

async function evaluateMatch(
  scrutinee: Expression,
  cases: MatchCase[],
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const value = await evaluate(scrutinee, env, ctx);
  
  for (const matchCase of cases) {
    const bindings = matchPattern(matchCase.pattern, value);
    if (bindings !== null) {
      const caseEnv = extendEnvironment(env);
      for (const [name, val] of bindings) {
        caseEnv.bindings.set(name, val);
      }
      
      // Check guard if present
      if (matchCase.guard) {
        const guardResult = await evaluate(matchCase.guard, caseEnv, ctx);
        if (guardResult.tag !== 'boolean' || !guardResult.value) {
          continue;
        }
      }
      
      return evaluate(matchCase.body, caseEnv, ctx);
    }
  }
  
  throw new InterpreterError('Non-exhaustive pattern match');
}

function matchPattern(pattern: Pattern, value: Value): Map<string, Value> | null {
  switch (pattern.tag) {
    case 'wildcard':
      return new Map();

    case 'literal':
      return valuesEqual(pattern.value, value) ? new Map() : null;

    case 'binding':
      return new Map([[pattern.name, value]]);

    case 'constructor':
      if (value.tag !== 'enum' || value.type !== pattern.type || value.variant !== pattern.variant) {
        return null;
      }
      // Match field patterns if present
      const bindings = new Map<string, Value>();
      for (const fieldPat of pattern.fields) {
        const fieldVal = (value.data as any)?.[fieldPat.name];
        const fieldBindings = matchPattern(fieldPat.pattern, fieldVal);
        if (fieldBindings === null) return null;
        for (const [k, v] of fieldBindings) bindings.set(k, v);
      }
      return bindings;

    case 'list':
      if (value.tag !== 'list') return null;
      if (pattern.rest) {
        if (value.elements.length < pattern.elements.length) return null;
      } else {
        if (value.elements.length !== pattern.elements.length) return null;
      }
      const listBindings = new Map<string, Value>();
      for (let i = 0; i < pattern.elements.length; i++) {
        const patternElem = pattern.elements[i];
        const valueElem = value.elements[i];
        if (patternElem === undefined || valueElem === undefined) return null;
        const elemBindings = matchPattern(patternElem, valueElem);
        if (elemBindings === null) return null;
        for (const [k, v] of elemBindings) listBindings.set(k, v);
      }
      if (pattern.rest) {
        listBindings.set(pattern.rest, {
          tag: 'list',
          elements: value.elements.slice(pattern.elements.length),
        });
      }
      return listBindings;

    case 'record':
      if (value.tag !== 'record' && value.tag !== 'entity') return null;
      const recBindings = new Map<string, Value>();
      for (const fieldPat of pattern.fields) {
        const fieldVal = value.fields.get(fieldPat.name);
        if (fieldVal === undefined) return null;
        const fieldBindings = matchPattern(fieldPat.pattern, fieldVal);
        if (fieldBindings === null) return null;
        for (const [k, v] of fieldBindings) recBindings.set(k, v);
      }
      return recBindings;

    default:
      return null;
  }
}

// ============================================================================
// CONSTRUCTORS
// ============================================================================

async function evaluateRecordConstruct(
  type: string,
  fields: { name: string; value: Expression }[],
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const fieldMap = new Map<string, Value>();
  for (const field of fields) {
    fieldMap.set(field.name, await evaluate(field.value, env, ctx));
  }
  return { tag: 'record', type, fields: fieldMap };
}

async function evaluateListConstruct(
  elements: Expression[],
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const values = await Promise.all(elements.map(e => evaluate(e, env, ctx)));
  return { tag: 'list', elements: values };
}

async function evaluateMapConstruct(
  entries: { key: Expression; value: Expression }[],
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const entryMap = new Map<string, Value>();
  for (const entry of entries) {
    const key = await evaluate(entry.key, env, ctx);
    if (key.tag !== 'string') throw new TypeMismatchError('string', key.tag);
    entryMap.set(key.value, await evaluate(entry.value, env, ctx));
  }
  return { tag: 'map', entries: entryMap };
}

// ============================================================================
// EFFECT OPERATIONS
// ============================================================================

async function evaluateEffectPerform(
  effect: string,
  operation: string,
  args: Expression[],
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const handler = env.effects.get(effect);
  if (!handler) {
    throw new UnhandledEffectError(effect, operation);
  }
  
  const opHandler = handler.operations.get(operation);
  if (!opHandler) {
    throw new UnhandledEffectError(effect, operation);
  }
  
  const argVals = await Promise.all(args.map(a => evaluate(a, env, ctx)));
  return opHandler(argVals, env);
}

// ============================================================================
// QUANTIFIERS
// ============================================================================

async function evaluateQuantifier(
  kind: 'forall' | 'exists',
  variable: string,
  domain: Expression,
  body: Expression,
  env: Environment,
  ctx: ExecutionContext
): Promise<Value> {
  const domainVal = await evaluate(domain, env, ctx);
  
  if (domainVal.tag !== 'list') {
    throw new TypeMismatchError('list', domainVal.tag);
  }
  
  for (const element of domainVal.elements) {
    const quantEnv = extendEnvironment(env);
    quantEnv.bindings.set(variable, element);
    
    const result = await evaluate(body, quantEnv, ctx);
    if (result.tag !== 'boolean') throw new TypeMismatchError('boolean', result.tag);
    
    if (kind === 'forall' && !result.value) {
      return { tag: 'boolean', value: false };
    }
    if (kind === 'exists' && result.value) {
      return { tag: 'boolean', value: true };
    }
  }
  
  return { tag: 'boolean', value: kind === 'forall' };
}

// ============================================================================
// VALUE COMPARISON
// ============================================================================

function valuesEqual(a: Value, b: Value): boolean {
  if (a.tag !== b.tag) return false;
  
  switch (a.tag) {
    case 'unit':
      return true;
    case 'boolean':
      return a.value === (b as typeof a).value;
    case 'int':
      return a.value === (b as typeof a).value;
    case 'float':
      return a.value === (b as typeof a).value;
    case 'string':
      return a.value === (b as typeof a).value;
    case 'uuid':
      return a.value === (b as typeof a).value;
    case 'list': {
      const bList = b as typeof a;
      if (a.elements.length !== bList.elements.length) return false;
      return a.elements.every((e, i) => {
        const bElem = bList.elements[i];
        return bElem !== undefined && valuesEqual(e, bElem);
      });
    }
    case 'record':
    case 'entity':
      const bRec = b as typeof a;
      if (a.fields.size !== bRec.fields.size) return false;
      for (const [k, v] of a.fields) {
        if (!bRec.fields.has(k) || !valuesEqual(v, bRec.fields.get(k)!)) return false;
      }
      return true;
    default:
      return false;
  }
}

function compareValues(a: Value, b: Value): number {
  if (a.tag === 'int' && b.tag === 'int') {
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  }
  if (a.tag === 'float' && b.tag === 'float') {
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  }
  if (a.tag === 'string' && b.tag === 'string') {
    return a.value.localeCompare(b.value);
  }
  throw new TypeMismatchError('comparable types', `${a.tag} and ${b.tag}`);
}
