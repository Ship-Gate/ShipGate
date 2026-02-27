// ============================================================================
// Semantic Fuzzing Generator
// Domain-aware fuzzing based on ISL specifications
// ============================================================================

import { FuzzContext, GeneratedValue, ISLTypeInfo, ISLBehaviorInfo } from '../types.js';
import { generateStrings } from './string.js';
import { generateIntegers, generateFloats } from './number.js';

/**
 * Generate values based on ISL type information
 */
export function* generateForType(
  typeInfo: ISLTypeInfo,
  ctx: FuzzContext
): Generator<GeneratedValue<unknown>> {
  switch (typeInfo.kind) {
    case 'PrimitiveType':
      yield* generateForPrimitive(typeInfo.name ?? 'String', ctx);
      break;
    
    case 'ConstrainedType':
      yield* generateForConstrained(typeInfo, ctx);
      break;
    
    case 'EnumType':
      yield* generateForEnum(typeInfo.variants ?? [], ctx);
      break;
    
    case 'ListType':
      yield* generateForList(typeInfo.element!, ctx);
      break;
    
    case 'MapType':
      yield* generateForMap(typeInfo.key!, typeInfo.value!, ctx);
      break;
    
    case 'OptionalType':
      yield* generateForOptional(typeInfo.inner!, ctx);
      break;
    
    case 'ReferenceType':
      yield* generateForReference(typeInfo.referenceName ?? 'Unknown', ctx);
      break;
    
    default:
      yield { value: null, category: 'unknown', description: 'Unknown type' };
  }
}

/**
 * Generate values for primitive types
 */
function* generateForPrimitive(
  typeName: string,
  ctx: FuzzContext
): Generator<GeneratedValue<unknown>> {
  switch (typeName) {
    case 'String':
      yield* generateStrings(ctx) as Generator<GeneratedValue<unknown>>;
      break;
    
    case 'Int':
      yield* generateIntegers(ctx) as Generator<GeneratedValue<unknown>>;
      break;
    
    case 'Decimal':
      yield* generateFloats(ctx) as Generator<GeneratedValue<unknown>>;
      break;
    
    case 'Boolean':
      yield { value: true, category: 'boundary', description: 'Boolean true' };
      yield { value: false, category: 'boundary', description: 'Boolean false' };
      yield { value: null, category: 'boundary', description: 'Boolean null' };
      yield { value: undefined, category: 'boundary', description: 'Boolean undefined' };
      yield { value: 0, category: 'type-coercion', description: 'Falsy number' };
      yield { value: 1, category: 'type-coercion', description: 'Truthy number' };
      yield { value: '', category: 'type-coercion', description: 'Falsy string' };
      yield { value: 'true', category: 'type-coercion', description: 'String "true"' };
      yield { value: 'false', category: 'type-coercion', description: 'String "false"' };
      break;
    
    case 'Timestamp':
      yield* generateTimestamps(ctx);
      break;
    
    case 'UUID':
      yield* generateUUIDs(ctx);
      break;
    
    case 'Duration':
      yield* generateDurations(ctx);
      break;
    
    default:
      yield { value: null, category: 'unknown', description: `Unknown primitive: ${typeName}` };
  }
}

/**
 * Generate timestamp edge cases
 */
function* generateTimestamps(_ctx: FuzzContext): Generator<GeneratedValue<unknown>> {
  // Standard dates
  yield { value: new Date(), category: 'valid', description: 'Current time' };
  yield { value: new Date(0), category: 'boundary', description: 'Unix epoch' };
  
  // Boundary dates
  yield { value: new Date('1970-01-01T00:00:00.000Z'), category: 'boundary', description: 'Epoch start' };
  yield { value: new Date('1969-12-31T23:59:59.999Z'), category: 'boundary', description: 'Before epoch' };
  yield { value: new Date('2038-01-19T03:14:07.000Z'), category: 'boundary', description: 'Y2K38 problem' };
  yield { value: new Date('2038-01-19T03:14:08.000Z'), category: 'boundary', description: 'After Y2K38' };
  yield { value: new Date('9999-12-31T23:59:59.999Z'), category: 'boundary', description: 'Far future' };
  yield { value: new Date('0001-01-01T00:00:00.000Z'), category: 'boundary', description: 'Year 1' };
  
  // Invalid dates
  yield { value: new Date('invalid'), category: 'invalid', description: 'Invalid date string' };
  yield { value: new Date(NaN), category: 'invalid', description: 'NaN date' };
  yield { value: new Date(Infinity), category: 'invalid', description: 'Infinity date' };
  yield { value: new Date(-Infinity), category: 'invalid', description: 'Negative infinity date' };
  
  // String representations
  yield { value: '2024-01-01', category: 'format', description: 'ISO date string' };
  yield { value: '2024-01-01T00:00:00Z', category: 'format', description: 'ISO datetime string' };
  yield { value: 'January 1, 2024', category: 'format', description: 'Locale date string' };
  yield { value: '01/01/2024', category: 'format', description: 'MM/DD/YYYY format' };
  yield { value: '2024/01/01', category: 'format', description: 'YYYY/MM/DD format' };
  
  // Numeric timestamps
  yield { value: 0, category: 'format', description: 'Numeric epoch' };
  yield { value: Date.now(), category: 'format', description: 'Current timestamp' };
  yield { value: -1, category: 'boundary', description: 'Negative timestamp' };
  yield { value: Number.MAX_SAFE_INTEGER, category: 'boundary', description: 'Max safe timestamp' };
}

/**
 * Generate UUID edge cases
 */
function* generateUUIDs(_ctx: FuzzContext): Generator<GeneratedValue<unknown>> {
  // Valid UUIDs
  yield { value: '00000000-0000-0000-0000-000000000000', category: 'boundary', description: 'Nil UUID' };
  yield { value: 'ffffffff-ffff-ffff-ffff-ffffffffffff', category: 'boundary', description: 'Max UUID' };
  yield { value: '123e4567-e89b-12d3-a456-426614174000', category: 'valid', description: 'Valid UUID v1' };
  yield { value: '550e8400-e29b-41d4-a716-446655440000', category: 'valid', description: 'Valid UUID v4' };
  
  // Invalid UUIDs
  yield { value: '', category: 'invalid', description: 'Empty UUID' };
  yield { value: 'not-a-uuid', category: 'invalid', description: 'Invalid UUID string' };
  yield { value: '123e4567-e89b-12d3-a456', category: 'invalid', description: 'Truncated UUID' };
  yield { value: '123e4567-e89b-12d3-a456-4266141740001', category: 'invalid', description: 'Too long UUID' };
  yield { value: '123e4567-e89b-12d3-a456-42661417400g', category: 'invalid', description: 'Invalid hex char' };
  yield { value: '123E4567-E89B-12D3-A456-426614174000', category: 'format', description: 'Uppercase UUID' };
  yield { value: '123e4567e89b12d3a456426614174000', category: 'format', description: 'UUID without dashes' };
  yield { value: '{123e4567-e89b-12d3-a456-426614174000}', category: 'format', description: 'UUID with braces' };
  
  // SQL injection via UUID
  yield { value: "'; DROP TABLE users; --", category: 'injection', description: 'SQL injection UUID' };
  yield { value: '00000000-0000-0000-0000-00000000000\x00', category: 'injection', description: 'UUID with null byte' };
}

/**
 * Generate duration edge cases
 */
function* generateDurations(_ctx: FuzzContext): Generator<GeneratedValue<unknown>> {
  // Boundary values
  yield { value: 0, category: 'boundary', description: 'Zero duration' };
  yield { value: 1, category: 'boundary', description: 'Minimum duration' };
  yield { value: -1, category: 'boundary', description: 'Negative duration' };
  yield { value: 1000, category: 'valid', description: '1 second' };
  yield { value: 60000, category: 'valid', description: '1 minute' };
  yield { value: 3600000, category: 'valid', description: '1 hour' };
  yield { value: 86400000, category: 'valid', description: '1 day' };
  
  // Large values
  yield { value: Number.MAX_SAFE_INTEGER, category: 'boundary', description: 'Max safe duration' };
  yield { value: Infinity, category: 'boundary', description: 'Infinite duration' };
  
  // String representations
  yield { value: '1s', category: 'format', description: 'Duration string' };
  yield { value: '1.5h', category: 'format', description: 'Fractional duration' };
  yield { value: 'PT1H30M', category: 'format', description: 'ISO 8601 duration' };
}

/**
 * Generate values for constrained types
 */
function* generateForConstrained(
  typeInfo: ISLTypeInfo,
  ctx: FuzzContext
): Generator<GeneratedValue<unknown>> {
  // Extract constraints
  const constraints = typeInfo.constraints ?? {};
  const baseType = typeInfo.baseType ?? 'String';
  
  // Create context with constraints
  const constrainedCtx: FuzzContext = {
    ...ctx,
    constraints,
    fieldType: baseType,
  };

  // Generate base type values with constraints
  yield* generateForPrimitive(baseType, constrainedCtx);
}

/**
 * Generate values for enum types
 */
function* generateForEnum(
  variants: string[],
  _ctx: FuzzContext
): Generator<GeneratedValue<unknown>> {
  // All valid variants
  for (const variant of variants) {
    yield { value: variant, category: 'valid', description: `Enum value: ${variant}` };
  }

  // Invalid values
  yield { value: '', category: 'invalid', description: 'Empty enum value' };
  yield { value: 'INVALID_VARIANT', category: 'invalid', description: 'Invalid variant' };
  yield { value: variants[0]?.toLowerCase() ?? 'lowercase', category: 'case', description: 'Lowercase variant' };
  yield { value: variants[0]?.toUpperCase() ?? 'UPPERCASE', category: 'case', description: 'Uppercase variant' };
  yield { value: null, category: 'invalid', description: 'Null enum' };
  yield { value: 0, category: 'type-coercion', description: 'Numeric enum value' };
  yield { value: true, category: 'type-coercion', description: 'Boolean enum value' };
  
  // Injection attempts
  yield { value: "'; DROP TABLE users; --", category: 'injection', description: 'SQL injection enum' };
}

/**
 * Generate values for list types
 */
function* generateForList(
  elementType: ISLTypeInfo,
  ctx: FuzzContext
): Generator<GeneratedValue<unknown>> {
  yield { value: [], category: 'boundary', description: 'Empty list' };
  yield { value: null, category: 'invalid', description: 'Null list' };
  yield { value: undefined, category: 'invalid', description: 'Undefined list' };
  yield { value: 'not-an-array', category: 'type-coercion', description: 'String instead of array' };
  yield { value: {}, category: 'type-coercion', description: 'Object instead of array' };
  
  // Generate list with fuzzed elements
  const elements: unknown[] = [];
  for (const elem of generateForType(elementType, { ...ctx, iterations: 5 })) {
    elements.push(elem.value);
    if (elements.length >= 5) break;
  }
  yield { value: elements, category: 'valid', description: 'List with valid elements' };
  
  // Mixed valid/invalid
  yield { value: [...elements, null], category: 'mixed', description: 'List with null' };
  yield { value: [...elements, undefined], category: 'mixed', description: 'List with undefined' };
  
  // Large list
  const largeList = Array(1000).fill(elements[0]);
  yield { value: largeList, category: 'stress', description: 'Large list (1000)' };
}

/**
 * Generate values for map types
 */
function* generateForMap(
  _keyType: ISLTypeInfo,
  valueType: ISLTypeInfo,
  ctx: FuzzContext
): Generator<GeneratedValue<unknown>> {
  yield { value: {}, category: 'boundary', description: 'Empty map' };
  yield { value: new Map(), category: 'boundary', description: 'Empty Map object' };
  yield { value: null, category: 'invalid', description: 'Null map' };
  yield { value: [], category: 'type-coercion', description: 'Array instead of map' };
  
  // Generate map entries
  const obj: Record<string, unknown> = {};
  let keyIdx = 0;
  for (const val of generateForType(valueType, { ...ctx, iterations: 5 })) {
    obj[`key${keyIdx++}`] = val.value;
    if (keyIdx >= 5) break;
  }
  yield { value: obj, category: 'valid', description: 'Map with entries' };
  
  // Prototype pollution
  yield { value: { __proto__: { admin: true } }, category: 'security', description: 'Prototype pollution' };
  yield { value: { constructor: { prototype: { admin: true } } }, category: 'security', description: 'Constructor pollution' };
}

/**
 * Generate values for optional types
 */
function* generateForOptional(
  innerType: ISLTypeInfo,
  ctx: FuzzContext
): Generator<GeneratedValue<unknown>> {
  yield { value: null, category: 'valid', description: 'Optional null' };
  yield { value: undefined, category: 'valid', description: 'Optional undefined' };
  
  // Inner type values
  yield* generateForType(innerType, ctx);
}

/**
 * Generate values for reference types
 */
function* generateForReference(
  referenceName: string,
  ctx: FuzzContext
): Generator<GeneratedValue<unknown>> {
  yield { value: null, category: 'boundary', description: `Null ${referenceName}` };
  yield { value: undefined, category: 'boundary', description: `Undefined ${referenceName}` };
  yield { value: {}, category: 'boundary', description: `Empty ${referenceName}` };
  
  // If we have type info for the reference, use it
  if (ctx.typeRegistry?.has(referenceName)) {
    const typeInfo = ctx.typeRegistry.get(referenceName)!;
    yield* generateForType(typeInfo, ctx);
  }
}

/**
 * Generate inputs for a behavior based on its input spec
 */
export function* generateBehaviorInputs(
  behavior: ISLBehaviorInfo,
  ctx: FuzzContext
): Generator<GeneratedValue<Record<string, unknown>>> {
  // Generate all valid combinations first
  yield { value: {}, category: 'boundary', description: 'Empty input' };
  
  // Generate individual field fuzz
  for (const field of behavior.inputFields) {
    const fieldCtx: FuzzContext = {
      ...ctx,
      fieldName: field.name,
      fieldType: field.type.kind,
      constraints: field.constraints,
    };
    
    for (const fuzzed of generateForType(field.type, fieldCtx)) {
      const input: Record<string, unknown> = {};
      input[field.name] = fuzzed.value;
      yield { 
        value: input, 
        category: fuzzed.category, 
        description: `${field.name}: ${fuzzed.description}` 
      };
    }
  }
  
  // Missing required fields
  for (const field of behavior.inputFields) {
    if (!field.optional) {
      const input: Record<string, unknown> = {};
      for (const other of behavior.inputFields) {
        if (other.name !== field.name) {
          input[other.name] = generateValidValue(other.type);
        }
      }
      yield { value: input, category: 'missing', description: `Missing ${field.name}` };
    }
  }
  
  // Extra unexpected fields
  const validInput = generateValidInput(behavior);
  yield { 
    value: { ...validInput, __extra__: 'unexpected' }, 
    category: 'extra', 
    description: 'Extra field' 
  };
  yield { 
    value: { ...validInput, __proto__: { admin: true } }, 
    category: 'security', 
    description: 'Prototype pollution in input' 
  };
}

/**
 * Generate a valid value for a type (for baseline)
 */
function generateValidValue(typeInfo: ISLTypeInfo): unknown {
  switch (typeInfo.kind) {
    case 'PrimitiveType':
      switch (typeInfo.name) {
        case 'String': return 'valid_string';
        case 'Int': return 42;
        case 'Decimal': return 3.14;
        case 'Boolean': return true;
        case 'Timestamp': return new Date().toISOString();
        case 'UUID': return '123e4567-e89b-12d3-a456-426614174000';
        case 'Duration': return 1000;
        default: return null;
      }
    case 'EnumType':
      return typeInfo.variants?.[0] ?? null;
    case 'ListType':
      return [];
    case 'MapType':
      return {};
    case 'OptionalType':
      return null;
    default:
      return null;
  }
}

/**
 * Generate a valid input object for a behavior
 */
function generateValidInput(behavior: ISLBehaviorInfo): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const field of behavior.inputFields) {
    input[field.name] = generateValidValue(field.type);
  }
  return input;
}
