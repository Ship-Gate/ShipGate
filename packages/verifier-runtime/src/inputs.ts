// ============================================================================
// Test Input Generator - Generate valid, boundary, and invalid test inputs
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { GeneratedInput, InputCategory } from './types.js';

/**
 * Generate test inputs for a behavior based on its input specification
 */
export function generateInputs(
  behavior: AST.Behavior,
  domain: AST.Domain
): GeneratedInput[] {
  const inputs: GeneratedInput[] = [];
  const inputSpec = behavior.input;

  // Generate valid inputs
  inputs.push(...generateValidInputs(inputSpec, domain));

  // Generate boundary inputs
  inputs.push(...generateBoundaryInputs(inputSpec, domain));

  // Generate invalid inputs
  inputs.push(...generateInvalidInputs(inputSpec, domain));

  return inputs;
}

// ============================================================================
// VALID INPUT GENERATION
// ============================================================================

function generateValidInputs(
  inputSpec: AST.InputSpec,
  domain: AST.Domain
): GeneratedInput[] {
  const inputs: GeneratedInput[] = [];

  // Generate a basic valid input
  const basicValues: Record<string, unknown> = {};
  for (const field of inputSpec.fields) {
    basicValues[field.name.name] = generateValidValue(field.type, field, domain);
  }

  inputs.push({
    category: 'valid',
    name: 'basic_valid',
    description: 'Basic valid input with typical values',
    values: basicValues,
  });

  // Generate with optional fields omitted
  const hasOptional = inputSpec.fields.some((f) => f.optional);
  if (hasOptional) {
    const minimalValues: Record<string, unknown> = {};
    for (const field of inputSpec.fields) {
      if (!field.optional) {
        minimalValues[field.name.name] = generateValidValue(field.type, field, domain);
      }
    }
    inputs.push({
      category: 'valid',
      name: 'minimal_valid',
      description: 'Valid input with only required fields',
      values: minimalValues,
    });
  }

  // Generate with all optional fields present
  if (hasOptional) {
    const maximalValues: Record<string, unknown> = {};
    for (const field of inputSpec.fields) {
      maximalValues[field.name.name] = generateValidValue(field.type, field, domain);
    }
    inputs.push({
      category: 'valid',
      name: 'maximal_valid',
      description: 'Valid input with all optional fields',
      values: maximalValues,
    });
  }

  return inputs;
}

// ============================================================================
// BOUNDARY INPUT GENERATION
// ============================================================================

function generateBoundaryInputs(
  inputSpec: AST.InputSpec,
  domain: AST.Domain
): GeneratedInput[] {
  const inputs: GeneratedInput[] = [];

  for (const field of inputSpec.fields) {
    const constraints = getConstraints(field.type, domain);
    
    // Generate boundary cases for this field
    const boundaryValues = generateBoundaryValuesForType(field.type, constraints, domain);
    
    for (const { name, value, description } of boundaryValues) {
      const values: Record<string, unknown> = {};
      
      // Use valid values for other fields
      for (const f of inputSpec.fields) {
        if (f.name.name === field.name.name) {
          values[f.name.name] = value;
        } else if (!f.optional) {
          values[f.name.name] = generateValidValue(f.type, f, domain);
        }
      }

      inputs.push({
        category: 'boundary',
        name: `boundary_${field.name.name}_${name}`,
        description: `Boundary: ${field.name.name} - ${description}`,
        values,
      });
    }
  }

  return inputs;
}

interface BoundaryValue {
  name: string;
  value: unknown;
  description: string;
}

function generateBoundaryValuesForType(
  type: AST.TypeDefinition,
  constraints: TypeConstraints,
  domain: AST.Domain
): BoundaryValue[] {
  const values: BoundaryValue[] = [];

  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'Int':
          if (constraints.min !== undefined) {
            values.push({ name: 'min', value: constraints.min, description: `minimum value (${constraints.min})` });
            values.push({ name: 'min_plus_1', value: constraints.min + 1, description: `minimum + 1 (${constraints.min + 1})` });
          }
          if (constraints.max !== undefined) {
            values.push({ name: 'max', value: constraints.max, description: `maximum value (${constraints.max})` });
            values.push({ name: 'max_minus_1', value: constraints.max - 1, description: `maximum - 1 (${constraints.max - 1})` });
          }
          values.push({ name: 'zero', value: 0, description: 'zero' });
          break;

        case 'Decimal':
          if (constraints.min !== undefined) {
            values.push({ name: 'min', value: constraints.min, description: `minimum (${constraints.min})` });
            values.push({ name: 'min_epsilon', value: constraints.min + 0.01, description: 'minimum + epsilon' });
          }
          if (constraints.max !== undefined) {
            values.push({ name: 'max', value: constraints.max, description: `maximum (${constraints.max})` });
            values.push({ name: 'max_epsilon', value: constraints.max - 0.01, description: 'maximum - epsilon' });
          }
          break;

        case 'String':
          if (constraints.minLength !== undefined) {
            values.push({
              name: 'min_length',
              value: 'a'.repeat(constraints.minLength),
              description: `minimum length (${constraints.minLength})`,
            });
          }
          if (constraints.maxLength !== undefined) {
            values.push({
              name: 'max_length',
              value: 'a'.repeat(constraints.maxLength),
              description: `maximum length (${constraints.maxLength})`,
            });
          }
          values.push({ name: 'empty', value: '', description: 'empty string' });
          break;
      }
      break;

    case 'ListType':
      if (constraints.minLength !== undefined) {
        const element = generateValidValue(type.element, undefined, domain);
        values.push({
          name: 'min_length',
          value: Array(constraints.minLength).fill(element),
          description: `minimum length (${constraints.minLength})`,
        });
      }
      if (constraints.maxLength !== undefined) {
        const element = generateValidValue(type.element, undefined, domain);
        values.push({
          name: 'max_length',
          value: Array(constraints.maxLength).fill(element),
          description: `maximum length (${constraints.maxLength})`,
        });
      }
      values.push({ name: 'empty', value: [], description: 'empty list' });
      break;
  }

  return values;
}

// ============================================================================
// INVALID INPUT GENERATION
// ============================================================================

function generateInvalidInputs(
  inputSpec: AST.InputSpec,
  domain: AST.Domain
): GeneratedInput[] {
  const inputs: GeneratedInput[] = [];

  for (const field of inputSpec.fields) {
    if (field.optional) continue; // Skip optional fields for invalid tests

    const constraints = getConstraints(field.type, domain);
    const invalidValues = generateInvalidValuesForType(field.type, constraints, domain);

    for (const { name, value, description } of invalidValues) {
      const values: Record<string, unknown> = {};

      for (const f of inputSpec.fields) {
        if (f.name.name === field.name.name) {
          values[f.name.name] = value;
        } else if (!f.optional) {
          values[f.name.name] = generateValidValue(f.type, f, domain);
        }
      }

      inputs.push({
        category: 'invalid',
        name: `invalid_${field.name.name}_${name}`,
        description: `Invalid: ${field.name.name} - ${description}`,
        values,
      });
    }
  }

  // Generate missing required field
  for (const field of inputSpec.fields) {
    if (!field.optional) {
      const values: Record<string, unknown> = {};
      for (const f of inputSpec.fields) {
        if (f.name.name !== field.name.name && !f.optional) {
          values[f.name.name] = generateValidValue(f.type, f, domain);
        }
      }
      inputs.push({
        category: 'invalid',
        name: `missing_${field.name.name}`,
        description: `Missing required field: ${field.name.name}`,
        values,
      });
    }
  }

  return inputs;
}

function generateInvalidValuesForType(
  type: AST.TypeDefinition,
  constraints: TypeConstraints,
  _domain: AST.Domain
): BoundaryValue[] {
  const values: BoundaryValue[] = [];

  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'Int':
          if (constraints.min !== undefined) {
            values.push({
              name: 'below_min',
              value: constraints.min - 1,
              description: `below minimum (${constraints.min - 1})`,
            });
          }
          if (constraints.max !== undefined) {
            values.push({
              name: 'above_max',
              value: constraints.max + 1,
              description: `above maximum (${constraints.max + 1})`,
            });
          }
          values.push({ name: 'null', value: null, description: 'null value' });
          values.push({ name: 'string', value: 'not a number', description: 'wrong type (string)' });
          break;

        case 'Decimal':
          if (constraints.min !== undefined) {
            values.push({
              name: 'below_min',
              value: constraints.min - 1,
              description: `below minimum (${constraints.min - 1})`,
            });
          }
          if (constraints.max !== undefined) {
            values.push({
              name: 'above_max',
              value: constraints.max + 1,
              description: `above maximum (${constraints.max + 1})`,
            });
          }
          values.push({ name: 'nan', value: NaN, description: 'NaN' });
          values.push({ name: 'infinity', value: Infinity, description: 'Infinity' });
          break;

        case 'String':
          if (constraints.minLength !== undefined && constraints.minLength > 0) {
            values.push({
              name: 'too_short',
              value: 'a'.repeat(constraints.minLength - 1),
              description: `too short (${constraints.minLength - 1} chars)`,
            });
          }
          if (constraints.maxLength !== undefined) {
            values.push({
              name: 'too_long',
              value: 'a'.repeat(constraints.maxLength + 1),
              description: `too long (${constraints.maxLength + 1} chars)`,
            });
          }
          if (constraints.format) {
            values.push({
              name: 'invalid_format',
              value: '!!!invalid!!!',
              description: 'invalid format',
            });
          }
          values.push({ name: 'null', value: null, description: 'null value' });
          break;

        case 'UUID':
          values.push({ name: 'invalid_uuid', value: 'not-a-uuid', description: 'invalid UUID format' });
          values.push({ name: 'null', value: null, description: 'null value' });
          break;

        case 'Boolean':
          values.push({ name: 'string', value: 'true', description: 'string instead of boolean' });
          values.push({ name: 'number', value: 1, description: 'number instead of boolean' });
          break;
      }
      break;

    case 'ListType':
      if (constraints.minLength !== undefined && constraints.minLength > 0) {
        values.push({
          name: 'too_few',
          value: [],
          description: `too few items (0 < ${constraints.minLength})`,
        });
      }
      if (constraints.maxLength !== undefined) {
        values.push({
          name: 'too_many',
          value: Array(constraints.maxLength + 1).fill(null),
          description: `too many items (${constraints.maxLength + 1})`,
        });
      }
      values.push({ name: 'null', value: null, description: 'null instead of array' });
      break;
  }

  return values;
}

// ============================================================================
// VALUE GENERATION
// ============================================================================

function generateValidValue(
  type: AST.TypeDefinition,
  field: AST.Field | undefined,
  domain: AST.Domain
): unknown {
  const constraints = getConstraints(type, domain);

  switch (type.kind) {
    case 'PrimitiveType':
      return generatePrimitiveValue(type.name, constraints, field);

    case 'ConstrainedType':
      return generateValidValue(type.base, field, domain);

    case 'EnumType':
      // Return first variant
      return type.variants[0]?.name.name ?? 'UNKNOWN';

    case 'StructType':
      const struct: Record<string, unknown> = {};
      for (const f of type.fields) {
        if (!f.optional) {
          struct[f.name.name] = generateValidValue(f.type, f, domain);
        }
      }
      return struct;

    case 'ListType':
      const minLen = constraints.minLength ?? 1;
      const items: unknown[] = [];
      for (let i = 0; i < minLen; i++) {
        items.push(generateValidValue(type.element, undefined, domain));
      }
      return items;

    case 'MapType':
      return {};

    case 'OptionalType':
      return generateValidValue(type.inner, field, domain);

    case 'ReferenceType': {
      const refName = type.name.parts.map((p) => p.name).join('.');
      // Try to find the type definition
      const typeDef = domain.types.find((t) => t.name.name === refName);
      if (typeDef) {
        return generateValidValue(typeDef.definition, field, domain);
      }
      // Try to find entity
      const entity = domain.entities.find((e) => e.name.name === refName);
      if (entity) {
        return generateUUID();
      }
      return null;
    }

    case 'UnionType':
      // Generate first variant
      const firstVariant = type.variants[0];
      if (firstVariant) {
        const variantValue: Record<string, unknown> = {
          __variant__: firstVariant.name.name,
        };
        for (const f of firstVariant.fields) {
          if (!f.optional) {
            variantValue[f.name.name] = generateValidValue(f.type, f, domain);
          }
        }
        return variantValue;
      }
      return null;

    default:
      return null;
  }
}

function generatePrimitiveValue(
  name: string,
  constraints: TypeConstraints,
  _field: AST.Field | undefined
): unknown {
  switch (name) {
    case 'String': {
      if (constraints.format) {
        return generateStringFromPattern(constraints.format);
      }
      const minLen = constraints.minLength ?? 1;
      const maxLen = constraints.maxLength ?? 100;
      const len = Math.min(minLen + 5, maxLen);
      return 'test_' + 'x'.repeat(Math.max(0, len - 5));
    }

    case 'Int': {
      const min = constraints.min ?? 0;
      const max = constraints.max ?? 100;
      return Math.floor((min + max) / 2);
    }

    case 'Decimal': {
      const min = constraints.min ?? 0;
      const max = constraints.max ?? 100;
      const value = (min + max) / 2;
      const precision = constraints.precision ?? 2;
      return Number(value.toFixed(precision));
    }

    case 'Boolean':
      return true;

    case 'UUID':
      return generateUUID();

    case 'Timestamp':
      return new Date().toISOString();

    case 'Duration':
      return 1000; // 1 second in ms

    default:
      return null;
  }
}

function generateStringFromPattern(pattern: RegExp | string): string {
  const patternStr = typeof pattern === 'string' ? pattern : pattern.source;

  // Handle common patterns
  if (patternStr.includes('@') && patternStr.includes('\\.')) {
    return 'test@example.com';
  }
  if (patternStr.match(/\[A-Z\].*\[0-9\]/i)) {
    return 'AB-123456';
  }

  return 'valid_string';
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// CONSTRAINT EXTRACTION
// ============================================================================

interface TypeConstraints {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  precision?: number;
  format?: RegExp | string;
  pattern?: string;
}

function getConstraints(type: AST.TypeDefinition, domain: AST.Domain): TypeConstraints {
  const constraints: TypeConstraints = {};

  if (type.kind === 'ConstrainedType') {
    for (const constraint of type.constraints) {
      const value = extractConstraintValue(constraint.value);
      switch (constraint.name) {
        case 'min':
          constraints.min = value as number;
          break;
        case 'max':
          constraints.max = value as number;
          break;
        case 'min_length':
        case 'minLength':
          constraints.minLength = value as number;
          break;
        case 'max_length':
        case 'maxLength':
          constraints.maxLength = value as number;
          break;
        case 'precision':
          constraints.precision = value as number;
          break;
        case 'format':
        case 'pattern':
          constraints.format = value as RegExp | string;
          break;
      }
    }
    // Also get constraints from base type
    const baseConstraints = getConstraints(type.base, domain);
    return { ...baseConstraints, ...constraints };
  }

  if (type.kind === 'ReferenceType') {
    const refName = type.name.parts.map((p) => p.name).join('.');
    const typeDef = domain.types.find((t) => t.name.name === refName);
    if (typeDef) {
      return getConstraints(typeDef.definition, domain);
    }
  }

  return constraints;
}

function extractConstraintValue(expr: AST.Expression): unknown {
  switch (expr.kind) {
    case 'NumberLiteral':
      return expr.value;
    case 'StringLiteral':
      return expr.value;
    case 'BooleanLiteral':
      return expr.value;
    case 'RegexLiteral':
      return new RegExp(expr.pattern, expr.flags);
    default:
      return undefined;
  }
}

// ============================================================================
// SPECIFIC INPUT GENERATION
// ============================================================================

/**
 * Generate a single valid input for quick testing
 */
export function generateQuickInput(
  behavior: AST.Behavior,
  domain: AST.Domain
): GeneratedInput {
  const values: Record<string, unknown> = {};
  
  for (const field of behavior.input.fields) {
    values[field.name.name] = generateValidValue(field.type, field, domain);
  }

  return {
    category: 'valid',
    name: 'quick_test',
    description: 'Quick test input',
    values,
  };
}

/**
 * Generate inputs from scenario definitions
 */
export function generateScenarioInputs(
  behavior: AST.Behavior,
  domain: AST.Domain
): GeneratedInput[] {
  const inputs: GeneratedInput[] = [];
  
  // Find scenarios for this behavior
  const scenarioBlocks = domain.scenarios.filter(
    (s) => s.behaviorName.name === behavior.name.name
  );

  for (const block of scenarioBlocks) {
    for (const scenario of block.scenarios) {
      // Extract input values from 'when' statements
      const values: Record<string, unknown> = {};
      
      for (const stmt of scenario.when) {
        if (stmt.kind === 'CallStmt' && stmt.call.callee.kind === 'Identifier') {
          // Extract arguments from the call
          for (const arg of stmt.call.arguments) {
            // Handle named arguments
            if (arg.kind === 'BinaryExpr' && arg.operator === '==' && arg.left.kind === 'Identifier') {
              values[arg.left.name] = extractConstraintValue(arg.right);
            }
          }
        }
      }

      if (Object.keys(values).length > 0) {
        inputs.push({
          category: 'valid',
          name: `scenario_${scenario.name.value.replace(/\s+/g, '_')}`,
          description: scenario.name.value,
          values,
        });
      }
    }
  }

  return inputs;
}
