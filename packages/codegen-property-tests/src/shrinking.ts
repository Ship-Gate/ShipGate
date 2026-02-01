// ============================================================================
// Custom Shrinkers
// Provides domain-aware shrinking for better counterexample minimization
// ============================================================================

import type * as AST from '../../../master_contracts/ast';
import type { ShrinkerDefinition } from './types';

/**
 * Generate custom shrinker for a type
 */
export function generateShrinker(
  typeDecl: AST.TypeDeclaration
): ShrinkerDefinition | null {
  const typeName = typeDecl.name.name;

  switch (typeDecl.definition.kind) {
    case 'ConstrainedType':
      return generateConstrainedShrinker(typeName, typeDecl.definition);

    case 'StructType':
      return generateStructShrinker(typeName, typeDecl.definition);

    case 'UnionType':
      return generateUnionShrinker(typeName, typeDecl.definition);

    default:
      return null; // Use default shrinker
  }
}

/**
 * Generate shrinker for constrained types
 */
function generateConstrainedShrinker(
  typeName: string,
  type: AST.ConstrainedType
): ShrinkerDefinition {
  const constraints = type.constraints;
  const validationChecks: string[] = [];

  for (const constraint of constraints) {
    const check = constraintToValidation(constraint);
    if (check) {
      validationChecks.push(check);
    }
  }

  const validationCode = validationChecks.length > 0
    ? `if (!(${validationChecks.join(' && ')})) return Stream.nil();`
    : '';

  return {
    name: `shrink${typeName}`,
    targetType: typeName,
    code: `
function shrink${typeName}(value: ${typeName}): Stream<${typeName}> {
  return new Stream(() => {
    ${validationCode}
    
    // Try to shrink toward boundary values
    const candidates: ${typeName}[] = [];
    
    ${generateBoundaryShrinkers(type)}
    
    return candidates
      .filter(c => isValid${typeName}(c))
      .map(c => new Value(c, shrink${typeName}));
  });
}

function isValid${typeName}(value: ${typeName}): boolean {
  return ${validationChecks.length > 0 ? validationChecks.join(' && ') : 'true'};
}
    `.trim(),
  };
}

/**
 * Generate shrinker for struct types
 */
function generateStructShrinker(
  typeName: string,
  type: AST.StructType
): ShrinkerDefinition {
  const fieldShrinkers = type.fields.map((field) => {
    const fieldName = field.name.name;
    return `
    // Shrink ${fieldName}
    for (const shrunk of shrink(value.${fieldName})) {
      candidates.push({ ...value, ${fieldName}: shrunk.value });
    }`;
  }).join('\n');

  return {
    name: `shrink${typeName}`,
    targetType: typeName,
    code: `
function shrink${typeName}(value: ${typeName}): Stream<${typeName}> {
  return new Stream(() => {
    const candidates: ${typeName}[] = [];
    
    ${fieldShrinkers}
    
    return candidates.map(c => new Value(c, shrink${typeName}));
  });
}
    `.trim(),
  };
}

/**
 * Generate shrinker for union types
 */
function generateUnionShrinker(
  typeName: string,
  type: AST.UnionType
): ShrinkerDefinition {
  const variantCases = type.variants.map((variant) => {
    const variantName = variant.name.name;
    const fieldShrinkers = variant.fields.map((field) => {
      const fieldName = field.name.name;
      return `
        for (const shrunk of shrink(value.${fieldName})) {
          candidates.push({ ...value, ${fieldName}: shrunk.value });
        }`;
    }).join('\n');

    return `
    case '${variantName}':
      ${fieldShrinkers}
      break;`;
  }).join('\n');

  return {
    name: `shrink${typeName}`,
    targetType: typeName,
    code: `
function shrink${typeName}(value: ${typeName}): Stream<${typeName}> {
  return new Stream(() => {
    const candidates: ${typeName}[] = [];
    
    switch (value._tag) {
      ${variantCases}
    }
    
    return candidates.map(c => new Value(c, shrink${typeName}));
  });
}
    `.trim(),
  };
}

/**
 * Generate boundary-aware shrinkers for constrained types
 */
function generateBoundaryShrinkers(type: AST.ConstrainedType): string {
  const shrinkers: string[] = [];

  for (const constraint of type.constraints) {
    const name = constraint.name.toLowerCase();

    if (name === 'min') {
      shrinkers.push(`
    // Shrink toward minimum
    const minValue = ${extractValue(constraint.value)};
    if (typeof value === 'number' && value > minValue) {
      candidates.push(minValue);
      candidates.push(Math.floor((value + minValue) / 2));
    }`);
    }

    if (name === 'max') {
      shrinkers.push(`
    // Shrink toward smaller values (away from max)
    if (typeof value === 'number') {
      candidates.push(Math.floor(value / 2));
      candidates.push(value - 1);
    }`);
    }

    if (name === 'min_length' || name === 'minlength') {
      shrinkers.push(`
    // Shrink toward minimum length
    const minLen = ${extractValue(constraint.value)};
    if (typeof value === 'string' && value.length > minLen) {
      candidates.push(value.slice(0, minLen));
    }`);
    }

    if (name === 'max_length' || name === 'maxlength') {
      shrinkers.push(`
    // Shrink string length
    if (typeof value === 'string' && value.length > 1) {
      candidates.push(value.slice(0, Math.floor(value.length / 2)));
      candidates.push(value.slice(0, value.length - 1));
    }`);
    }
  }

  return shrinkers.join('\n');
}

/**
 * Convert constraint to validation check
 */
function constraintToValidation(constraint: AST.Constraint): string | null {
  const name = constraint.name.toLowerCase();
  const value = extractValue(constraint.value);

  switch (name) {
    case 'min':
      return `value >= ${value}`;
    case 'max':
      return `value <= ${value}`;
    case 'min_length':
    case 'minlength':
      return `value.length >= ${value}`;
    case 'max_length':
    case 'maxlength':
      return `value.length <= ${value}`;
    case 'pattern':
    case 'format':
      return `/${value}/.test(value)`;
    default:
      return null;
  }
}

/**
 * Extract value from expression
 */
function extractValue(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'NumberLiteral':
      return String(expr.value);
    case 'StringLiteral':
      return JSON.stringify(expr.value);
    case 'BooleanLiteral':
      return String(expr.value);
    case 'RegexLiteral':
      return expr.pattern;
    default:
      return 'undefined';
  }
}

/**
 * Generate shrinker utility code
 */
export function generateShrinkerUtils(): string {
  return `
// ============================================================================
// Shrinker Utilities
// ============================================================================

import { Stream, Value } from 'fast-check';

/**
 * Generic shrink function that delegates to type-specific shrinkers
 */
function shrink<T>(value: T): Stream<Value<T>> {
  // Default behavior - use fast-check's built-in shrinking
  if (typeof value === 'number') {
    return shrinkNumber(value as unknown as number) as unknown as Stream<Value<T>>;
  }
  if (typeof value === 'string') {
    return shrinkString(value as unknown as string) as unknown as Stream<Value<T>>;
  }
  if (Array.isArray(value)) {
    return shrinkArray(value) as unknown as Stream<Value<T>>;
  }
  return Stream.nil();
}

/**
 * Shrink numbers toward zero
 */
function shrinkNumber(value: number): Stream<Value<number>> {
  return new Stream(() => {
    if (value === 0) return null;
    
    const candidates: number[] = [
      0,
      Math.floor(value / 2),
      value - 1,
      -value, // Try negation
    ].filter(c => Math.abs(c) < Math.abs(value));
    
    return candidates.map(c => new Value(c, shrinkNumber));
  });
}

/**
 * Shrink strings toward empty/shorter
 */
function shrinkString(value: string): Stream<Value<string>> {
  return new Stream(() => {
    if (value.length === 0) return null;
    
    const candidates: string[] = [
      '',
      value.slice(0, Math.floor(value.length / 2)),
      value.slice(0, value.length - 1),
      value.slice(1),
    ];
    
    return candidates.map(c => new Value(c, shrinkString));
  });
}

/**
 * Shrink arrays toward empty/smaller
 */
function shrinkArray<T>(value: T[]): Stream<Value<T[]>> {
  return new Stream(() => {
    if (value.length === 0) return null;
    
    const candidates: T[][] = [
      [],
      value.slice(0, Math.floor(value.length / 2)),
      value.slice(0, value.length - 1),
      value.slice(1),
    ];
    
    return candidates.map(c => new Value(c, shrinkArray));
  });
}

export { shrink, shrinkNumber, shrinkString, shrinkArray };
  `.trim();
}

/**
 * Generate all custom shrinkers for a domain
 */
export function generateAllShrinkers(domain: AST.Domain): ShrinkerDefinition[] {
  const shrinkers: ShrinkerDefinition[] = [];

  for (const typeDecl of domain.types) {
    const shrinker = generateShrinker(typeDecl);
    if (shrinker) {
      shrinkers.push(shrinker);
    }
  }

  return shrinkers;
}
