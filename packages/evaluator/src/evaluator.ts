// ============================================================================
// ISL Expression Evaluator - Core Tree-Walking Interpreter
// ============================================================================

import type {
  Value,
  EvaluationContext,
  SourceLocation,
  EntityStore,
  BuiltinRegistry,
  LambdaValue,
} from './types.js';
import {
  EvaluationError,
  TypeError,
  ReferenceError,
  RuntimeError,
  isLambdaValue,
  getValueType,
} from './types.js';
import { SnapshotEntityStore, createScope } from './environment.js';
import { getDefaultBuiltins } from './builtins.js';

// ============================================================================
// AST TYPE INTERFACES (for compatibility with @isl-lang/parser)
// ============================================================================

// These interfaces match the AST types from the parser package
// We define them here to avoid a hard dependency

interface ASTNode {
  kind: string;
  location: SourceLocation;
}

interface Identifier extends ASTNode {
  kind: 'Identifier';
  name: string;
}

interface QualifiedName extends ASTNode {
  kind: 'QualifiedName';
  parts: Identifier[];
}

interface StringLiteral extends ASTNode {
  kind: 'StringLiteral';
  value: string;
}

interface NumberLiteral extends ASTNode {
  kind: 'NumberLiteral';
  value: number;
  isFloat: boolean;
}

interface BooleanLiteral extends ASTNode {
  kind: 'BooleanLiteral';
  value: boolean;
}

interface NullLiteral extends ASTNode {
  kind: 'NullLiteral';
}

interface DurationLiteral extends ASTNode {
  kind: 'DurationLiteral';
  value: number;
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days';
}

interface RegexLiteral extends ASTNode {
  kind: 'RegexLiteral';
  pattern: string;
  flags: string;
}

type BinaryOperator =
  | '==' | '!=' | '<' | '>' | '<=' | '>='
  | '+' | '-' | '*' | '/' | '%'
  | 'and' | 'or' | 'implies' | 'iff'
  | 'in';

interface BinaryExpr extends ASTNode {
  kind: 'BinaryExpr';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

type UnaryOperator = 'not' | '-';

interface UnaryExpr extends ASTNode {
  kind: 'UnaryExpr';
  operator: UnaryOperator;
  operand: Expression;
}

interface CallExpr extends ASTNode {
  kind: 'CallExpr';
  callee: Expression;
  arguments: Expression[];
}

interface MemberExpr extends ASTNode {
  kind: 'MemberExpr';
  object: Expression;
  property: Identifier;
}

interface IndexExpr extends ASTNode {
  kind: 'IndexExpr';
  object: Expression;
  index: Expression;
}

interface QuantifierExpr extends ASTNode {
  kind: 'QuantifierExpr';
  quantifier: 'all' | 'any' | 'none' | 'count' | 'sum' | 'filter';
  variable: Identifier;
  collection: Expression;
  predicate: Expression;
}

interface ConditionalExpr extends ASTNode {
  kind: 'ConditionalExpr';
  condition: Expression;
  thenBranch: Expression;
  elseBranch: Expression;
}

interface OldExpr extends ASTNode {
  kind: 'OldExpr';
  expression: Expression;
}

interface ResultExpr extends ASTNode {
  kind: 'ResultExpr';
  property?: Identifier;
}

interface InputExpr extends ASTNode {
  kind: 'InputExpr';
  property: Identifier;
}

interface LambdaExpr extends ASTNode {
  kind: 'LambdaExpr';
  params: Identifier[];
  body: Expression;
}

interface ListExpr extends ASTNode {
  kind: 'ListExpr';
  elements: Expression[];
}

interface MapEntry extends ASTNode {
  kind: 'MapEntry';
  key: Expression;
  value: Expression;
}

interface MapExpr extends ASTNode {
  kind: 'MapExpr';
  entries: MapEntry[];
}

type Expression =
  | Identifier
  | QualifiedName
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | NullLiteral
  | DurationLiteral
  | RegexLiteral
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | IndexExpr
  | QuantifierExpr
  | ConditionalExpr
  | OldExpr
  | ResultExpr
  | InputExpr
  | LambdaExpr
  | ListExpr
  | MapExpr;

// ============================================================================
// EVALUATOR OPTIONS
// ============================================================================

export interface EvaluatorOptions {
  /** Custom builtin registry */
  builtins?: BuiltinRegistry;
  /** Enable strict type checking */
  strict?: boolean;
  /** Maximum recursion depth */
  maxDepth?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

// ============================================================================
// EVALUATOR CLASS
// ============================================================================

/**
 * Tree-walking interpreter for ISL expressions
 */
export class Evaluator {
  private readonly builtins: BuiltinRegistry;
  private readonly maxDepth: number;
  private currentDepth: number = 0;
  private startTime: number = 0;
  private timeout: number;

  constructor(options: EvaluatorOptions = {}) {
    this.builtins = options.builtins ?? getDefaultBuiltins();
    // options.strict reserved for future strict mode
    this.maxDepth = options.maxDepth ?? 1000;
    this.timeout = options.timeout ?? 5000;
  }

  /**
   * Evaluate an expression in the given context
   */
  evaluate(expr: unknown, context: EvaluationContext): Value {
    this.startTime = Date.now();
    this.currentDepth = 0;
    return this.eval(expr as Expression, context);
  }

  // ============================================================================
  // MAIN DISPATCH
  // ============================================================================

  private eval(expr: Expression, ctx: EvaluationContext): Value {
    // Check recursion depth
    if (++this.currentDepth > this.maxDepth) {
      throw new RuntimeError(
        `Maximum recursion depth exceeded (${this.maxDepth})`,
        expr.location
      );
    }

    // Check timeout
    if (Date.now() - this.startTime > this.timeout) {
      throw new RuntimeError(
        `Evaluation timeout exceeded (${this.timeout}ms)`,
        expr.location
      );
    }

    try {
      switch (expr.kind) {
        case 'Identifier':
          return this.evalIdentifier(expr, ctx);

        case 'QualifiedName':
          return this.evalQualifiedName(expr, ctx);

        case 'StringLiteral':
          return expr.value;

        case 'NumberLiteral':
          return expr.value;

        case 'BooleanLiteral':
          return expr.value;

        case 'NullLiteral':
          return null;

        case 'DurationLiteral':
          return this.evalDuration(expr);

        case 'RegexLiteral':
          return new RegExp(expr.pattern, expr.flags);

        case 'BinaryExpr':
          return this.evalBinaryExpr(expr, ctx);

        case 'UnaryExpr':
          return this.evalUnaryExpr(expr, ctx);

        case 'CallExpr':
          return this.evalCallExpr(expr, ctx);

        case 'MemberExpr':
          return this.evalMemberExpr(expr, ctx);

        case 'IndexExpr':
          return this.evalIndexExpr(expr, ctx);

        case 'QuantifierExpr':
          return this.evalQuantifierExpr(expr, ctx);

        case 'ConditionalExpr':
          return this.evalConditionalExpr(expr, ctx);

        case 'OldExpr':
          return this.evalOldExpr(expr, ctx);

        case 'ResultExpr':
          return this.evalResultExpr(expr, ctx);

        case 'InputExpr':
          return this.evalInputExpr(expr, ctx);

        case 'LambdaExpr':
          return this.evalLambdaExpr(expr, ctx);

        case 'ListExpr':
          return expr.elements.map((el) => this.eval(el, ctx));

        case 'MapExpr':
          return this.evalMapExpr(expr, ctx);

        default: {
          const unknownExpr = expr as unknown as ASTNode;
          throw new EvaluationError(
            `Unsupported expression kind: ${unknownExpr.kind}`,
            unknownExpr.location,
            expr
          );
        }
      }
    } finally {
      this.currentDepth--;
    }
  }

  // ============================================================================
  // IDENTIFIER EVALUATION
  // ============================================================================

  private evalIdentifier(expr: Identifier, ctx: EvaluationContext): Value {
    const name = expr.name;

    // Special identifiers
    if (name === 'result') return ctx.result as Value;
    if (name === 'input') return ctx.input as Value;
    if (name === 'now') return ctx.now;
    if (name === 'true') return true;
    if (name === 'false') return false;
    if (name === 'null') return null;
    if (name === 'undefined') return undefined;

    // Check variables map
    if (ctx.variables.has(name)) {
      return ctx.variables.get(name) as Value;
    }

    // Check if it's an entity type
    if (ctx.domain?.entities.some((e) => e.name === name)) {
      return this.createEntityProxy(name, ctx.store) as unknown as Value;
    }

    // Check input fields
    if (name in ctx.input) {
      return ctx.input[name] as Value;
    }

    // Check builtins (return function reference)
    if (this.builtins.has(name)) {
      return ((...args: Value[]) =>
        this.builtins.get(name)!(args, ctx, expr.location)) as unknown as Value;
    }

    throw new ReferenceError(
      `Unknown identifier: ${name}`,
      expr.location,
      name,
      expr
    );
  }

  private evalQualifiedName(expr: QualifiedName, ctx: EvaluationContext): Value {
    const parts = expr.parts;
    
    // Start with first part
    let value: Value = this.evalIdentifier(parts[0]!, ctx);

    // Navigate through remaining parts
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]!.name;
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, Value>)[part];
    }

    return value;
  }

  // ============================================================================
  // ENTITY PROXY
  // ============================================================================

  private createEntityProxy(
    entityName: string,
    store: EntityStore
  ): EntityProxy {
    return {
      __entityName__: entityName,
      __isProxy__: true,
      
      exists: (criteria?: Record<string, unknown>) =>
        store.exists(entityName, criteria),
      
      lookup: (criteria: Record<string, unknown>) =>
        store.lookup(entityName, criteria) as Value,
      
      count: (criteria?: Record<string, unknown>) =>
        store.count(entityName, criteria),
      
      getAll: () => store.getAll(entityName) as Value[],
    };
  }

  // ============================================================================
  // BINARY EXPRESSIONS
  // ============================================================================

  private evalBinaryExpr(expr: BinaryExpr, ctx: EvaluationContext): Value {
    // Short-circuit evaluation for logical operators
    if (expr.operator === 'and') {
      const left = this.eval(expr.left, ctx);
      if (!left) return false;
      return Boolean(this.eval(expr.right, ctx));
    }

    if (expr.operator === 'or') {
      const left = this.eval(expr.left, ctx);
      if (left) return true;
      return Boolean(this.eval(expr.right, ctx));
    }

    if (expr.operator === 'implies') {
      const left = this.eval(expr.left, ctx);
      if (!left) return true; // false implies anything is true
      return Boolean(this.eval(expr.right, ctx));
    }

    // Evaluate both sides
    const left = this.eval(expr.left, ctx);
    const right = this.eval(expr.right, ctx);

    switch (expr.operator) {
      case '==':
        return this.deepEqual(left, right);

      case '!=':
        return !this.deepEqual(left, right);

      case '<':
        this.assertNumbers(left, right, expr.location, '<');
        return (left as number) < (right as number);

      case '>':
        this.assertNumbers(left, right, expr.location, '>');
        return (left as number) > (right as number);

      case '<=':
        this.assertNumbers(left, right, expr.location, '<=');
        return (left as number) <= (right as number);

      case '>=':
        this.assertNumbers(left, right, expr.location, '>=');
        return (left as number) >= (right as number);

      case '+':
        // Allow string concatenation
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        this.assertNumbers(left, right, expr.location, '+');
        return (left as number) + (right as number);

      case '-':
        this.assertNumbers(left, right, expr.location, '-');
        return (left as number) - (right as number);

      case '*':
        this.assertNumbers(left, right, expr.location, '*');
        return (left as number) * (right as number);

      case '/':
        this.assertNumbers(left, right, expr.location, '/');
        if (right === 0) {
          throw new RuntimeError('Division by zero', expr.location);
        }
        return (left as number) / (right as number);

      case '%':
        this.assertNumbers(left, right, expr.location, '%');
        if (right === 0) {
          throw new RuntimeError('Modulo by zero', expr.location);
        }
        return (left as number) % (right as number);

      case 'iff':
        return Boolean(left) === Boolean(right);

      case 'in':
        if (Array.isArray(right)) {
          return right.some((item) => this.deepEqual(item, left));
        }
        if (typeof right === 'object' && right !== null) {
          return String(left) in right;
        }
        if (typeof right === 'string' && typeof left === 'string') {
          return right.includes(left);
        }
        return false;

      default:
        throw new EvaluationError(
          `Unknown binary operator: ${expr.operator}`,
          expr.location,
          expr
        );
    }
  }

  // ============================================================================
  // UNARY EXPRESSIONS
  // ============================================================================

  private evalUnaryExpr(expr: UnaryExpr, ctx: EvaluationContext): Value {
    const operand = this.eval(expr.operand, ctx);

    switch (expr.operator) {
      case 'not':
        return !operand;

      case '-':
        if (typeof operand !== 'number') {
          throw new TypeError(
            `Unary minus requires number, got ${getValueType(operand)}`,
            expr.location,
            'number',
            getValueType(operand),
            expr
          );
        }
        return -operand;

      default:
        throw new EvaluationError(
          `Unknown unary operator: ${expr.operator}`,
          expr.location,
          expr
        );
    }
  }

  // ============================================================================
  // CALL EXPRESSIONS
  // ============================================================================

  private evalCallExpr(expr: CallExpr, ctx: EvaluationContext): Value {
    const callee = expr.callee;

    // Member call (e.g., User.exists(...) or str.contains(...))
    if (callee.kind === 'MemberExpr') {
      const obj = this.eval(callee.object, ctx);
      const method = callee.property.name;
      const args = expr.arguments.map((arg) => this.eval(arg, ctx));

      // Entity proxy methods
      if (isEntityProxy(obj)) {
        return this.handleEntityMethod(obj, method, args, expr);
      }

      // Array methods
      if (Array.isArray(obj)) {
        return this.handleArrayMethod(obj, method, args, expr, ctx);
      }

      // String methods
      if (typeof obj === 'string') {
        return this.handleStringMethod(obj, method, args, expr);
      }

      // Object method call
      if (typeof obj === 'object' && obj !== null) {
        const fn = (obj as Record<string, unknown>)[method];
        if (typeof fn === 'function') {
          return fn.apply(obj, args) as Value;
        }
      }

      throw new EvaluationError(
        `Cannot call method ${method} on ${getValueType(obj)}`,
        expr.location,
        expr
      );
    }

    // Direct function call
    if (callee.kind === 'Identifier') {
      const name = callee.name;
      
      // Check builtins first
      if (this.builtins.has(name)) {
        const args = expr.arguments.map((arg) => this.eval(arg, ctx));
        return this.builtins.get(name)!(args, ctx, expr.location);
      }

      // Check if it's a variable holding a function
      if (ctx.variables.has(name)) {
        const fn = ctx.variables.get(name);
        if (typeof fn === 'function') {
          const args = expr.arguments.map((arg) => this.eval(arg, ctx));
          return (fn as (...a: unknown[]) => unknown)(...args) as Value;
        }
        if (isLambdaValue(fn as Value)) {
          return this.callLambda(fn as LambdaValue, expr, ctx);
        }
      }

      throw new ReferenceError(
        `Unknown function: ${name}`,
        expr.location,
        name,
        expr
      );
    }

    // Lambda call
    const fn = this.eval(callee, ctx);
    if (typeof fn === 'function') {
      const args = expr.arguments.map((arg) => this.eval(arg, ctx));
      return (fn as (...a: unknown[]) => unknown)(...args) as Value;
    }
    if (isLambdaValue(fn)) {
      return this.callLambda(fn, expr, ctx);
    }

    throw new EvaluationError(
      `Cannot call non-function: ${getValueType(fn)}`,
      expr.location,
      expr
    );
  }

  private callLambda(
    lambda: LambdaValue,
    expr: CallExpr,
    ctx: EvaluationContext
  ): Value {
    const args = expr.arguments.map((arg) => this.eval(arg, ctx));
    
    // Create new context with lambda parameters
    const newVars = new Map(lambda.closure.bindings());
    lambda.params.forEach((param, i) => {
      newVars.set(param, { name: param, value: args[i], mutable: false });
    });

    const newCtx: EvaluationContext = {
      ...ctx,
      variables: new Map(
        Array.from(newVars.entries()).map(([k, v]) => [k, v.value])
      ),
    };

    return this.eval(lambda.body as Expression, newCtx);
  }

  private handleEntityMethod(
    entity: EntityProxy,
    method: string,
    args: Value[],
    expr: CallExpr
  ): Value {
    switch (method) {
      case 'exists':
        if (args.length === 0) return entity.exists();
        return entity.exists(args[0] as Record<string, unknown>);

      case 'lookup':
        return entity.lookup(args[0] as Record<string, unknown>);

      case 'count':
        if (args.length === 0) return entity.count();
        return entity.count(args[0] as Record<string, unknown>);

      case 'getAll':
      case 'all':
        return entity.getAll();

      default:
        throw new EvaluationError(
          `Unknown entity method: ${entity.__entityName__}.${method}`,
          expr.location,
          expr
        );
    }
  }

  private handleArrayMethod(
    array: unknown[],
    method: string,
    args: Value[],
    expr: CallExpr,
    ctx: EvaluationContext
  ): Value {
    switch (method) {
      case 'length':
        return array.length;

      case 'includes':
      case 'contains':
        return array.some((item) => this.deepEqual(item, args[0]));

      case 'indexOf':
        return array.findIndex((item) => this.deepEqual(item, args[0]));

      case 'map':
        if (typeof args[0] === 'function') {
          return array.map(args[0] as (v: unknown) => unknown) as Value[];
        }
        if (isLambdaValue(args[0] as Value)) {
          const lambda = args[0] as unknown as LambdaValue;
          return array.map((item) => {
            const newVars = new Map(ctx.variables);
            newVars.set(lambda.params[0]!, item);
            return this.eval(lambda.body as Expression, { ...ctx, variables: newVars });
          });
        }
        throw new TypeError(
          'map() requires a function',
          expr.location,
          'function',
          getValueType(args[0])
        );

      case 'filter':
        if (typeof args[0] === 'function') {
          return array.filter(args[0] as (v: unknown) => boolean) as Value[];
        }
        if (isLambdaValue(args[0] as Value)) {
          const lambda = args[0] as unknown as LambdaValue;
          return array.filter((item) => {
            const newVars = new Map(ctx.variables);
            newVars.set(lambda.params[0]!, item);
            return Boolean(this.eval(lambda.body as Expression, { ...ctx, variables: newVars }));
          }) as Value[];
        }
        throw new TypeError(
          'filter() requires a function',
          expr.location,
          'function',
          getValueType(args[0])
        );

      case 'find':
        if (typeof args[0] === 'function') {
          return (array.find(args[0] as (v: unknown) => boolean) ?? null) as Value;
        }
        throw new TypeError(
          'find() requires a function',
          expr.location,
          'function',
          getValueType(args[0])
        );

      case 'every':
        if (typeof args[0] === 'function') {
          return array.every(args[0] as (v: unknown) => boolean);
        }
        throw new TypeError(
          'every() requires a function',
          expr.location,
          'function',
          getValueType(args[0])
        );

      case 'some':
        if (typeof args[0] === 'function') {
          return array.some(args[0] as (v: unknown) => boolean);
        }
        throw new TypeError(
          'some() requires a function',
          expr.location,
          'function',
          getValueType(args[0])
        );

      case 'reduce':
        if (typeof args[0] === 'function') {
          return array.reduce(
            args[0] as (acc: unknown, v: unknown) => unknown,
            args[1] ?? 0
          ) as Value;
        }
        throw new TypeError(
          'reduce() requires a function',
          expr.location,
          'function',
          getValueType(args[0])
        );

      case 'first':
        return array[0] as Value ?? null;

      case 'last':
        return array[array.length - 1] as Value ?? null;

      case 'slice':
        return array.slice(
          args[0] as number,
          args[1] as number | undefined
        ) as Value[];

      case 'concat':
        if (Array.isArray(args[0])) {
          return [...array, ...args[0]] as Value[];
        }
        return [...array, args[0]] as Value[];

      default:
        throw new EvaluationError(
          `Unknown array method: ${method}`,
          expr.location,
          expr
        );
    }
  }

  private handleStringMethod(
    str: string,
    method: string,
    args: Value[],
    expr: CallExpr
  ): Value {
    switch (method) {
      case 'length':
        return str.length;

      case 'includes':
      case 'contains':
        return str.includes(args[0] as string);

      case 'startsWith':
        return str.startsWith(args[0] as string);

      case 'endsWith':
        return str.endsWith(args[0] as string);

      case 'toLowerCase':
      case 'lower':
        return str.toLowerCase();

      case 'toUpperCase':
      case 'upper':
        return str.toUpperCase();

      case 'trim':
        return str.trim();

      case 'trimStart':
        return str.trimStart();

      case 'trimEnd':
        return str.trimEnd();

      case 'split':
        return str.split(args[0] as string) as Value[];

      case 'substring':
      case 'substr':
        return str.substring(
          args[0] as number,
          args[1] as number | undefined
        );

      case 'replace':
        return str.replace(
          args[0] as string | RegExp,
          args[1] as string
        );

      case 'replaceAll':
        return str.split(args[0] as string).join(args[1] as string);

      case 'match':
      case 'matches':
        if (args[0] instanceof RegExp) {
          return args[0].test(str);
        }
        return new RegExp(args[0] as string).test(str);

      case 'indexOf':
        return str.indexOf(args[0] as string);

      case 'charAt':
        return str.charAt(args[0] as number);

      case 'is_valid':
      case 'isValid':
        return str.length > 0;

      default:
        throw new EvaluationError(
          `Unknown string method: ${method}`,
          expr.location,
          expr
        );
    }
  }

  // ============================================================================
  // MEMBER EXPRESSIONS
  // ============================================================================

  private evalMemberExpr(expr: MemberExpr, ctx: EvaluationContext): Value {
    const object = this.eval(expr.object, ctx);
    const property = expr.property.name;

    if (object === null || object === undefined) {
      return undefined;
    }

    // Entity proxy - return bound method
    if (isEntityProxy(object)) {
      switch (property) {
        case 'exists':
          return ((criteria?: Record<string, unknown>) =>
            object.exists(criteria)) as unknown as Value;
        case 'lookup':
          return ((criteria: Record<string, unknown>) =>
            object.lookup(criteria)) as unknown as Value;
        case 'count':
          return ((criteria?: Record<string, unknown>) =>
            object.count(criteria)) as unknown as Value;
        case 'getAll':
        case 'all':
          return (() => object.getAll()) as unknown as Value;
        default:
          throw new EvaluationError(
            `Unknown entity property: ${object.__entityName__}.${property}`,
            expr.location,
            expr
          );
      }
    }

    // Array length
    if (Array.isArray(object) && property === 'length') {
      return object.length;
    }

    // String length
    if (typeof object === 'string' && property === 'length') {
      return object.length;
    }

    // General property access
    return (object as Record<string, Value>)[property];
  }

  // ============================================================================
  // INDEX EXPRESSIONS
  // ============================================================================

  private evalIndexExpr(expr: IndexExpr, ctx: EvaluationContext): Value {
    const object = this.eval(expr.object, ctx);
    const index = this.eval(expr.index, ctx);

    if (object === null || object === undefined) {
      return undefined;
    }

    if (Array.isArray(object)) {
      const idx = index as number;
      if (idx < 0 || idx >= object.length) {
        return undefined;
      }
      return object[idx] as Value;
    }

    if (typeof object === 'string') {
      const idx = index as number;
      if (idx < 0 || idx >= object.length) {
        return undefined;
      }
      return object[idx];
    }

    if (typeof object === 'object') {
      return (object as Record<string, Value>)[String(index)];
    }

    throw new TypeError(
      `Cannot index ${getValueType(object)}`,
      expr.location,
      'array | string | object',
      getValueType(object),
      expr
    );
  }

  // ============================================================================
  // QUANTIFIER EXPRESSIONS
  // ============================================================================

  private evalQuantifierExpr(
    expr: QuantifierExpr,
    ctx: EvaluationContext
  ): Value {
    const collection = this.eval(expr.collection, ctx);
    const variable = expr.variable.name;

    // Get items from collection or entity proxy
    let items: unknown[];
    if (isEntityProxy(collection)) {
      items = collection.getAll();
    } else if (Array.isArray(collection)) {
      items = collection;
    } else {
      throw new TypeError(
        `Quantifier requires array or entity, got ${getValueType(collection)}`,
        expr.location,
        'array | entity',
        getValueType(collection),
        expr
      );
    }

    // Create evaluation function for predicate
    const evalPredicate = (item: unknown): boolean => {
      const newVars = new Map(ctx.variables);
      newVars.set(variable, item);
      const result = this.eval(expr.predicate, { ...ctx, variables: newVars });
      return Boolean(result);
    };

    switch (expr.quantifier) {
      case 'all':
        return items.every(evalPredicate);

      case 'any':
        return items.some(evalPredicate);

      case 'none':
        return !items.some(evalPredicate);

      case 'count':
        return items.filter(evalPredicate).length;

      case 'sum': {
        const evalValue = (item: unknown): number => {
          const newVars = new Map(ctx.variables);
          newVars.set(variable, item);
          const result = this.eval(expr.predicate, { ...ctx, variables: newVars });
          if (typeof result !== 'number') {
            throw new TypeError(
              `sum quantifier requires numeric predicate result`,
              expr.location,
              'number',
              getValueType(result),
              expr
            );
          }
          return result;
        };
        return items.reduce((acc: number, item) => acc + evalValue(item), 0);
      }

      case 'filter':
        return items.filter(evalPredicate) as Value[];

      default:
        throw new EvaluationError(
          `Unknown quantifier: ${expr.quantifier}`,
          expr.location,
          expr
        );
    }
  }

  // ============================================================================
  // SPECIAL EXPRESSIONS
  // ============================================================================

  private evalConditionalExpr(
    expr: ConditionalExpr,
    ctx: EvaluationContext
  ): Value {
    const condition = this.eval(expr.condition, ctx);
    return condition
      ? this.eval(expr.thenBranch, ctx)
      : this.eval(expr.elseBranch, ctx);
  }

  private evalOldExpr(expr: OldExpr, ctx: EvaluationContext): Value {
    if (!ctx.oldState) {
      throw new RuntimeError(
        'old() called without previous state snapshot',
        expr.location
      );
    }

    // Create context with old state store
    const oldStore = new SnapshotEntityStore(ctx.oldState);
    const oldCtx: EvaluationContext = {
      ...ctx,
      store: oldStore,
    };

    return this.eval(expr.expression, oldCtx);
  }

  private evalResultExpr(expr: ResultExpr, ctx: EvaluationContext): Value {
    if (expr.property) {
      if (ctx.result === null || ctx.result === undefined) {
        return undefined;
      }
      return (ctx.result as Record<string, Value>)[expr.property.name];
    }
    return ctx.result as Value;
  }

  private evalInputExpr(expr: InputExpr, ctx: EvaluationContext): Value {
    return ctx.input[expr.property.name] as Value;
  }

  private evalLambdaExpr(expr: LambdaExpr, ctx: EvaluationContext): Value {
    // Capture closure
    const closure = createScope();
    for (const [name, value] of ctx.variables) {
      closure.define(name, value as Value);
    }

    const lambda: LambdaValue = {
      __type__: 'lambda',
      params: expr.params.map((p) => p.name),
      body: expr.body,
      closure,
    };

    return lambda as unknown as Value;
  }

  private evalMapExpr(expr: MapExpr, ctx: EvaluationContext): Value {
    const result: Record<string, Value> = {};
    for (const entry of expr.entries) {
      const key = this.eval(entry.key, ctx);
      const value = this.eval(entry.value, ctx);
      result[String(key)] = value;
    }
    return result;
  }

  private evalDuration(expr: DurationLiteral): number {
    const value = expr.value;
    switch (expr.unit) {
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

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private assertNumbers(
    left: unknown,
    right: unknown,
    location: SourceLocation,
    operator: string
  ): void {
    if (typeof left !== 'number' || typeof right !== 'number') {
      throw new TypeError(
        `Operator '${operator}' requires numbers, got ${getValueType(left)} and ${getValueType(right)}`,
        location,
        'number',
        `${getValueType(left)}, ${getValueType(right)}`
      );
    }
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => this.deepEqual(val, b[i]));
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) =>
        this.deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      );
    }

    return false;
  }
}

// ============================================================================
// ENTITY PROXY TYPE
// ============================================================================

interface EntityProxy {
  __entityName__: string;
  __isProxy__: true;
  exists(criteria?: Record<string, unknown>): boolean;
  lookup(criteria: Record<string, unknown>): Value;
  count(criteria?: Record<string, unknown>): number;
  getAll(): Value[];
}

function isEntityProxy(value: unknown): value is EntityProxy {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__isProxy__' in value &&
    (value as EntityProxy).__isProxy__ === true
  );
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

/**
 * Evaluate an expression (convenience wrapper)
 */
export function evaluate(
  expr: unknown,
  context: EvaluationContext,
  options?: EvaluatorOptions
): Value {
  const evaluator = new Evaluator(options);
  return evaluator.evaluate(expr, context);
}

/**
 * Convert expression to string representation
 */
export function expressionToString(expr: unknown): string {
  const e = expr as Expression;
  
  switch (e.kind) {
    case 'Identifier':
      return e.name;
    case 'QualifiedName':
      return e.parts.map((p) => p.name).join('.');
    case 'StringLiteral':
      return JSON.stringify(e.value);
    case 'NumberLiteral':
      return String(e.value);
    case 'BooleanLiteral':
      return String(e.value);
    case 'NullLiteral':
      return 'null';
    case 'DurationLiteral':
      return `${e.value}${e.unit}`;
    case 'RegexLiteral':
      return `/${e.pattern}/${e.flags}`;
    case 'BinaryExpr':
      return `(${expressionToString(e.left)} ${e.operator} ${expressionToString(e.right)})`;
    case 'UnaryExpr':
      return `${e.operator}(${expressionToString(e.operand)})`;
    case 'CallExpr':
      return `${expressionToString(e.callee)}(${e.arguments.map(expressionToString).join(', ')})`;
    case 'MemberExpr':
      return `${expressionToString(e.object)}.${e.property.name}`;
    case 'IndexExpr':
      return `${expressionToString(e.object)}[${expressionToString(e.index)}]`;
    case 'OldExpr':
      return `old(${expressionToString(e.expression)})`;
    case 'ResultExpr':
      return e.property ? `result.${e.property.name}` : 'result';
    case 'InputExpr':
      return `input.${e.property.name}`;
    case 'QuantifierExpr':
      return `${e.quantifier} ${e.variable.name} in ${expressionToString(e.collection)}: ${expressionToString(e.predicate)}`;
    case 'ConditionalExpr':
      return `${expressionToString(e.condition)} ? ${expressionToString(e.thenBranch)} : ${expressionToString(e.elseBranch)}`;
    case 'LambdaExpr':
      return `(${e.params.map((p) => p.name).join(', ')}) => ${expressionToString(e.body)}`;
    case 'ListExpr':
      return `[${e.elements.map(expressionToString).join(', ')}]`;
    case 'MapExpr':
      return `{${e.entries.map((entry) => `${expressionToString(entry.key)}: ${expressionToString(entry.value)}`).join(', ')}}`;
    default:
      return `<${(e as ASTNode).kind}>`;
  }
}
