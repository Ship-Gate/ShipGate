// ============================================================================
// Boundary Fuzzing Strategy
// Generate boundary and edge case values
// ============================================================================

import { FuzzContext, GeneratedValue, ISLTypeInfo } from '../types.js';
import { INTEGER_BOUNDARIES, FLOAT_EDGE_CASES } from '../generators/number.js';
import { SPECIAL_CHARS, UNICODE_EDGE_CASES } from '../generators/string.js';

/**
 * Boundary strategy configuration
 */
export interface BoundaryStrategyConfig {
  /** Include type-specific boundaries */
  includeTypeSpecific?: boolean;
  
  /** Include constraint-based boundaries */
  includeConstraintBased?: boolean;
  
  /** Include off-by-one values */
  includeOffByOne?: boolean;
}

/**
 * Generate boundary values based on type constraints
 */
export function* generateBoundaryValues(
  typeInfo: ISLTypeInfo,
  ctx: FuzzContext,
  config: BoundaryStrategyConfig = {}
): Generator<GeneratedValue<unknown>> {
  const constraints = typeInfo.constraints ?? ctx.constraints ?? {};

  switch (typeInfo.kind) {
    case 'PrimitiveType':
      yield* generatePrimitiveBoundaries(typeInfo.name ?? 'String', constraints);
      break;
    
    case 'ConstrainedType':
      yield* generateConstrainedBoundaries(typeInfo, constraints);
      break;
    
    case 'EnumType':
      yield* generateEnumBoundaries(typeInfo.variants ?? []);
      break;
    
    case 'ListType':
      yield* generateListBoundaries(typeInfo, constraints);
      break;
    
    case 'MapType':
      yield* generateMapBoundaries(constraints);
      break;
    
    default:
      yield* generateGenericBoundaries();
  }
}

/**
 * Generate boundaries for primitive types
 */
function* generatePrimitiveBoundaries(
  typeName: string,
  constraints: Record<string, unknown>
): Generator<GeneratedValue<unknown>> {
  switch (typeName) {
    case 'String':
      yield* generateStringBoundaries(constraints);
      break;
    
    case 'Int':
      yield* generateIntBoundaries(constraints);
      break;
    
    case 'Decimal':
      yield* generateDecimalBoundaries(constraints);
      break;
    
    case 'Boolean':
      yield { value: true, category: 'boundary', description: 'Boolean true' };
      yield { value: false, category: 'boundary', description: 'Boolean false' };
      break;
    
    case 'Timestamp':
      yield* generateTimestampBoundaries();
      break;
    
    case 'UUID':
      yield* generateUUIDBoundaries();
      break;
    
    case 'Duration':
      yield* generateDurationBoundaries(constraints);
      break;
  }
}

/**
 * Generate string boundary values
 */
function* generateStringBoundaries(
  constraints: Record<string, unknown>
): Generator<GeneratedValue<unknown>> {
  // Empty and minimal
  yield { value: '', category: 'boundary', description: 'Empty string' };
  yield { value: ' ', category: 'boundary', description: 'Single space' };
  yield { value: 'a', category: 'boundary', description: 'Single char' };

  // Length boundaries
  const minLength = constraints.min_length as number | undefined ?? constraints.minLength as number | undefined;
  const maxLength = constraints.max_length as number | undefined ?? constraints.maxLength as number | undefined;

  if (minLength !== undefined) {
    if (minLength > 0) {
      yield { value: 'a'.repeat(minLength - 1), category: 'boundary', description: `Length ${minLength - 1} (under min)` };
    }
    yield { value: 'a'.repeat(minLength), category: 'boundary', description: `Length ${minLength} (at min)` };
    yield { value: 'a'.repeat(minLength + 1), category: 'boundary', description: `Length ${minLength + 1} (above min)` };
  }

  if (maxLength !== undefined) {
    yield { value: 'a'.repeat(maxLength - 1), category: 'boundary', description: `Length ${maxLength - 1} (under max)` };
    yield { value: 'a'.repeat(maxLength), category: 'boundary', description: `Length ${maxLength} (at max)` };
    yield { value: 'a'.repeat(maxLength + 1), category: 'boundary', description: `Length ${maxLength + 1} (over max)` };
  }

  // Very long strings
  yield { value: 'a'.repeat(256), category: 'boundary', description: 'Length 256' };
  yield { value: 'a'.repeat(1024), category: 'boundary', description: 'Length 1024' };
  yield { value: 'a'.repeat(4096), category: 'boundary', description: 'Length 4096' };
  yield { value: 'a'.repeat(65536), category: 'boundary', description: 'Length 65536' };

  // Special characters
  for (const [name, char] of Object.entries(SPECIAL_CHARS)) {
    yield { value: char, category: 'boundary', description: `Special: ${name}` };
  }

  // Unicode boundaries
  yield { value: '\u0000', category: 'boundary', description: 'Null char (U+0000)' };
  yield { value: '\u007F', category: 'boundary', description: 'DEL (U+007F)' };
  yield { value: '\u0080', category: 'boundary', description: 'First extended ASCII (U+0080)' };
  yield { value: '\u00FF', category: 'boundary', description: 'Last Latin-1 (U+00FF)' };
  yield { value: '\u0100', category: 'boundary', description: 'First Latin Extended (U+0100)' };
  yield { value: '\uFFFF', category: 'boundary', description: 'Max BMP (U+FFFF)' };
  yield { value: '\uD800', category: 'boundary', description: 'First surrogate (U+D800)' };
  yield { value: '\uDFFF', category: 'boundary', description: 'Last surrogate (U+DFFF)' };
}

/**
 * Generate integer boundary values
 */
function* generateIntBoundaries(
  constraints: Record<string, unknown>
): Generator<GeneratedValue<unknown>> {
  // Standard boundaries
  for (const boundary of INTEGER_BOUNDARIES.slice(0, 50)) { // Limit for performance
    if (Number.isFinite(boundary)) {
      yield { value: boundary, category: 'boundary', description: `Int boundary: ${boundary}` };
    }
  }

  // Constraint-based boundaries
  const min = constraints.min as number | undefined;
  const max = constraints.max as number | undefined;

  if (min !== undefined) {
    yield { value: min - 1, category: 'boundary', description: `Below min (${min - 1})` };
    yield { value: min, category: 'boundary', description: `At min (${min})` };
    yield { value: min + 1, category: 'boundary', description: `Above min (${min + 1})` };
  }

  if (max !== undefined) {
    yield { value: max - 1, category: 'boundary', description: `Below max (${max - 1})` };
    yield { value: max, category: 'boundary', description: `At max (${max})` };
    yield { value: max + 1, category: 'boundary', description: `Above max (${max + 1})` };
  }

  // Midpoint
  if (min !== undefined && max !== undefined) {
    const mid = Math.floor((min + max) / 2);
    yield { value: mid, category: 'boundary', description: `Midpoint (${mid})` };
  }
}

/**
 * Generate decimal boundary values
 */
function* generateDecimalBoundaries(
  constraints: Record<string, unknown>
): Generator<GeneratedValue<unknown>> {
  // Standard float boundaries
  for (const value of FLOAT_EDGE_CASES.slice(0, 30)) {
    yield { value, category: 'boundary', description: `Float boundary: ${value}` };
  }

  // Constraint-based
  const min = constraints.min as number | undefined;
  const max = constraints.max as number | undefined;
  const precision = constraints.precision as number | undefined;

  if (min !== undefined) {
    yield { value: min - 0.001, category: 'boundary', description: 'Just below min' };
    yield { value: min, category: 'boundary', description: 'At min' };
    yield { value: min + 0.001, category: 'boundary', description: 'Just above min' };
    yield { value: min - Number.EPSILON, category: 'boundary', description: 'Epsilon below min' };
  }

  if (max !== undefined) {
    yield { value: max - 0.001, category: 'boundary', description: 'Just below max' };
    yield { value: max, category: 'boundary', description: 'At max' };
    yield { value: max + 0.001, category: 'boundary', description: 'Just above max' };
    yield { value: max + Number.EPSILON, category: 'boundary', description: 'Epsilon above max' };
  }

  if (precision !== undefined) {
    // Generate values at precision boundary
    const precisionValue = Number(`0.${'9'.repeat(precision)}`);
    yield { value: precisionValue, category: 'boundary', description: `At precision (${precision})` };
    yield { value: Number(`0.${'9'.repeat(precision)}1`), category: 'boundary', description: 'Over precision' };
  }
}

/**
 * Generate timestamp boundary values
 */
function* generateTimestampBoundaries(): Generator<GeneratedValue<unknown>> {
  yield { value: new Date(0), category: 'boundary', description: 'Unix epoch' };
  yield { value: new Date(-1), category: 'boundary', description: 'Before epoch' };
  yield { value: new Date('1970-01-01T00:00:00.001Z'), category: 'boundary', description: '1ms after epoch' };
  yield { value: new Date('2038-01-19T03:14:07.000Z'), category: 'boundary', description: 'Y2K38 boundary' };
  yield { value: new Date('2038-01-19T03:14:08.000Z'), category: 'boundary', description: 'After Y2K38' };
  yield { value: new Date(8640000000000000), category: 'boundary', description: 'Max Date' };
  yield { value: new Date(-8640000000000000), category: 'boundary', description: 'Min Date' };
  yield { value: new Date(8640000000000001), category: 'boundary', description: 'Invalid Date (over max)' };
}

/**
 * Generate UUID boundary values
 */
function* generateUUIDBoundaries(): Generator<GeneratedValue<unknown>> {
  yield { value: '00000000-0000-0000-0000-000000000000', category: 'boundary', description: 'Nil UUID' };
  yield { value: 'ffffffff-ffff-ffff-ffff-ffffffffffff', category: 'boundary', description: 'Max UUID' };
  yield { value: '00000000-0000-1000-8000-000000000000', category: 'boundary', description: 'Min v1 UUID' };
  yield { value: '00000000-0000-4000-8000-000000000000', category: 'boundary', description: 'Min v4 UUID' };
}

/**
 * Generate duration boundary values
 */
function* generateDurationBoundaries(
  constraints: Record<string, unknown>
): Generator<GeneratedValue<unknown>> {
  yield { value: 0, category: 'boundary', description: 'Zero duration' };
  yield { value: 1, category: 'boundary', description: 'Minimum duration' };
  yield { value: -1, category: 'boundary', description: 'Negative duration' };
  yield { value: Number.MAX_SAFE_INTEGER, category: 'boundary', description: 'Max safe duration' };
  yield { value: Infinity, category: 'boundary', description: 'Infinite duration' };
  
  // Common duration boundaries
  yield { value: 999, category: 'boundary', description: '999ms' };
  yield { value: 1000, category: 'boundary', description: '1 second' };
  yield { value: 1001, category: 'boundary', description: '1001ms' };
  yield { value: 59999, category: 'boundary', description: '59.999 seconds' };
  yield { value: 60000, category: 'boundary', description: '1 minute' };
  yield { value: 3599999, category: 'boundary', description: '59:59.999' };
  yield { value: 3600000, category: 'boundary', description: '1 hour' };
}

/**
 * Generate constrained type boundaries
 */
function* generateConstrainedBoundaries(
  typeInfo: ISLTypeInfo,
  constraints: Record<string, unknown>
): Generator<GeneratedValue<unknown>> {
  const baseType = typeInfo.baseType ?? 'String';
  const mergedConstraints = { ...constraints, ...typeInfo.constraints };
  yield* generatePrimitiveBoundaries(baseType, mergedConstraints);
}

/**
 * Generate enum boundaries
 */
function* generateEnumBoundaries(
  variants: string[]
): Generator<GeneratedValue<unknown>> {
  // All valid variants
  for (const variant of variants) {
    yield { value: variant, category: 'boundary', description: `Enum: ${variant}` };
  }
  
  // First and last
  if (variants.length > 0) {
    yield { value: variants[0], category: 'boundary', description: 'First enum value' };
    yield { value: variants[variants.length - 1], category: 'boundary', description: 'Last enum value' };
  }
  
  // Invalid variants
  yield { value: '', category: 'boundary', description: 'Empty enum' };
  yield { value: 'INVALID_VALUE', category: 'boundary', description: 'Invalid enum value' };
}

/**
 * Generate list boundaries
 */
function* generateListBoundaries(
  typeInfo: ISLTypeInfo,
  constraints: Record<string, unknown>
): Generator<GeneratedValue<unknown>> {
  yield { value: [], category: 'boundary', description: 'Empty list' };
  yield { value: [null], category: 'boundary', description: 'List with null' };
  yield { value: [undefined], category: 'boundary', description: 'List with undefined' };
  
  const minLength = constraints.min_length as number | undefined;
  const maxLength = constraints.max_length as number | undefined;
  
  if (minLength !== undefined && minLength > 0) {
    yield { value: Array(minLength - 1).fill(null), category: 'boundary', description: `List length ${minLength - 1}` };
    yield { value: Array(minLength).fill(null), category: 'boundary', description: `List length ${minLength}` };
  }
  
  if (maxLength !== undefined) {
    yield { value: Array(maxLength).fill(null), category: 'boundary', description: `List length ${maxLength}` };
    yield { value: Array(maxLength + 1).fill(null), category: 'boundary', description: `List length ${maxLength + 1}` };
  }
  
  // Large lists
  yield { value: Array(100).fill(null), category: 'boundary', description: 'List length 100' };
  yield { value: Array(1000).fill(null), category: 'boundary', description: 'List length 1000' };
}

/**
 * Generate map boundaries
 */
function* generateMapBoundaries(
  constraints: Record<string, unknown>
): Generator<GeneratedValue<unknown>> {
  yield { value: {}, category: 'boundary', description: 'Empty map' };
  yield { value: { '': null }, category: 'boundary', description: 'Map with empty key' };
  yield { value: { __proto__: {} }, category: 'boundary', description: 'Map with __proto__ key' };
  
  // Large maps
  const large: Record<string, null> = {};
  for (let i = 0; i < 100; i++) {
    large[`key${i}`] = null;
  }
  yield { value: large, category: 'boundary', description: 'Map with 100 keys' };
}

/**
 * Generate generic boundaries (fallback)
 */
function* generateGenericBoundaries(): Generator<GeneratedValue<unknown>> {
  yield { value: null, category: 'boundary', description: 'Null value' };
  yield { value: undefined, category: 'boundary', description: 'Undefined value' };
  yield { value: '', category: 'boundary', description: 'Empty string' };
  yield { value: 0, category: 'boundary', description: 'Zero' };
  yield { value: [], category: 'boundary', description: 'Empty array' };
  yield { value: {}, category: 'boundary', description: 'Empty object' };
}
