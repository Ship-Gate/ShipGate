// ============================================================================
// Expression Type Inference
// ============================================================================

import type {
  ResolvedType,
  SourceLocation,
  BehaviorResolvedType,
} from './types';
import {
  BOOLEAN_TYPE,
  STRING_TYPE,
  INT_TYPE,
  DECIMAL_TYPE,
  TIMESTAMP_TYPE,
  UUID_TYPE,
  DURATION_TYPE,
  UNKNOWN_TYPE,
  VOID_TYPE,
  typeToString,
  isAssignableTo,
} from './types';
import type { SymbolTableBuilder } from './symbols';
import type { Diagnostic } from './errors';
import {
  undefinedVariableError,
  undefinedFieldError,
  incompatibleTypesError,
  invalidOperatorError,
  oldOutsidePostconditionError,
  resultOutsidePostconditionError,
  inputInvalidFieldError,
  typeMismatchError,
} from './errors';

// ============================================================================
// Expression AST interfaces (minimal)
// ============================================================================

interface Expression {
  kind: string;
  location: SourceLocation;
}

interface Identifier extends Expression {
  kind: 'Identifier';
  name: string;
}

interface QualifiedName extends Expression {
  kind: 'QualifiedName';
  parts: Identifier[];
}

interface StringLiteral extends Expression {
  kind: 'StringLiteral';
  value: string;
}

interface NumberLiteral extends Expression {
  kind: 'NumberLiteral';
  value: number;
  isFloat: boolean;
}

interface BooleanLiteral extends Expression {
  kind: 'BooleanLiteral';
  value: boolean;
}

interface NullLiteral extends Expression {
  kind: 'NullLiteral';
}

interface DurationLiteral extends Expression {
  kind: 'DurationLiteral';
  value: number;
  unit: string;
}

interface RegexLiteral extends Expression {
  kind: 'RegexLiteral';
  pattern: string;
}

interface BinaryExpr extends Expression {
  kind: 'BinaryExpr';
  operator: string;
  left: Expression;
  right: Expression;
}

interface UnaryExpr extends Expression {
  kind: 'UnaryExpr';
  operator: string;
  operand: Expression;
}

interface CallExpr extends Expression {
  kind: 'CallExpr';
  callee: Expression;
  arguments: Expression[];
}

interface MemberExpr extends Expression {
  kind: 'MemberExpr';
  object: Expression;
  property: Identifier;
}

interface IndexExpr extends Expression {
  kind: 'IndexExpr';
  object: Expression;
  index: Expression;
}

interface QuantifierExpr extends Expression {
  kind: 'QuantifierExpr';
  quantifier: 'all' | 'any' | 'none' | 'count' | 'sum' | 'filter';
  variable: Identifier;
  collection: Expression;
  predicate: Expression;
}

interface ConditionalExpr extends Expression {
  kind: 'ConditionalExpr';
  condition: Expression;
  thenBranch: Expression;
  elseBranch: Expression;
}

interface OldExpr extends Expression {
  kind: 'OldExpr';
  expression: Expression;
}

interface ResultExpr extends Expression {
  kind: 'ResultExpr';
  property?: Identifier;
}

interface InputExpr extends Expression {
  kind: 'InputExpr';
  property: Identifier;
}

interface LambdaExpr extends Expression {
  kind: 'LambdaExpr';
  params: Identifier[];
  body: Expression;
}

interface ListExpr extends Expression {
  kind: 'ListExpr';
  elements: Expression[];
}

interface MapExpr extends Expression {
  kind: 'MapExpr';
  entries: Array<{ key: Expression; value: Expression }>;
}

// ============================================================================
// Expression Context
// ============================================================================

export interface ExpressionContext {
  /** Are we inside a postcondition block? */
  inPostcondition: boolean;
  
  /** The current behavior being checked (for input references) */
  currentBehavior?: BehaviorResolvedType;
  
  /** The output type (for result references) */
  outputType?: ResolvedType;
  
  /** Local variables (e.g., quantifier variables) */
  locals: Map<string, ResolvedType>;
}

// ============================================================================
// Expression Type Checker
// ============================================================================

export class ExpressionChecker {
  private symbolTable: SymbolTableBuilder;
  private diagnostics: Diagnostic[] = [];
  private typeMap: Map<Expression, ResolvedType> = new Map();

  constructor(symbolTable: SymbolTableBuilder) {
    this.symbolTable = symbolTable;
  }

  getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  clearDiagnostics(): void {
    this.diagnostics = [];
  }

  getTypeMap(): Map<Expression, ResolvedType> {
    return this.typeMap;
  }

  /**
   * Infer the type of an expression
   */
  infer(expr: Expression, ctx: ExpressionContext): ResolvedType {
    const type = this.inferInternal(expr, ctx);
    this.typeMap.set(expr, type);
    return type;
  }

  private inferInternal(expr: Expression, ctx: ExpressionContext): ResolvedType {
    switch (expr.kind) {
      case 'Identifier':
        return this.inferIdentifier(expr as Identifier, ctx);
      
      case 'QualifiedName':
        return this.inferQualifiedName(expr as QualifiedName, ctx);
      
      case 'StringLiteral':
        return STRING_TYPE;
      
      case 'NumberLiteral':
        return this.inferNumber(expr as NumberLiteral);
      
      case 'BooleanLiteral':
        return BOOLEAN_TYPE;
      
      case 'NullLiteral':
        return { kind: 'optional', inner: UNKNOWN_TYPE };
      
      case 'DurationLiteral':
        return DURATION_TYPE;
      
      case 'RegexLiteral':
        return STRING_TYPE; // Regex patterns are strings
      
      case 'BinaryExpr':
        return this.inferBinary(expr as BinaryExpr, ctx);
      
      case 'UnaryExpr':
        return this.inferUnary(expr as UnaryExpr, ctx);
      
      case 'CallExpr':
        return this.inferCall(expr as CallExpr, ctx);
      
      case 'MemberExpr':
        return this.inferMember(expr as MemberExpr, ctx);
      
      case 'IndexExpr':
        return this.inferIndex(expr as IndexExpr, ctx);
      
      case 'QuantifierExpr':
        return this.inferQuantifier(expr as QuantifierExpr, ctx);
      
      case 'ConditionalExpr':
        return this.inferConditional(expr as ConditionalExpr, ctx);
      
      case 'OldExpr':
        return this.inferOld(expr as OldExpr, ctx);
      
      case 'ResultExpr':
        return this.inferResult(expr as ResultExpr, ctx);
      
      case 'InputExpr':
        return this.inferInput(expr as InputExpr, ctx);
      
      case 'LambdaExpr':
        return this.inferLambda(expr as LambdaExpr, ctx);
      
      case 'ListExpr':
        return this.inferList(expr as ListExpr, ctx);
      
      case 'MapExpr':
        return this.inferMap(expr as MapExpr, ctx);
      
      default:
        return UNKNOWN_TYPE;
    }
  }

  private inferIdentifier(expr: Identifier, ctx: ExpressionContext): ResolvedType {
    // Check local variables first
    const local = ctx.locals.get(expr.name);
    if (local) return local;
    
    // Check symbol table
    const symbol = this.symbolTable.lookup(expr.name);
    if (symbol) return symbol.type;
    
    this.diagnostics.push(undefinedVariableError(expr.name, expr.location));
    return UNKNOWN_TYPE;
  }

  private inferQualifiedName(expr: QualifiedName, ctx: ExpressionContext): ResolvedType {
    const parts = expr.parts.map(p => p.name);
    const symbol = this.symbolTable.lookupQualified(parts);
    
    if (symbol) return symbol.type;
    
    // Try to resolve incrementally
    if (parts.length > 0) {
      let currentType = this.inferIdentifier(expr.parts[0], ctx);
      
      for (let i = 1; i < parts.length; i++) {
        if (currentType.kind === 'entity' || currentType.kind === 'struct') {
          const fieldType = currentType.fields.get(parts[i]);
          if (fieldType) {
            currentType = fieldType;
          } else {
            this.diagnostics.push(undefinedFieldError(
              parts[i],
              typeToString(currentType),
              expr.parts[i].location
            ));
            return UNKNOWN_TYPE;
          }
        } else if (currentType.kind === 'enum') {
          // Enum variant access
          if (currentType.variants.includes(parts[i])) {
            return currentType;
          } else {
            this.diagnostics.push(undefinedFieldError(
              parts[i],
              currentType.name,
              expr.parts[i].location
            ));
            return UNKNOWN_TYPE;
          }
        } else {
          this.diagnostics.push(undefinedFieldError(
            parts[i],
            typeToString(currentType),
            expr.parts[i].location
          ));
          return UNKNOWN_TYPE;
        }
      }
      
      return currentType;
    }
    
    return UNKNOWN_TYPE;
  }

  private inferNumber(expr: NumberLiteral): ResolvedType {
    return expr.isFloat ? DECIMAL_TYPE : INT_TYPE;
  }

  private inferBinary(expr: BinaryExpr, ctx: ExpressionContext): ResolvedType {
    const leftType = this.infer(expr.left, ctx);
    const rightType = this.infer(expr.right, ctx);
    
    switch (expr.operator) {
      // Comparison operators -> Boolean
      case '==':
      case '!=':
        // Types should be compatible
        if (!this.areComparable(leftType, rightType)) {
          this.diagnostics.push(incompatibleTypesError(
            typeToString(leftType),
            typeToString(rightType),
            expr.operator,
            expr.location
          ));
        }
        return BOOLEAN_TYPE;
      
      case '<':
      case '>':
      case '<=':
      case '>=':
        // Must be numeric or comparable types
        if (!this.isOrdered(leftType) || !this.isOrdered(rightType)) {
          this.diagnostics.push(incompatibleTypesError(
            typeToString(leftType),
            typeToString(rightType),
            expr.operator,
            expr.location
          ));
        }
        return BOOLEAN_TYPE;
      
      // Logical operators -> Boolean
      case 'and':
      case 'or':
        if (!this.isBoolean(leftType)) {
          this.diagnostics.push(typeMismatchError('Boolean', typeToString(leftType), expr.left.location));
        }
        if (!this.isBoolean(rightType)) {
          this.diagnostics.push(typeMismatchError('Boolean', typeToString(rightType), expr.right.location));
        }
        return BOOLEAN_TYPE;
      
      case 'implies':
      case 'iff':
        if (!this.isBoolean(leftType)) {
          this.diagnostics.push(typeMismatchError('Boolean', typeToString(leftType), expr.left.location));
        }
        if (!this.isBoolean(rightType)) {
          this.diagnostics.push(typeMismatchError('Boolean', typeToString(rightType), expr.right.location));
        }
        return BOOLEAN_TYPE;
      
      // Arithmetic operators
      case '+':
        // String concatenation or numeric addition
        if (this.isString(leftType) && this.isString(rightType)) {
          return STRING_TYPE;
        }
        if (this.isNumeric(leftType) && this.isNumeric(rightType)) {
          return this.numericResult(leftType, rightType);
        }
        // Duration arithmetic
        if (this.isDuration(leftType) && this.isDuration(rightType)) {
          return DURATION_TYPE;
        }
        if (this.isTimestamp(leftType) && this.isDuration(rightType)) {
          return TIMESTAMP_TYPE;
        }
        this.diagnostics.push(incompatibleTypesError(
          typeToString(leftType),
          typeToString(rightType),
          expr.operator,
          expr.location
        ));
        return UNKNOWN_TYPE;
      
      case '-':
        if (this.isNumeric(leftType) && this.isNumeric(rightType)) {
          return this.numericResult(leftType, rightType);
        }
        if (this.isTimestamp(leftType) && this.isDuration(rightType)) {
          return TIMESTAMP_TYPE;
        }
        if (this.isTimestamp(leftType) && this.isTimestamp(rightType)) {
          return DURATION_TYPE;
        }
        this.diagnostics.push(incompatibleTypesError(
          typeToString(leftType),
          typeToString(rightType),
          expr.operator,
          expr.location
        ));
        return UNKNOWN_TYPE;
      
      case '*':
      case '/':
      case '%':
        if (this.isNumeric(leftType) && this.isNumeric(rightType)) {
          return this.numericResult(leftType, rightType);
        }
        this.diagnostics.push(incompatibleTypesError(
          typeToString(leftType),
          typeToString(rightType),
          expr.operator,
          expr.location
        ));
        return UNKNOWN_TYPE;
      
      // Membership operator
      case 'in':
        // Right side should be a list or collection
        if (rightType.kind !== 'list') {
          this.diagnostics.push(typeMismatchError('List', typeToString(rightType), expr.right.location));
        }
        return BOOLEAN_TYPE;
      
      default:
        return UNKNOWN_TYPE;
    }
  }

  private inferUnary(expr: UnaryExpr, ctx: ExpressionContext): ResolvedType {
    const operandType = this.infer(expr.operand, ctx);
    
    switch (expr.operator) {
      case 'not':
        if (!this.isBoolean(operandType)) {
          this.diagnostics.push(invalidOperatorError('not', typeToString(operandType), expr.location));
        }
        return BOOLEAN_TYPE;
      
      case '-':
        if (!this.isNumeric(operandType)) {
          this.diagnostics.push(invalidOperatorError('-', typeToString(operandType), expr.location));
        }
        return operandType;
      
      default:
        return UNKNOWN_TYPE;
    }
  }

  private inferCall(expr: CallExpr, ctx: ExpressionContext): ResolvedType {
    const calleeType = this.infer(expr.callee, ctx);
    
    // Handle built-in methods
    if (expr.callee.kind === 'MemberExpr') {
      const member = expr.callee as MemberExpr;
      const objType = this.infer(member.object, ctx);
      const methodName = member.property.name;
      
      return this.inferMethodCall(objType, methodName, expr.arguments, ctx, expr.location);
    }
    
    // Handle identifier calls (built-in functions)
    if (expr.callee.kind === 'Identifier') {
      const funcName = (expr.callee as Identifier).name;
      return this.inferBuiltinCall(funcName, expr.arguments, ctx, expr.location);
    }
    
    // Function type call
    if (calleeType.kind === 'function') {
      return calleeType.returns;
    }
    
    return UNKNOWN_TYPE;
  }

  private inferMethodCall(
    objType: ResolvedType,
    methodName: string,
    args: Expression[],
    ctx: ExpressionContext,
    location: SourceLocation
  ): ResolvedType {
    // Entity methods
    if (objType.kind === 'entity') {
      switch (methodName) {
        case 'lookup':
          // Returns Optional<Entity>
          return { kind: 'optional', inner: objType };
        case 'exists':
          return BOOLEAN_TYPE;
        case 'create':
        case 'update':
        case 'delete':
          return VOID_TYPE;
      }
    }
    
    // List methods
    if (objType.kind === 'list') {
      switch (methodName) {
        case 'length':
        case 'count':
        case 'size':
          return INT_TYPE;
        case 'isEmpty':
        case 'isNotEmpty':
        case 'contains':
        case 'includes':
          return BOOLEAN_TYPE;
        case 'first':
        case 'last':
          return { kind: 'optional', inner: objType.element };
        case 'filter':
        case 'map':
          return objType;
        case 'sum':
        case 'avg':
        case 'min':
        case 'max':
          return objType.element;
        case 'push':
        case 'add':
          return VOID_TYPE;
      }
    }
    
    // String methods
    if (objType.kind === 'primitive' && objType.name === 'String') {
      switch (methodName) {
        case 'length':
          return INT_TYPE;
        case 'isEmpty':
        case 'isNotEmpty':
        case 'startsWith':
        case 'endsWith':
        case 'contains':
        case 'matches':
          return BOOLEAN_TYPE;
        case 'toLowerCase':
        case 'toUpperCase':
        case 'trim':
        case 'substring':
          return STRING_TYPE;
        case 'split':
          return { kind: 'list', element: STRING_TYPE };
      }
    }
    
    // Map methods
    if (objType.kind === 'map') {
      switch (methodName) {
        case 'get':
          return { kind: 'optional', inner: objType.value };
        case 'has':
        case 'containsKey':
          return BOOLEAN_TYPE;
        case 'keys':
          return { kind: 'list', element: objType.key };
        case 'values':
          return { kind: 'list', element: objType.value };
        case 'size':
          return INT_TYPE;
      }
    }
    
    // Optional methods
    if (objType.kind === 'optional') {
      switch (methodName) {
        case 'isDefined':
        case 'isEmpty':
          return BOOLEAN_TYPE;
        case 'get':
        case 'getOrElse':
          return objType.inner;
      }
    }
    
    return UNKNOWN_TYPE;
  }

  private inferBuiltinCall(
    funcName: string,
    args: Expression[],
    ctx: ExpressionContext,
    location: SourceLocation
  ): ResolvedType {
    switch (funcName) {
      case 'abs':
      case 'floor':
      case 'ceil':
      case 'round':
        return args.length > 0 ? this.infer(args[0], ctx) : INT_TYPE;
      
      case 'min':
      case 'max':
        return args.length > 0 ? this.infer(args[0], ctx) : UNKNOWN_TYPE;
      
      case 'now':
        return TIMESTAMP_TYPE;
      
      case 'uuid':
        return UUID_TYPE;
      
      case 'len':
      case 'length':
        return INT_TYPE;
      
      case 'toString':
        return STRING_TYPE;
      
      case 'parseInt':
        return INT_TYPE;
      
      case 'parseDecimal':
        return DECIMAL_TYPE;
      
      case 'isValid':
      case 'isNull':
      case 'isNotNull':
        return BOOLEAN_TYPE;
      
      default:
        return UNKNOWN_TYPE;
    }
  }

  private inferMember(expr: MemberExpr, ctx: ExpressionContext): ResolvedType {
    const objType = this.infer(expr.object, ctx);
    const propName = expr.property.name;
    
    // Entity/struct field access
    if (objType.kind === 'entity' || objType.kind === 'struct') {
      const fieldType = objType.fields.get(propName);
      if (fieldType) return fieldType;
      
      this.diagnostics.push(undefinedFieldError(
        propName,
        objType.kind === 'entity' ? objType.name : 'struct',
        expr.property.location
      ));
      return UNKNOWN_TYPE;
    }
    
    // Enum variant access
    if (objType.kind === 'enum') {
      if (objType.variants.includes(propName)) {
        return objType;
      }
      this.diagnostics.push(undefinedFieldError(propName, objType.name, expr.property.location));
      return UNKNOWN_TYPE;
    }
    
    // Optional unwrap
    if (objType.kind === 'optional') {
      // Allow field access through optional (returns optional field type)
      const innerType = objType.inner;
      if (innerType.kind === 'entity' || innerType.kind === 'struct') {
        const fieldType = innerType.fields.get(propName);
        if (fieldType) return { kind: 'optional', inner: fieldType };
      }
    }
    
    return UNKNOWN_TYPE;
  }

  private inferIndex(expr: IndexExpr, ctx: ExpressionContext): ResolvedType {
    const objType = this.infer(expr.object, ctx);
    const indexType = this.infer(expr.index, ctx);
    
    // List index
    if (objType.kind === 'list') {
      if (!this.isInt(indexType)) {
        this.diagnostics.push(typeMismatchError('Int', typeToString(indexType), expr.index.location));
      }
      return objType.element;
    }
    
    // Map index
    if (objType.kind === 'map') {
      if (!isAssignableTo(indexType, objType.key)) {
        this.diagnostics.push(typeMismatchError(
          typeToString(objType.key),
          typeToString(indexType),
          expr.index.location
        ));
      }
      return { kind: 'optional', inner: objType.value };
    }
    
    // String index
    if (objType.kind === 'primitive' && objType.name === 'String') {
      if (!this.isInt(indexType)) {
        this.diagnostics.push(typeMismatchError('Int', typeToString(indexType), expr.index.location));
      }
      return STRING_TYPE;
    }
    
    return UNKNOWN_TYPE;
  }

  private inferQuantifier(expr: QuantifierExpr, ctx: ExpressionContext): ResolvedType {
    const collType = this.infer(expr.collection, ctx);
    
    // Get the element type
    let elementType: ResolvedType = UNKNOWN_TYPE;
    if (collType.kind === 'list') {
      elementType = collType.element;
    } else if (collType.kind === 'map') {
      // For maps, iterate over values
      elementType = collType.value;
    }
    
    // Create a new context with the quantifier variable
    const newCtx: ExpressionContext = {
      ...ctx,
      locals: new Map(ctx.locals),
    };
    newCtx.locals.set(expr.variable.name, elementType);
    
    // Infer predicate type
    const predType = this.infer(expr.predicate, newCtx);
    
    switch (expr.quantifier) {
      case 'all':
      case 'any':
      case 'none':
        // Predicate should be Boolean, result is Boolean
        if (!this.isBoolean(predType)) {
          this.diagnostics.push(typeMismatchError('Boolean', typeToString(predType), expr.predicate.location));
        }
        return BOOLEAN_TYPE;
      
      case 'count':
        return INT_TYPE;
      
      case 'sum':
        // Predicate should be numeric
        if (!this.isNumeric(predType)) {
          this.diagnostics.push(typeMismatchError('Int or Decimal', typeToString(predType), expr.predicate.location));
        }
        return predType;
      
      case 'filter':
        // Predicate should be Boolean, result is same collection type
        if (!this.isBoolean(predType)) {
          this.diagnostics.push(typeMismatchError('Boolean', typeToString(predType), expr.predicate.location));
        }
        return collType;
      
      default:
        return UNKNOWN_TYPE;
    }
  }

  private inferConditional(expr: ConditionalExpr, ctx: ExpressionContext): ResolvedType {
    const condType = this.infer(expr.condition, ctx);
    const thenType = this.infer(expr.thenBranch, ctx);
    const elseType = this.infer(expr.elseBranch, ctx);
    
    if (!this.isBoolean(condType)) {
      this.diagnostics.push(typeMismatchError('Boolean', typeToString(condType), expr.condition.location));
    }
    
    // Return the common type
    if (isAssignableTo(thenType, elseType)) return elseType;
    if (isAssignableTo(elseType, thenType)) return thenType;
    
    // Union type if incompatible
    return { kind: 'union', variants: new Map([['then', thenType], ['else', elseType]]) };
  }

  private inferOld(expr: OldExpr, ctx: ExpressionContext): ResolvedType {
    if (!ctx.inPostcondition) {
      this.diagnostics.push(oldOutsidePostconditionError(expr.location));
    }
    return this.infer(expr.expression, ctx);
  }

  private inferResult(expr: ResultExpr, ctx: ExpressionContext): ResolvedType {
    if (!ctx.inPostcondition) {
      this.diagnostics.push(resultOutsidePostconditionError(expr.location));
      return UNKNOWN_TYPE;
    }
    
    if (!ctx.outputType) return UNKNOWN_TYPE;
    
    // If accessing a property of result
    if (expr.property) {
      if (ctx.outputType.kind === 'struct' || ctx.outputType.kind === 'entity') {
        const fieldType = ctx.outputType.fields.get(expr.property.name);
        if (fieldType) return fieldType;
        this.diagnostics.push(undefinedFieldError(
          expr.property.name,
          typeToString(ctx.outputType),
          expr.property.location
        ));
      }
      return UNKNOWN_TYPE;
    }
    
    return ctx.outputType;
  }

  private inferInput(expr: InputExpr, ctx: ExpressionContext): ResolvedType {
    if (!ctx.currentBehavior) {
      return UNKNOWN_TYPE;
    }
    
    const fieldType = ctx.currentBehavior.inputFields.get(expr.property.name);
    if (fieldType) return fieldType;
    
    this.diagnostics.push(inputInvalidFieldError(
      expr.property.name,
      ctx.currentBehavior.name,
      expr.property.location
    ));
    return UNKNOWN_TYPE;
  }

  private inferLambda(expr: LambdaExpr, ctx: ExpressionContext): ResolvedType {
    // Create new context with lambda parameters
    const newCtx: ExpressionContext = {
      ...ctx,
      locals: new Map(ctx.locals),
    };
    
    for (const param of expr.params) {
      newCtx.locals.set(param.name, UNKNOWN_TYPE);
    }
    
    const bodyType = this.infer(expr.body, newCtx);
    
    return {
      kind: 'function',
      params: expr.params.map(() => UNKNOWN_TYPE),
      returns: bodyType,
    };
  }

  private inferList(expr: ListExpr, ctx: ExpressionContext): ResolvedType {
    if (expr.elements.length === 0) {
      return { kind: 'list', element: UNKNOWN_TYPE };
    }
    
    const elementType = this.infer(expr.elements[0], ctx);
    
    // Check all elements have compatible types
    for (let i = 1; i < expr.elements.length; i++) {
      const elemType = this.infer(expr.elements[i], ctx);
      if (!isAssignableTo(elemType, elementType)) {
        this.diagnostics.push(typeMismatchError(
          typeToString(elementType),
          typeToString(elemType),
          expr.elements[i].location
        ));
      }
    }
    
    return { kind: 'list', element: elementType };
  }

  private inferMap(expr: MapExpr, ctx: ExpressionContext): ResolvedType {
    if (expr.entries.length === 0) {
      return { kind: 'map', key: UNKNOWN_TYPE, value: UNKNOWN_TYPE };
    }
    
    const keyType = this.infer(expr.entries[0].key, ctx);
    const valueType = this.infer(expr.entries[0].value, ctx);
    
    return { kind: 'map', key: keyType, value: valueType };
  }

  // ============================================================================
  // Type predicates
  // ============================================================================

  private isBoolean(type: ResolvedType): boolean {
    return type.kind === 'primitive' && type.name === 'Boolean';
  }

  private isString(type: ResolvedType): boolean {
    return type.kind === 'primitive' && type.name === 'String';
  }

  private isInt(type: ResolvedType): boolean {
    return type.kind === 'primitive' && type.name === 'Int';
  }

  private isNumeric(type: ResolvedType): boolean {
    return type.kind === 'primitive' && (type.name === 'Int' || type.name === 'Decimal');
  }

  private isDuration(type: ResolvedType): boolean {
    return type.kind === 'primitive' && type.name === 'Duration';
  }

  private isTimestamp(type: ResolvedType): boolean {
    return type.kind === 'primitive' && type.name === 'Timestamp';
  }

  private isOrdered(type: ResolvedType): boolean {
    return this.isNumeric(type) || this.isTimestamp(type) || this.isDuration(type) || this.isString(type);
  }

  private areComparable(a: ResolvedType, b: ResolvedType): boolean {
    // Unknown types are always comparable (to avoid cascading errors)
    if (a.kind === 'unknown' || b.kind === 'unknown') return true;
    if (a.kind === 'error' || b.kind === 'error') return true;
    
    // Same kind is comparable
    if (a.kind === b.kind) {
      if (a.kind === 'primitive') {
        return a.name === (b as typeof a).name || 
               (this.isNumeric(a) && this.isNumeric(b));
      }
      return true;
    }
    
    // Optional and its inner type
    if (a.kind === 'optional') return this.areComparable(a.inner, b);
    if (b.kind === 'optional') return this.areComparable(a, b.inner);
    
    return false;
  }

  private numericResult(a: ResolvedType, b: ResolvedType): ResolvedType {
    // If either is Decimal, result is Decimal
    if ((a.kind === 'primitive' && a.name === 'Decimal') ||
        (b.kind === 'primitive' && b.name === 'Decimal')) {
      return DECIMAL_TYPE;
    }
    return INT_TYPE;
  }
}
