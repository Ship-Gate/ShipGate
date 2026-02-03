// ============================================================================
// Input Generator - Generate random inputs satisfying ISL preconditions
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  PRNG,
  Generator,
  BehaviorProperties,
  InputFieldSpec,
  PBTConfig,
} from './types.js';
import {
  createPRNG,
  BaseGenerator,
  string,
  integer,
  float,
  boolean,
  email,
  password,
  uuid,
  timestamp,
  ipAddress,
  array,
  fromEnum,
  optional,
  record,
  fromConstraints,
} from './random.js';

// ============================================================================
// INPUT GENERATOR
// ============================================================================

/**
 * Create a generator for behavior inputs that satisfy preconditions
 */
export function createInputGenerator(
  properties: BehaviorProperties,
  config: Partial<PBTConfig> = {}
): Generator<Record<string, unknown>> {
  const { maxFilterAttempts = 1000, filterPreconditions = true } = config;
  
  // Create generators for each field
  const fieldGenerators: Record<string, Generator<unknown>> = {};
  
  for (const field of properties.inputSpec) {
    fieldGenerators[field.name] = createFieldGenerator(field, properties.domain);
  }
  
  // Create record generator
  const baseGenerator = record(fieldGenerators as any);
  
  // Optionally filter by preconditions
  if (filterPreconditions && properties.preconditions.length > 0) {
    return new FilteredGenerator(
      baseGenerator,
      (input) => checkPreconditions(input, properties),
      maxFilterAttempts
    );
  }
  
  return baseGenerator as Generator<Record<string, unknown>>;
}

/**
 * Create a generator for a single field
 */
function createFieldGenerator(
  field: InputFieldSpec,
  domain: AST.Domain
): Generator<unknown> {
  const baseGen = createTypeGenerator(field.type, domain);
  
  if (field.optional) {
    return optional(baseGen);
  }
  
  return baseGen;
}

/**
 * Create a generator for a type definition
 */
function createTypeGenerator(
  type: AST.TypeDefinition,
  domain: AST.Domain
): Generator<unknown> {
  switch (type.kind) {
    case 'PrimitiveType':
      return createPrimitiveGenerator(type.name);
    
    case 'ConstrainedType':
      return createConstrainedGenerator(type, domain);
    
    case 'ReferenceType':
      return createReferenceGenerator(type, domain);
    
    case 'EnumType':
      return fromEnum(type.variants.map((v) => v.name.name));
    
    case 'ListType':
      const elementGen = createTypeGenerator(type.element, domain);
      return array(elementGen, { minLength: 0, maxLength: 10 });
    
    case 'StructType':
      const fields: Record<string, Generator<unknown>> = {};
      for (const field of type.fields) {
        if (!field.optional) {
          fields[field.name.name] = createTypeGenerator(field.type, domain);
        }
      }
      return record(fields);
    
    case 'OptionalType':
      return optional(createTypeGenerator(type.inner, domain));
    
    case 'UnionType':
      // Generate first variant
      const firstVariant = type.variants[0];
      if (firstVariant) {
        const variantFields: Record<string, Generator<unknown>> = {
          __variant__: new BaseGenerator(() => firstVariant.name.name, () => []),
        };
        for (const field of firstVariant.fields) {
          if (!field.optional) {
            variantFields[field.name.name] = createTypeGenerator(field.type, domain);
          }
        }
        return record(variantFields);
      }
      return new BaseGenerator(() => null, () => []);
    
    default:
      // Default to string
      return string();
  }
}

/**
 * Create generator for primitive types
 */
function createPrimitiveGenerator(name: string): Generator<unknown> {
  switch (name.toLowerCase()) {
    case 'string':
      return string({ minLength: 1, maxLength: 50 });
    case 'int':
    case 'integer':
      return integer(-1000, 1000);
    case 'decimal':
    case 'float':
    case 'number':
      return float(-1000, 1000);
    case 'boolean':
    case 'bool':
      return boolean();
    case 'uuid':
      return uuid();
    case 'timestamp':
      return timestamp();
    case 'email':
      return email();
    default:
      return string();
  }
}

/**
 * Create generator for constrained types
 */
function createConstrainedGenerator(
  type: AST.ConstrainedType,
  domain: AST.Domain
): Generator<unknown> {
  // Extract constraints
  let min: number | undefined;
  let max: number | undefined;
  let minLength: number | undefined;
  let maxLength: number | undefined;
  let format: string | undefined;
  
  for (const constraint of type.constraints) {
    const value = extractValue(constraint.value);
    switch (constraint.name.toLowerCase()) {
      case 'min':
        min = value as number;
        break;
      case 'max':
        max = value as number;
        break;
      case 'min_length':
      case 'minlength':
        minLength = value as number;
        break;
      case 'max_length':
      case 'maxlength':
        maxLength = value as number;
        break;
      case 'format':
        format = value as string;
        break;
    }
  }
  
  // Get base type name
  const baseName = getTypeName(type.base, domain);
  
  // Handle special formats
  if (format === 'email' || baseName.toLowerCase() === 'email') {
    return email();
  }
  
  // Create generator based on base type
  switch (baseName.toLowerCase()) {
    case 'string':
      return string({ minLength: minLength ?? 0, maxLength: maxLength ?? 100 });
    case 'int':
    case 'integer':
      return integer(min ?? -1000, max ?? 1000);
    case 'decimal':
    case 'float':
      return float(min ?? -1000, max ?? 1000);
    default:
      return createTypeGenerator(type.base, domain);
  }
}

/**
 * Create generator for reference types
 */
function createReferenceGenerator(
  type: AST.ReferenceType,
  domain: AST.Domain
): Generator<unknown> {
  const refName = type.name.parts.map((p) => p.name).join('.');
  
  // Look up type definition
  const typeDef = domain.types.find((t) => t.name.name === refName);
  if (typeDef) {
    return createTypeGenerator(typeDef.definition, domain);
  }
  
  // Check for well-known types
  switch (refName.toLowerCase()) {
    case 'email':
      return email();
    case 'password':
      return password();
    case 'uuid':
      return uuid();
    case 'timestamp':
      return timestamp();
    case 'ip':
    case 'ip_address':
      return ipAddress();
    default:
      // Entity reference - generate UUID
      const entity = domain.entities.find((e) => e.name.name === refName);
      if (entity) {
        return uuid();
      }
      return string();
  }
}

/**
 * Get type name from type definition
 */
function getTypeName(type: AST.TypeDefinition, domain: AST.Domain): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return type.name;
    case 'ReferenceType':
      return type.name.parts.map((p) => p.name).join('.');
    case 'ConstrainedType':
      return getTypeName(type.base, domain);
    default:
      return 'unknown';
  }
}

/**
 * Extract value from expression
 */
function extractValue(expr: AST.Expression): unknown {
  switch (expr.kind) {
    case 'NumberLiteral':
      return expr.value;
    case 'StringLiteral':
      return expr.value;
    case 'BooleanLiteral':
      return expr.value;
    default:
      return undefined;
  }
}

// ============================================================================
// PRECONDITION CHECKING
// ============================================================================

/**
 * Check if input satisfies all preconditions
 * Simple evaluation without full expression evaluator
 */
function checkPreconditions(
  input: Record<string, unknown>,
  properties: BehaviorProperties
): boolean {
  for (const pre of properties.preconditions) {
    if (!evaluateSimpleCondition(pre.expression, input, properties.domain)) {
      return false;
    }
  }
  return true;
}

/**
 * Simple expression evaluator for preconditions
 * Handles common patterns without full evaluation
 */
function evaluateSimpleCondition(
  expr: AST.Expression,
  input: Record<string, unknown>,
  domain: AST.Domain
): boolean {
  switch (expr.kind) {
    case 'BooleanLiteral':
      return expr.value;
    
    case 'Identifier':
      // Check if it's an input field
      if (expr.name in input) {
        return input[expr.name] !== null && input[expr.name] !== undefined;
      }
      return true;
    
    case 'MemberExpr': {
      // Handle input.field patterns
      const value = extractMemberValue(expr, input);
      if (value === undefined) return false;
      
      // Handle .is_valid_format, .is_valid, etc.
      if (expr.property.name === 'is_valid_format' || expr.property.name === 'is_valid') {
        const objValue = extractMemberValue(expr.object as AST.MemberExpr, input) ?? 
                         extractIdentifierValue(expr.object, input);
        return isValidFormat(objValue, expr.object);
      }
      
      // Handle .length
      if (expr.property.name === 'length') {
        return true; // Just check that we can access it
      }
      
      return value !== null && value !== undefined;
    }
    
    case 'BinaryExpr': {
      const left = evaluateValue(expr.left, input);
      const right = evaluateValue(expr.right, input);
      
      switch (expr.operator) {
        case '==':
          return left === right;
        case '!=':
          return left !== right;
        case '<':
          return typeof left === 'number' && typeof right === 'number' && left < right;
        case '<=':
          return typeof left === 'number' && typeof right === 'number' && left <= right;
        case '>':
          return typeof left === 'number' && typeof right === 'number' && left > right;
        case '>=':
          return typeof left === 'number' && typeof right === 'number' && left >= right;
        case 'and':
          return evaluateSimpleCondition(expr.left, input, domain) &&
                 evaluateSimpleCondition(expr.right, input, domain);
        case 'or':
          return evaluateSimpleCondition(expr.left, input, domain) ||
                 evaluateSimpleCondition(expr.right, input, domain);
        default:
          return true;
      }
    }
    
    case 'UnaryExpr':
      if (expr.operator === 'not') {
        return !evaluateSimpleCondition(expr.operand, input, domain);
      }
      return true;
    
    case 'CallExpr':
      // Assume function calls pass (would need domain-specific evaluation)
      return true;
    
    default:
      return true;
  }
}

/**
 * Extract value from identifier
 */
function extractIdentifierValue(expr: AST.Expression, input: Record<string, unknown>): unknown {
  if (expr.kind === 'Identifier') {
    return input[expr.name];
  }
  return undefined;
}

/**
 * Extract value from member expression
 */
function extractMemberValue(expr: AST.Expression, input: Record<string, unknown>): unknown {
  if (expr.kind === 'MemberExpr') {
    const obj = extractMemberValue(expr.object, input) ??
                extractIdentifierValue(expr.object, input);
    if (obj && typeof obj === 'object') {
      return (obj as Record<string, unknown>)[expr.property.name];
    }
    // Handle input.field
    if (expr.object.kind === 'Identifier') {
      const objName = (expr.object as AST.Identifier).name;
      if (objName === 'input') {
        return input[expr.property.name];
      }
      return input[objName];
    }
  }
  if (expr.kind === 'Identifier') {
    return input[(expr as AST.Identifier).name];
  }
  return undefined;
}

/**
 * Evaluate expression to a value
 */
function evaluateValue(expr: AST.Expression, input: Record<string, unknown>): unknown {
  switch (expr.kind) {
    case 'NumberLiteral':
      return expr.value;
    case 'StringLiteral':
      return expr.value;
    case 'BooleanLiteral':
      return expr.value;
    case 'NullLiteral':
      return null;
    case 'Identifier':
      return input[expr.name];
    case 'MemberExpr': {
      // Handle special properties
      if (expr.property.name === 'length') {
        const obj = extractMemberValue(expr.object, input) ??
                    extractIdentifierValue(expr.object, input);
        if (typeof obj === 'string') return obj.length;
        if (Array.isArray(obj)) return obj.length;
        return undefined;
      }
      return extractMemberValue(expr, input);
    }
    default:
      return undefined;
  }
}

/**
 * Check if value is valid format
 */
function isValidFormat(value: unknown, expr: AST.Expression): boolean {
  if (typeof value !== 'string') return false;
  
  // Try to infer format from expression
  const exprStr = expr.kind === 'Identifier' ? (expr as AST.Identifier).name : '';
  
  if (exprStr.includes('email') || exprStr === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  
  return value.length > 0;
}

// ============================================================================
// FILTERED GENERATOR
// ============================================================================

/**
 * Generator that filters values based on a predicate
 */
class FilteredGenerator implements Generator<Record<string, unknown>> {
  constructor(
    private readonly base: Generator<Record<string, unknown>>,
    private readonly predicate: (value: Record<string, unknown>) => boolean,
    private readonly maxAttempts: number
  ) {}
  
  generate(prng: PRNG, size: number): Record<string, unknown> {
    for (let i = 0; i < this.maxAttempts; i++) {
      const value = this.base.generate(prng.fork(), size);
      if (this.predicate(value)) {
        return value;
      }
    }
    
    // Fallback: return last generated value
    // In a real implementation, might throw or use a different strategy
    return this.base.generate(prng, size);
  }
  
  *shrink(value: Record<string, unknown>): Iterable<Record<string, unknown>> {
    for (const shrunk of this.base.shrink(value)) {
      if (this.predicate(shrunk)) {
        yield shrunk;
      }
    }
  }
  
  map<U>(fn: (value: Record<string, unknown>) => U): Generator<U> {
    return new BaseGenerator(
      (prng, size) => fn(this.generate(prng, size)),
      () => []
    );
  }
  
  filter(predicate: (value: Record<string, unknown>) => boolean): Generator<Record<string, unknown>> {
    return new FilteredGenerator(
      this,
      (v) => this.predicate(v) && predicate(v),
      this.maxAttempts
    );
  }
  
  flatMap<U>(fn: (value: Record<string, unknown>) => Generator<U>): Generator<U> {
    return new BaseGenerator(
      (prng, size) => {
        const intermediate = this.generate(prng.fork(), size);
        return fn(intermediate).generate(prng.fork(), size);
      },
      () => []
    );
  }
}
