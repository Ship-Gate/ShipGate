// ============================================================================
// ISL Type-Aware Shrinker - Shrink strategies driven by ISL type definitions
// ============================================================================
//
// Unlike the generic shrinker in shrinker.ts, this module uses the ISL AST
// type information to produce shrink candidates that always satisfy the
// original type constraints (min/max, minLength/maxLength, enum membership,
// entity shape, collection bounds, etc.).
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { Generator, PRNG } from './types.js';
import { BaseGenerator } from './random.js';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create a Generator<T> whose `shrink` method is ISL-type-aware.
 * The returned generator delegates `generate` to `baseGen` but replaces
 * `shrink` with a strategy derived from the ISL `TypeDefinition`.
 */
export function withTypeShrink<T>(
  baseGen: Generator<T>,
  typeDef: AST.TypeDefinition,
  domain: AST.Domain,
): Generator<T> {
  return new BaseGenerator<T>(
    (prng: PRNG, size: number) => baseGen.generate(prng, size),
    (value: T) => typeShrink(value, typeDef, domain),
  );
}

/**
 * Shrink a value according to its ISL type definition.
 * Yields progressively "smaller" values that still conform to the type.
 */
export function* typeShrink(
  value: unknown,
  typeDef: AST.TypeDefinition,
  domain: AST.Domain,
): Iterable<any> {
  switch (typeDef.kind) {
    case 'PrimitiveType':
      yield* shrinkPrimitive(value, typeDef);
      break;

    case 'ConstrainedType':
      yield* shrinkConstrained(value, typeDef, domain);
      break;

    case 'EnumType':
      yield* shrinkEnum(value, typeDef);
      break;

    case 'StructType':
      yield* shrinkStruct(value as Record<string, unknown>, typeDef, domain);
      break;

    case 'ListType':
      yield* shrinkList(value as unknown[], typeDef, domain);
      break;

    case 'MapType':
      yield* shrinkMap(value as Record<string, unknown>, typeDef, domain);
      break;

    case 'OptionalType':
      yield* shrinkOptional(value, typeDef, domain);
      break;

    case 'UnionType':
      yield* shrinkUnion(value as Record<string, unknown>, typeDef, domain);
      break;

    case 'ReferenceType':
      yield* shrinkReference(value, typeDef, domain);
      break;

    default:
      yield* shrinkGenericValue(value);
      break;
  }
}

// ============================================================================
// PRIMITIVE SHRINKING
// ============================================================================

function* shrinkPrimitive(
  value: unknown,
  type: AST.PrimitiveType,
): Iterable<unknown> {
  const name = type.name;

  if ((name === 'Int' || name === 'Decimal') && typeof value === 'number') {
    yield* shrinkNumber(value, name === 'Int');
  } else if (name === 'String' && typeof value === 'string') {
    yield* shrinkString(value, 0, Infinity);
  } else if (name === 'Boolean' && typeof value === 'boolean') {
    if (value) yield false;
  } else if (name === 'UUID' || name === 'Timestamp' || name === 'Duration') {
    // These have fixed formats; shrinking is not meaningful.
  }
}

function* shrinkNumber(
  value: number,
  isInt: boolean,
): Iterable<number> {
  if (value === 0) return;
  yield 0;
  if (value < 0) yield isInt ? Math.abs(value) : Math.abs(value);
  if (!isInt && !Number.isInteger(value)) yield Math.trunc(value);

  let current = value;
  while (Math.abs(current) > 1) {
    current = Math.trunc(current / 2);
    if (current !== 0 && current !== value) yield current;
  }
  if (value > 0 && value !== 1) yield value - 1;
  if (value < 0 && value !== -1) yield value + 1;
}

function* shrinkString(
  value: string,
  minLength: number,
  _maxLength: number,
): Iterable<string> {
  if (value.length <= minLength) return;
  if (minLength === 0) yield '';
  if (value.length > minLength) yield value.slice(0, minLength || 1);
  const half = Math.max(minLength, Math.ceil(value.length / 2));
  if (half < value.length && half > minLength) yield value.slice(0, half);
  for (let i = value.length - 1; i > minLength; i--) {
    yield value.slice(0, i);
  }
}

// ============================================================================
// CONSTRAINED TYPE SHRINKING
// ============================================================================

function* shrinkConstrained(
  value: unknown,
  type: AST.ConstrainedType,
  domain: AST.Domain,
): Iterable<unknown> {
  const constraints = extractConstraints(type);

  // Numeric constrained types
  if (typeof value === 'number') {
    yield* shrinkConstrainedNumber(value, constraints);
    return;
  }

  // String constrained types
  if (typeof value === 'string') {
    yield* shrinkConstrainedString(value, constraints);
    return;
  }

  // Fall through to base type shrinking
  yield* typeShrink(value, type.base, domain);
}

interface ExtractedConstraints {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  precision?: number;
  format?: string;
}

function extractConstraints(type: AST.ConstrainedType): ExtractedConstraints {
  const c: ExtractedConstraints = {};
  for (const constraint of type.constraints) {
    const val = literalValue(constraint.value);
    switch (constraint.name.toLowerCase()) {
      case 'min': c.min = val as number; break;
      case 'max': c.max = val as number; break;
      case 'min_length': case 'minlength': c.minLength = val as number; break;
      case 'max_length': case 'maxlength': c.maxLength = val as number; break;
      case 'precision': c.precision = val as number; break;
      case 'format': c.format = val as string; break;
    }
  }
  return c;
}

function* shrinkConstrainedNumber(
  value: number,
  c: ExtractedConstraints,
): Iterable<number> {
  const lo = c.min ?? -Infinity;
  const hi = c.max ?? Infinity;
  const round = (n: number) =>
    c.precision !== undefined
      ? Math.round(n * 10 ** c.precision) / 10 ** c.precision
      : n;

  const emit = function* (candidate: number) {
    const r = round(candidate);
    if (r >= lo && r <= hi && r !== value) yield r;
  };

  // Try the lower bound
  if (lo !== -Infinity) yield* emit(lo);
  // Try zero if in range
  yield* emit(0);
  // Try 1 if in range
  yield* emit(1);
  // Binary search towards the lower bound (or zero)
  const target = lo !== -Infinity ? lo : 0;
  let current = value;
  while (Math.abs(current - target) > (c.precision !== undefined ? 10 ** -c.precision : 0.5)) {
    current = round((current + target) / 2);
    if (current !== value && current >= lo && current <= hi) yield current;
    if (current === target) break;
  }
  // Adjacent
  const step = c.precision !== undefined ? 10 ** -c.precision : 1;
  if (value - step >= lo) yield* emit(value - step);
}

function* shrinkConstrainedString(
  value: string,
  c: ExtractedConstraints,
): Iterable<string> {
  const minLen = c.minLength ?? 0;
  const maxLen = c.maxLength ?? Infinity;

  if (value.length <= minLen) return;

  // Try minimum length
  if (value.length > minLen) {
    const s = value.slice(0, Math.max(minLen, 1));
    if (s.length >= minLen && s.length <= maxLen && s !== value) yield s;
  }

  // Half length
  const half = Math.max(minLen, Math.ceil(value.length / 2));
  if (half < value.length && half >= minLen && half <= maxLen) {
    yield value.slice(0, half);
  }

  // Progressive removal from end
  for (let i = value.length - 1; i > minLen; i--) {
    const s = value.slice(0, i);
    if (s.length <= maxLen) yield s;
  }

  // Simplify characters (same length)
  if (value.length >= minLen && value.length <= maxLen) {
    const simplified = value.toLowerCase().replace(/[^a-z]/g, 'a');
    if (simplified !== value) yield simplified;
  }
}

// ============================================================================
// ENUM SHRINKING
// ============================================================================

function* shrinkEnum(
  value: unknown,
  type: AST.EnumType,
): Iterable<unknown> {
  if (type.variants.length === 0) return;
  const first = type.variants[0]!.name.name;
  // Shrink towards the first variant (canonical "smallest" enum value)
  if (value !== first) {
    yield first;
  }
}

// ============================================================================
// STRUCT (NESTED ENTITY) SHRINKING
// ============================================================================

function* shrinkStruct(
  value: Record<string, unknown>,
  type: AST.StructType,
  domain: AST.Domain,
): Iterable<Record<string, unknown>> {
  // Try removing optional fields
  for (const field of type.fields) {
    if (field.optional && value[field.name.name] !== undefined) {
      yield { ...value, [field.name.name]: undefined };
    }
  }

  // Shrink each field individually
  for (const field of type.fields) {
    const fieldVal = value[field.name.name];
    if (fieldVal === undefined || fieldVal === null) continue;

    for (const shrunk of typeShrink(fieldVal, field.type, domain)) {
      yield { ...value, [field.name.name]: shrunk };
    }
  }
}

// ============================================================================
// COLLECTION SHRINKING
// ============================================================================

function* shrinkList(
  value: unknown[],
  type: AST.ListType,
  domain: AST.Domain,
): Iterable<unknown[]> {
  if (value.length === 0) return;

  // Empty list
  yield [];

  // Single element
  if (value.length > 1) yield [value[0]];

  // First half
  if (value.length > 2) yield value.slice(0, Math.ceil(value.length / 2));

  // Remove each element
  for (let i = 0; i < value.length; i++) {
    yield [...value.slice(0, i), ...value.slice(i + 1)];
  }

  // Shrink individual elements
  for (let i = 0; i < value.length; i++) {
    for (const shrunk of typeShrink(value[i], type.element, domain)) {
      yield [...value.slice(0, i), shrunk, ...value.slice(i + 1)];
    }
  }
}

function* shrinkMap(
  value: Record<string, unknown>,
  type: AST.MapType,
  domain: AST.Domain,
): Iterable<Record<string, unknown>> {
  const keys = Object.keys(value);
  if (keys.length === 0) return;

  // Empty map
  yield {};

  // Remove each key
  for (const key of keys) {
    const copy = { ...value };
    delete copy[key];
    yield copy;
  }

  // Shrink individual values
  for (const key of keys) {
    for (const shrunk of typeShrink(value[key], type.value, domain)) {
      yield { ...value, [key]: shrunk };
    }
  }
}

// ============================================================================
// OPTIONAL SHRINKING
// ============================================================================

function* shrinkOptional(
  value: unknown,
  type: AST.OptionalType,
  domain: AST.Domain,
): Iterable<unknown> {
  // Shrink to undefined (absence)
  if (value !== undefined) {
    yield undefined;
    // Then shrink the inner value
    yield* typeShrink(value, type.inner, domain);
  }
}

// ============================================================================
// UNION SHRINKING
// ============================================================================

function* shrinkUnion(
  value: Record<string, unknown>,
  type: AST.UnionType,
  domain: AST.Domain,
): Iterable<Record<string, unknown>> {
  if (type.variants.length === 0) return;

  const currentVariant = value.__variant__ as string | undefined;

  // Shrink towards the first variant
  if (currentVariant && type.variants.length > 0) {
    const firstVariant = type.variants[0]!;
    if (currentVariant !== firstVariant.name.name) {
      const minimal: Record<string, unknown> = { __variant__: firstVariant.name.name };
      yield minimal;
    }
  }

  // Shrink fields of the current variant
  const matchingVariant = type.variants.find((v) => v.name.name === currentVariant);
  if (matchingVariant) {
    for (const field of matchingVariant.fields) {
      const fieldVal = value[field.name.name];
      if (fieldVal === undefined || fieldVal === null) continue;
      for (const shrunk of typeShrink(fieldVal, field.type, domain)) {
        yield { ...value, [field.name.name]: shrunk };
      }
    }
  }
}

// ============================================================================
// REFERENCE TYPE SHRINKING
// ============================================================================

function* shrinkReference(
  value: unknown,
  type: AST.ReferenceType,
  domain: AST.Domain,
): Iterable<unknown> {
  const refName = type.name.parts.map((p) => p.name).join('.');

  // Look up type definition in domain
  const typeDef = domain.types.find((t) => t.name.name === refName);
  if (typeDef) {
    yield* typeShrink(value, typeDef.definition, domain);
    return;
  }

  // Check for entity reference (shrink as UUID or generic)
  const entity = domain.entities.find((e) => e.name.name === refName);
  if (entity && typeof value === 'object' && value !== null) {
    yield* shrinkEntityInstance(value as Record<string, unknown>, entity, domain);
    return;
  }

  // Fallback generic shrink
  yield* shrinkGenericValue(value);
}

// ============================================================================
// ENTITY INSTANCE SHRINKING
// ============================================================================

/**
 * Shrink an entity instance by shrinking its fields according to the
 * Entity definition in the ISL domain.
 */
export function* shrinkEntityInstance(
  value: Record<string, unknown>,
  entity: AST.Entity,
  domain: AST.Domain,
): Iterable<Record<string, unknown>> {
  // Remove optional fields
  for (const field of entity.fields) {
    if (field.optional && value[field.name.name] !== undefined) {
      yield { ...value, [field.name.name]: undefined };
    }
  }

  // Shrink each field
  for (const field of entity.fields) {
    const fieldVal = value[field.name.name];
    if (fieldVal === undefined || fieldVal === null) continue;

    for (const shrunk of typeShrink(fieldVal, field.type, domain)) {
      yield { ...value, [field.name.name]: shrunk };
    }
  }
}

// ============================================================================
// GENERIC FALLBACK
// ============================================================================

function* shrinkGenericValue(value: unknown): Iterable<unknown> {
  if (value === null || value === undefined) return;

  if (typeof value === 'string') {
    yield* shrinkString(value, 0, Infinity);
  } else if (typeof value === 'number') {
    yield* shrinkNumber(value, Number.isInteger(value));
  } else if (typeof value === 'boolean') {
    if (value) yield false;
  } else if (Array.isArray(value)) {
    if (value.length > 0) yield [];
    if (value.length > 1) yield [value[0]];
    for (let i = 0; i < value.length; i++) {
      yield [...value.slice(0, i), ...value.slice(i + 1)];
    }
  } else if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length > 0) yield {};
    for (const key of keys) {
      const copy = { ...obj };
      delete copy[key];
      yield copy;
    }
  }
}

// ============================================================================
// UTILITY
// ============================================================================

function literalValue(expr: AST.Expression): unknown {
  switch (expr.kind) {
    case 'NumberLiteral': return expr.value;
    case 'StringLiteral': return expr.value;
    case 'BooleanLiteral': return expr.value;
    default: return undefined;
  }
}
