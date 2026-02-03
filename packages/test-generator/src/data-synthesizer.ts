// ============================================================================
// Data Synthesizer - Generate meaningful test data from ISL constraints
// ============================================================================
//
// This module synthesizes test data from ISL specifications with:
// - Constraint-aware value generation
// - Boundary value analysis
// - Seeded RNG for deterministic generation
// - Data trace comments for reproducibility
// ============================================================================

import type * as AST from '@isl-lang/parser';

// ============================================================================
// TYPES
// ============================================================================

export interface SynthesizedInput {
  /** Category of test input */
  category: 'valid' | 'boundary' | 'invalid' | 'precondition_violation';
  /** Name for the test case */
  name: string;
  /** Human-readable description */
  description: string;
  /** The generated values */
  values: Record<string, unknown>;
  /** Data trace for reproducibility */
  dataTrace: DataTrace;
  /** Expected outcome (if determinable) */
  expectedOutcome?: ExpectedOutcome;
}

export interface DataTrace {
  /** Seed used for generation */
  seed: number;
  /** Constraint summary */
  constraints: ConstraintSummary[];
  /** Generation timestamp */
  generatedAt: string;
  /** Generation strategy used */
  strategy: string;
}

export interface ConstraintSummary {
  field: string;
  type: string;
  constraints: string[];
}

export interface ExpectedOutcome {
  /** Expected result type */
  type: 'success' | 'error';
  /** Expected error code if type is 'error' */
  errorCode?: string;
  /** Expected assertions */
  assertions: string[];
}

export interface TypeConstraints {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  precision?: number;
  format?: string;
  pattern?: RegExp | string;
  // Collection constraints
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  itemType?: string;
}

/** Cross-field constraint for relationships like a < b */
export interface CrossFieldConstraint {
  leftField: string;
  operator: '<' | '<=' | '>' | '>=' | '==' | '!=';
  rightField: string;
  /** Parsed from precondition expressions */
  source: string;
}

export interface SynthesisOptions {
  /** Seed for deterministic generation (default: derived from behavior name) */
  seed?: number;
  /** Include boundary values */
  includeBoundary?: boolean;
  /** Include invalid inputs for negative testing */
  includeInvalid?: boolean;
  /** Include precondition violation tests */
  includePreconditionViolations?: boolean;
  /** Maximum number of inputs per category */
  maxInputsPerCategory?: number;
}

// ============================================================================
// SEEDED RNG - Mulberry32 implementation for deterministic generation
// ============================================================================

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Get next random number in [0, 1) */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Get random integer in [min, max] */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Get random float in [min, max] */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Pick random element from array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /** Generate random string of given length */
  string(length: number, charset = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[Math.floor(this.next() * charset.length)];
    }
    return result;
  }
}

/** Generate deterministic seed from string */
export function generateSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ============================================================================
// MAIN SYNTHESIZER
// ============================================================================

/**
 * Synthesize test inputs for a behavior based on its specification
 */
export function synthesizeInputs(
  behavior: AST.Behavior,
  domain: AST.Domain,
  options: SynthesisOptions = {}
): SynthesizedInput[] {
  const {
    seed = generateSeed(behavior.name.name),
    includeBoundary = true,
    includeInvalid = true,
    includePreconditionViolations = true,
    maxInputsPerCategory = 5,
  } = options;

  const rng = new SeededRandom(seed);
  const inputs: SynthesizedInput[] = [];
  const inputSpec = behavior.input;

  // Build constraint map for all fields
  const constraintMap = buildConstraintMap(inputSpec, domain);

  // Extract cross-field constraints from preconditions
  const crossFieldConstraints = extractCrossFieldConstraints(behavior);

  // 1. Generate valid inputs (applying cross-field constraints)
  inputs.push(...generateValidInputs(inputSpec, domain, constraintMap, rng, seed, maxInputsPerCategory, crossFieldConstraints));

  // 2. Generate boundary inputs
  if (includeBoundary) {
    inputs.push(...generateBoundaryInputs(inputSpec, domain, constraintMap, rng, seed, maxInputsPerCategory, crossFieldConstraints));
  }

  // 3. Generate invalid inputs (negative tests)
  if (includeInvalid) {
    inputs.push(...generateInvalidInputs(inputSpec, domain, constraintMap, rng, seed, maxInputsPerCategory, behavior));
  }

  // 4. Generate precondition violation tests
  if (includePreconditionViolations && behavior.preconditions.length > 0) {
    inputs.push(...generatePreconditionViolations(
      behavior, domain, constraintMap, rng, seed, maxInputsPerCategory
    ));
  }

  // 5. Generate cross-field violation tests
  if (includePreconditionViolations && crossFieldConstraints.length > 0) {
    inputs.push(...generateCrossFieldViolations(
      inputSpec, domain, constraintMap, crossFieldConstraints, rng, seed
    ));
  }

  return inputs;
}

/**
 * Generate inputs that violate cross-field constraints
 */
function generateCrossFieldViolations(
  inputSpec: AST.InputSpec,
  domain: AST.Domain,
  constraintMap: Map<string, TypeConstraints>,
  crossFieldConstraints: CrossFieldConstraint[],
  rng: SeededRandom,
  seed: number
): SynthesizedInput[] {
  const inputs: SynthesizedInput[] = [];
  const constraintSummaries = buildConstraintSummaries(inputSpec, constraintMap);

  for (const constraint of crossFieldConstraints) {
    // First generate valid values
    const values: Record<string, unknown> = {};
    for (const field of inputSpec.fields) {
      if (!field.optional) {
        values[field.name.name] = generateTypicalValue(
          field.type, constraintMap.get(field.name.name) || {}, domain, rng
        );
      }
    }

    // Then violate the cross-field constraint
    const leftVal = values[constraint.leftField];
    const rightVal = values[constraint.rightField];

    if (typeof leftVal === 'number' && typeof rightVal === 'number') {
      const violatedValues = { ...values };
      
      switch (constraint.operator) {
        case '<':
          violatedValues[constraint.leftField] = rightVal; // equal, not less
          break;
        case '<=':
          violatedValues[constraint.leftField] = rightVal + 1; // greater
          break;
        case '>':
          violatedValues[constraint.leftField] = rightVal; // equal, not greater
          break;
        case '>=':
          violatedValues[constraint.leftField] = rightVal - 1; // less
          break;
        case '==':
          violatedValues[constraint.leftField] = rightVal + 1; // not equal
          break;
        case '!=':
          violatedValues[constraint.leftField] = rightVal; // equal
          break;
      }

      inputs.push({
        category: 'precondition_violation',
        name: `cross_field_violation_${constraint.leftField}_${constraint.operator}_${constraint.rightField}`,
        description: `Violates cross-field constraint: ${constraint.source}`,
        values: violatedValues,
        dataTrace: {
          seed,
          constraints: constraintSummaries,
          generatedAt: new Date().toISOString(),
          strategy: `cross_field_violation`,
        },
        expectedOutcome: {
          type: 'error',
          assertions: [
            'result.success === false',
            `// Cross-field constraint violated: ${constraint.source}`,
          ],
        },
      });
    }
  }

  return inputs;
}

// ============================================================================
// CONSTRAINT EXTRACTION
// ============================================================================

function buildConstraintMap(
  inputSpec: AST.InputSpec,
  domain: AST.Domain
): Map<string, TypeConstraints> {
  const map = new Map<string, TypeConstraints>();

  for (const field of inputSpec.fields) {
    const constraints = extractConstraints(field.type, domain);
    map.set(field.name.name, constraints);
  }

  return map;
}

/**
 * Extract cross-field constraints from preconditions
 * E.g., "input.min_amount < input.max_amount"
 */
function extractCrossFieldConstraints(
  behavior: AST.Behavior
): CrossFieldConstraint[] {
  const constraints: CrossFieldConstraint[] = [];

  for (const precondition of behavior.preconditions) {
    const crossConstraint = parseCrossFieldConstraint(precondition);
    if (crossConstraint) {
      constraints.push(crossConstraint);
    }
  }

  return constraints;
}

function parseCrossFieldConstraint(
  expr: AST.Expression
): CrossFieldConstraint | null {
  if (expr.kind !== 'BinaryExpr') return null;

  const { left, operator, right } = expr;
  
  // Check if both sides reference input fields
  const leftField = extractFieldName(left);
  const rightField = extractFieldName(right);

  if (!leftField || !rightField) return null;

  // Only handle relational operators
  const validOps: CrossFieldConstraint['operator'][] = ['<', '<=', '>', '>=', '==', '!='];
  if (!validOps.includes(operator as CrossFieldConstraint['operator'])) return null;

  return {
    leftField,
    operator: operator as CrossFieldConstraint['operator'],
    rightField,
    source: `${leftField} ${operator} ${rightField}`,
  };
}

/**
 * Apply cross-field constraints to generated values
 */
function applyCrossFieldConstraints(
  values: Record<string, unknown>,
  constraints: CrossFieldConstraint[],
  constraintMap: Map<string, TypeConstraints>,
  rng: SeededRandom
): Record<string, unknown> {
  const result = { ...values };

  for (const constraint of constraints) {
    const leftVal = result[constraint.leftField];
    const rightVal = result[constraint.rightField];

    if (typeof leftVal !== 'number' || typeof rightVal !== 'number') continue;

    const leftConstraints = constraintMap.get(constraint.leftField) || {};
    const _rightConstraints = constraintMap.get(constraint.rightField) || {}; // Reserved for future use

    // Ensure the constraint is satisfied
    switch (constraint.operator) {
      case '<': {
        if (leftVal >= rightVal) {
          // Make left smaller than right
          const maxLeft = Math.min(rightVal - 1, leftConstraints.max ?? rightVal - 1);
          const minLeft = leftConstraints.min ?? 0;
          result[constraint.leftField] = rng.int(minLeft, maxLeft);
        }
        break;
      }
      case '<=': {
        if (leftVal > rightVal) {
          const maxLeft = Math.min(rightVal, leftConstraints.max ?? rightVal);
          const minLeft = leftConstraints.min ?? 0;
          result[constraint.leftField] = rng.int(minLeft, maxLeft);
        }
        break;
      }
      case '>': {
        if (leftVal <= rightVal) {
          const minLeft = Math.max(rightVal + 1, leftConstraints.min ?? rightVal + 1);
          const maxLeft = leftConstraints.max ?? rightVal + 100;
          result[constraint.leftField] = rng.int(minLeft, maxLeft);
        }
        break;
      }
      case '>=': {
        if (leftVal < rightVal) {
          const minLeft = Math.max(rightVal, leftConstraints.min ?? rightVal);
          const maxLeft = leftConstraints.max ?? rightVal + 100;
          result[constraint.leftField] = rng.int(minLeft, maxLeft);
        }
        break;
      }
      case '==': {
        result[constraint.leftField] = rightVal;
        break;
      }
      case '!=': {
        if (leftVal === rightVal) {
          // Make them different
          const newVal = leftVal + (rng.next() > 0.5 ? 1 : -1);
          const clamped = Math.max(
            leftConstraints.min ?? Number.MIN_SAFE_INTEGER,
            Math.min(leftConstraints.max ?? Number.MAX_SAFE_INTEGER, newVal)
          );
          result[constraint.leftField] = clamped;
        }
        break;
      }
    }
  }

  return result;
}

function extractConstraints(
  type: AST.TypeDefinition,
  domain: AST.Domain
): TypeConstraints {
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
          constraints.format = value as string;
          break;
        case 'pattern':
          constraints.pattern = value as string | RegExp;
          break;
      }
    }
    // Recurse to base type
    const baseConstraints = extractConstraints(type.base, domain);
    return { ...baseConstraints, ...constraints };
  }

  if (type.kind === 'ReferenceType') {
    const refName = type.name.parts.map(p => p.name).join('.');
    const typeDef = domain.types.find(t => t.name.name === refName);
    if (typeDef) {
      return extractConstraints(typeDef.definition, domain);
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
// VALID INPUT GENERATION
// ============================================================================

function generateValidInputs(
  inputSpec: AST.InputSpec,
  domain: AST.Domain,
  constraintMap: Map<string, TypeConstraints>,
  rng: SeededRandom,
  seed: number,
  _maxInputs: number,
  crossFieldConstraints: CrossFieldConstraint[] = []
): SynthesizedInput[] {
  const inputs: SynthesizedInput[] = [];
  const constraintSummaries = buildConstraintSummaries(inputSpec, constraintMap);

  // 1. Typical valid input
  let typicalValues: Record<string, unknown> = {};
  for (const field of inputSpec.fields) {
    typicalValues[field.name.name] = generateTypicalValue(
      field.type, constraintMap.get(field.name.name) || {}, domain, rng
    );
  }
  // Apply cross-field constraints
  typicalValues = applyCrossFieldConstraints(typicalValues, crossFieldConstraints, constraintMap, rng);

  inputs.push({
    category: 'valid',
    name: 'typical_valid',
    description: 'Valid input with typical values within constraints',
    values: typicalValues,
    dataTrace: {
      seed,
      constraints: constraintSummaries,
      generatedAt: new Date().toISOString(),
      strategy: 'typical_midpoint',
    },
    expectedOutcome: {
      type: 'success',
      assertions: ['result.success === true'],
    },
  });

  // 2. Minimal valid input (only required fields)
  const hasOptional = inputSpec.fields.some(f => f.optional);
  if (hasOptional) {
    let minimalValues: Record<string, unknown> = {};
    for (const field of inputSpec.fields) {
      if (!field.optional) {
        minimalValues[field.name.name] = generateTypicalValue(
          field.type, constraintMap.get(field.name.name) || {}, domain, rng
        );
      }
    }
    // Apply cross-field constraints
    minimalValues = applyCrossFieldConstraints(minimalValues, crossFieldConstraints, constraintMap, rng);

    inputs.push({
      category: 'valid',
      name: 'minimal_valid',
      description: 'Valid input with only required fields',
      values: minimalValues,
      dataTrace: {
        seed,
        constraints: constraintSummaries.filter(c => !inputSpec.fields.find(f => f.name.name === c.field)?.optional),
        generatedAt: new Date().toISOString(),
        strategy: 'minimal_required',
      },
      expectedOutcome: {
        type: 'success',
        assertions: ['result.success === true'],
      },
    });
  }

  // 3. Randomized valid inputs (seeded)
  let randomValues: Record<string, unknown> = {};
  for (const field of inputSpec.fields) {
    randomValues[field.name.name] = generateRandomValidValue(
      field.type, constraintMap.get(field.name.name) || {}, domain, rng
    );
  }
  // Apply cross-field constraints
  randomValues = applyCrossFieldConstraints(randomValues, crossFieldConstraints, constraintMap, rng);

  inputs.push({
    category: 'valid',
    name: 'random_valid',
    description: 'Seeded random valid input within constraints',
    values: randomValues,
    dataTrace: {
      seed,
      constraints: constraintSummaries,
      generatedAt: new Date().toISOString(),
      strategy: 'seeded_random',
    },
    expectedOutcome: {
      type: 'success',
      assertions: ['result.success === true'],
    },
  });

  return inputs;
}

// ============================================================================
// BOUNDARY INPUT GENERATION
// ============================================================================

function generateBoundaryInputs(
  inputSpec: AST.InputSpec,
  domain: AST.Domain,
  constraintMap: Map<string, TypeConstraints>,
  rng: SeededRandom,
  seed: number,
  _maxInputs: number,
  crossFieldConstraints: CrossFieldConstraint[] = []
): SynthesizedInput[] {
  const inputs: SynthesizedInput[] = [];
  const constraintSummaries = buildConstraintSummaries(inputSpec, constraintMap);

  for (const field of inputSpec.fields) {
    const constraints = constraintMap.get(field.name.name) || {};
    let boundaryValues = generateBoundaryValuesForField(field.type, constraints, domain);

    // Add array boundary values for list types
    if (field.type.kind === 'ListType') {
      boundaryValues = [
        ...boundaryValues,
        ...generateArrayBoundaryValues(field.type.element, constraints, domain, rng),
      ];
    }

    for (const boundary of boundaryValues) {
      let values: Record<string, unknown> = {};

      for (const f of inputSpec.fields) {
        if (f.name.name === field.name.name) {
          values[f.name.name] = boundary.value;
        } else if (!f.optional) {
          values[f.name.name] = generateTypicalValue(
            f.type, constraintMap.get(f.name.name) || {}, domain, rng
          );
        }
      }

      // Apply cross-field constraints
      values = applyCrossFieldConstraints(values, crossFieldConstraints, constraintMap, rng);

      inputs.push({
        category: 'boundary',
        name: `boundary_${field.name.name}_${boundary.name}`,
        description: `Boundary: ${field.name.name} at ${boundary.description}`,
        values,
        dataTrace: {
          seed,
          constraints: constraintSummaries,
          generatedAt: new Date().toISOString(),
          strategy: `boundary_${boundary.name}`,
        },
        expectedOutcome: {
          type: 'success',
          assertions: ['result.success === true', `// Boundary: ${boundary.description}`],
        },
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

function generateBoundaryValuesForField(
  type: AST.TypeDefinition,
  constraints: TypeConstraints,
  _domain: AST.Domain
): BoundaryValue[] {
  const values: BoundaryValue[] = [];

  const baseType = getBaseTypeName(type);

  switch (baseType) {
    case 'Int':
    case 'Decimal': {
      const isDecimal = baseType === 'Decimal';
      const epsilon = isDecimal ? 0.01 : 1;

      if (constraints.min !== undefined) {
        values.push({
          name: 'at_min',
          value: constraints.min,
          description: `minimum value (${constraints.min})`,
        });
        values.push({
          name: 'min_plus_one',
          value: isDecimal ? Number((constraints.min + epsilon).toFixed(2)) : constraints.min + 1,
          description: `minimum + ${epsilon}`,
        });
      }

      if (constraints.max !== undefined) {
        values.push({
          name: 'at_max',
          value: constraints.max,
          description: `maximum value (${constraints.max})`,
        });
        values.push({
          name: 'max_minus_one',
          value: isDecimal ? Number((constraints.max - epsilon).toFixed(2)) : constraints.max - 1,
          description: `maximum - ${epsilon}`,
        });
      }

      // Zero boundary (if in range)
      if ((constraints.min === undefined || constraints.min <= 0) &&
          (constraints.max === undefined || constraints.max >= 0)) {
        values.push({
          name: 'zero',
          value: 0,
          description: 'zero value',
        });
      }
      break;
    }

    case 'String': {
      if (constraints.minLength !== undefined && constraints.minLength > 0) {
        values.push({
          name: 'at_min_length',
          value: generateStringOfLength(constraints.minLength, constraints.format),
          description: `minimum length (${constraints.minLength} chars)`,
        });
      }

      if (constraints.maxLength !== undefined) {
        values.push({
          name: 'at_max_length',
          value: generateStringOfLength(constraints.maxLength, constraints.format),
          description: `maximum length (${constraints.maxLength} chars)`,
        });
      }

      // Empty string (if allowed)
      if (constraints.minLength === undefined || constraints.minLength === 0) {
        values.push({
          name: 'empty',
          value: '',
          description: 'empty string',
        });
      }
      break;
    }
  }

  return values;
}

// ============================================================================
// INVALID INPUT GENERATION (Negative Tests)
// ============================================================================

function generateInvalidInputs(
  inputSpec: AST.InputSpec,
  domain: AST.Domain,
  constraintMap: Map<string, TypeConstraints>,
  rng: SeededRandom,
  seed: number,
  _maxInputs: number,
  behavior: AST.Behavior
): SynthesizedInput[] {
  const inputs: SynthesizedInput[] = [];
  const constraintSummaries = buildConstraintSummaries(inputSpec, constraintMap);
  const errors = behavior.output.errors;

  for (const field of inputSpec.fields) {
    if (field.optional) continue;

    const constraints = constraintMap.get(field.name.name) || {};
    const invalidValues = generateInvalidValuesForField(field.type, constraints);

    for (const invalid of invalidValues) {
      const values: Record<string, unknown> = {};

      for (const f of inputSpec.fields) {
        if (f.name.name === field.name.name) {
          values[f.name.name] = invalid.value;
        } else if (!f.optional) {
          values[f.name.name] = generateTypicalValue(
            f.type, constraintMap.get(f.name.name) || {}, domain, rng
          );
        }
      }

      // Try to match to an error type
      const matchedError = findMatchingError(field.name.name, invalid.reason, errors);

      inputs.push({
        category: 'invalid',
        name: `invalid_${field.name.name}_${invalid.name}`,
        description: `Invalid: ${field.name.name} - ${invalid.description}`,
        values,
        dataTrace: {
          seed,
          constraints: constraintSummaries,
          generatedAt: new Date().toISOString(),
          strategy: `constraint_violation_${invalid.name}`,
        },
        expectedOutcome: {
          type: 'error',
          errorCode: matchedError?.name.name,
          assertions: [
            'result.success === false',
            matchedError ? `result.error === '${matchedError.name.name}'` : '// Should reject invalid input',
          ],
        },
      });
    }
  }

  // Missing required field tests
  for (const field of inputSpec.fields) {
    if (field.optional) continue;

    const values: Record<string, unknown> = {};
    for (const f of inputSpec.fields) {
      if (f.name.name !== field.name.name && !f.optional) {
        values[f.name.name] = generateTypicalValue(
          f.type, constraintMap.get(f.name.name) || {}, domain, rng
        );
      }
    }

    inputs.push({
      category: 'invalid',
      name: `missing_required_${field.name.name}`,
      description: `Missing required field: ${field.name.name}`,
      values,
      dataTrace: {
        seed,
        constraints: constraintSummaries,
        generatedAt: new Date().toISOString(),
        strategy: 'missing_required_field',
      },
      expectedOutcome: {
        type: 'error',
        assertions: [
          'result.success === false',
          `// Should reject missing ${field.name.name}`,
        ],
      },
    });
  }

  return inputs;
}

interface InvalidValue {
  name: string;
  value: unknown;
  description: string;
  reason: string;
}

function generateInvalidValuesForField(
  type: AST.TypeDefinition,
  constraints: TypeConstraints
): InvalidValue[] {
  const values: InvalidValue[] = [];
  const baseType = getBaseTypeName(type);

  switch (baseType) {
    case 'Int':
    case 'Decimal': {
      if (constraints.min !== undefined) {
        values.push({
          name: 'below_min',
          value: constraints.min - 1,
          description: `below minimum (${constraints.min - 1})`,
          reason: 'below_minimum',
        });
      }

      if (constraints.max !== undefined) {
        values.push({
          name: 'above_max',
          value: constraints.max + 1,
          description: `above maximum (${constraints.max + 1})`,
          reason: 'above_maximum',
        });
      }

      values.push({
        name: 'null_value',
        value: null,
        description: 'null value',
        reason: 'null_value',
      });

      values.push({
        name: 'wrong_type_string',
        value: 'not_a_number',
        description: 'wrong type (string)',
        reason: 'wrong_type',
      });

      if (baseType === 'Decimal') {
        values.push({
          name: 'nan_value',
          value: NaN,
          description: 'NaN value',
          reason: 'invalid_number',
        });
      }
      break;
    }

    case 'String': {
      if (constraints.minLength !== undefined && constraints.minLength > 0) {
        values.push({
          name: 'too_short',
          value: 'a'.repeat(Math.max(0, constraints.minLength - 1)),
          description: `too short (${constraints.minLength - 1} chars)`,
          reason: 'too_short',
        });
      }

      if (constraints.maxLength !== undefined) {
        values.push({
          name: 'too_long',
          value: 'a'.repeat(constraints.maxLength + 10),
          description: `too long (${constraints.maxLength + 10} chars)`,
          reason: 'too_long',
        });
      }

      if (constraints.format === 'email') {
        values.push({
          name: 'invalid_email',
          value: 'not-an-email',
          description: 'invalid email format',
          reason: 'invalid_format',
        });
      }

      values.push({
        name: 'null_value',
        value: null,
        description: 'null value',
        reason: 'null_value',
      });
      break;
    }

    case 'UUID': {
      values.push({
        name: 'invalid_uuid',
        value: 'not-a-valid-uuid',
        description: 'invalid UUID format',
        reason: 'invalid_format',
      });
      values.push({
        name: 'null_value',
        value: null,
        description: 'null value',
        reason: 'null_value',
      });
      break;
    }

    case 'Boolean': {
      values.push({
        name: 'string_true',
        value: 'true',
        description: 'string instead of boolean',
        reason: 'wrong_type',
      });
      values.push({
        name: 'number_one',
        value: 1,
        description: 'number instead of boolean',
        reason: 'wrong_type',
      });
      break;
    }
  }

  return values;
}

function findMatchingError(
  fieldName: string,
  reason: string,
  errors: AST.ErrorSpec[]
): AST.ErrorSpec | undefined {
  // Heuristic matching based on field name and error descriptions
  const fieldLower = fieldName.toLowerCase();
  const reasonLower = reason.toLowerCase();

  for (const error of errors) {
    const errorName = error.name.name.toLowerCase();
    const errorWhen = error.when?.value?.toLowerCase() || '';

    // Match by field name in error name
    if (errorName.includes(fieldLower)) {
      return error;
    }

    // Match by validation reason
    if (reasonLower.includes('invalid') && errorName.includes('invalid')) {
      return error;
    }

    // Match specific patterns
    if (fieldLower === 'email' && (errorName.includes('email') || errorWhen.includes('email'))) {
      return error;
    }
    if (fieldLower === 'password' && (errorName.includes('password') || errorWhen.includes('password'))) {
      return error;
    }
    if (fieldLower === 'username' && (errorName.includes('username') || errorWhen.includes('username'))) {
      return error;
    }
  }

  return undefined;
}

// ============================================================================
// PRECONDITION VIOLATION GENERATION
// ============================================================================

function generatePreconditionViolations(
  behavior: AST.Behavior,
  domain: AST.Domain,
  constraintMap: Map<string, TypeConstraints>,
  rng: SeededRandom,
  seed: number,
  _maxInputs: number
): SynthesizedInput[] {
  const inputs: SynthesizedInput[] = [];
  const inputSpec = behavior.input;
  const constraintSummaries = buildConstraintSummaries(inputSpec, constraintMap);

  for (let i = 0; i < behavior.preconditions.length; i++) {
    const precondition = behavior.preconditions[i]!;
    const violation = generatePreconditionViolation(precondition, inputSpec, domain, constraintMap, rng);

    if (violation) {
      inputs.push({
        category: 'precondition_violation',
        name: `precondition_violation_${i + 1}`,
        description: `Violates precondition: ${expressionToString(precondition)}`,
        values: violation.values,
        dataTrace: {
          seed,
          constraints: constraintSummaries,
          generatedAt: new Date().toISOString(),
          strategy: `precondition_violation_${violation.strategy}`,
        },
        expectedOutcome: {
          type: 'error',
          assertions: [
            'result.success === false',
            `// Precondition violated: ${expressionToString(precondition)}`,
          ],
        },
      });
    }
  }

  return inputs;
}

interface ViolationResult {
  values: Record<string, unknown>;
  strategy: string;
}

function generatePreconditionViolation(
  precondition: AST.Expression,
  inputSpec: AST.InputSpec,
  domain: AST.Domain,
  constraintMap: Map<string, TypeConstraints>,
  rng: SeededRandom
): ViolationResult | null {
  const values: Record<string, unknown> = {};

  // First, fill all fields with valid values
  for (const field of inputSpec.fields) {
    if (!field.optional) {
      values[field.name.name] = generateTypicalValue(
        field.type, constraintMap.get(field.name.name) || {}, domain, rng
      );
    }
  }

  // Then, analyze the precondition and create a violating value
  const violation = analyzeAndViolate(precondition, values, inputSpec);

  if (violation) {
    return { values: violation.values, strategy: violation.strategy };
  }

  return null;
}

function analyzeAndViolate(
  expr: AST.Expression,
  baseValues: Record<string, unknown>,
  inputSpec: AST.InputSpec
): ViolationResult | null {
  switch (expr.kind) {
    case 'BinaryExpr': {
      // Handle comparisons like `input.amount > 0`
      const { left, operator, right } = expr;

      // Extract field reference
      const fieldName = extractFieldName(left);
      if (!fieldName) return null;

      // Get the comparison value
      const compValue = extractLiteralValue(right);
      if (compValue === undefined) return null;

      // Create violating value based on operator
      const violatingValue = createViolatingValue(operator, compValue);
      if (violatingValue === undefined) return null;

      const values = { ...baseValues };
      values[fieldName] = violatingValue;

      return {
        values,
        strategy: `${operator}_violation`,
      };
    }

    case 'MemberExpr': {
      // Handle `email.is_valid_format` style
      const fieldName = extractFieldName(expr);
      if (!fieldName) return null;

      const values = { ...baseValues };
      // Create an invalid value for the field
      const field = inputSpec.fields.find(f => f.name.name === fieldName);
      if (field) {
        values[fieldName] = createInvalidValue(field.type);
      }

      return {
        values,
        strategy: 'format_violation',
      };
    }

    case 'InputExpr': {
      // Handle direct input.field references
      const fieldName = expr.property.name;
      const values = { ...baseValues };
      const field = inputSpec.fields.find(f => f.name.name === fieldName);
      if (field) {
        values[fieldName] = createInvalidValue(field.type);
      }

      return {
        values,
        strategy: 'direct_violation',
      };
    }

    case 'CallExpr': {
      // Handle `Entity.exists(...)` - create input for non-existing entity
      const values = { ...baseValues };
      // Use a non-existing ID
      const args = expr.arguments;
      if (args.length > 0) {
        const fieldName = extractFieldName(args[0]!);
        if (fieldName) {
          values[fieldName] = '00000000-0000-0000-0000-000000000000';
        }
      }

      return {
        values,
        strategy: 'entity_not_exists',
      };
    }

    case 'UnaryExpr': {
      if (expr.operator === 'not') {
        // For `not X`, we need to make X true
        // This is complex - skip for now
        return null;
      }
      break;
    }
  }

  return null;
}

function extractFieldName(expr: AST.Expression): string | null {
  switch (expr.kind) {
    case 'InputExpr':
      return expr.property.name;
    case 'MemberExpr':
      if (expr.object.kind === 'InputExpr') {
        return expr.object.property.name;
      }
      if (expr.object.kind === 'Identifier' && expr.object.name === 'input') {
        return expr.property.name;
      }
      return extractFieldName(expr.object);
    case 'Identifier':
      return expr.name;
    default:
      return null;
  }
}

function extractLiteralValue(expr: AST.Expression): number | string | boolean | undefined {
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

function createViolatingValue(
  operator: AST.BinaryOperator,
  compValue: number | string | boolean
): unknown {
  if (typeof compValue === 'number') {
    switch (operator) {
      case '>':
        return compValue; // Equal to, not greater than
      case '>=':
        return compValue - 1; // Less than
      case '<':
        return compValue; // Equal to, not less than
      case '<=':
        return compValue + 1; // Greater than
      case '==':
        return compValue + 1; // Not equal
      case '!=':
        return compValue; // Equal (violates !=)
    }
  }

  if (typeof compValue === 'string') {
    switch (operator) {
      case '==':
        return compValue + '_different';
      case '!=':
        return compValue;
    }
  }

  if (typeof compValue === 'boolean') {
    return !compValue;
  }

  return undefined;
}

function createInvalidValue(type: AST.TypeDefinition): unknown {
  const baseType = getBaseTypeName(type);

  switch (baseType) {
    case 'String':
      return ''; // Empty string often invalid
    case 'Int':
      return -999999; // Large negative
    case 'Decimal':
      return -999999.99;
    case 'UUID':
      return 'invalid-uuid';
    case 'Boolean':
      return 'not_a_boolean';
    case 'Timestamp':
      return 'invalid-timestamp';
    default:
      return null;
  }
}

// ============================================================================
// VALUE GENERATION HELPERS
// ============================================================================

function generateTypicalValue(
  type: AST.TypeDefinition,
  constraints: TypeConstraints,
  domain: AST.Domain,
  rng: SeededRandom
): unknown {
  const baseType = getBaseTypeName(type);

  switch (baseType) {
    case 'String':
      // Check for pattern constraint first
      if (constraints.pattern) {
        return generateStringFromPattern(constraints.pattern, rng, constraints);
      }
      // Check for format-based generation
      if (constraints.format && FORMAT_GENERATORS[constraints.format]) {
        return FORMAT_GENERATORS[constraints.format]!(rng, constraints.maxLength);
      }
      return generateTypicalString(constraints, rng);

    case 'Int': {
      const min = constraints.min ?? 1;
      const max = constraints.max ?? 100;
      return Math.floor((min + max) / 2); // Midpoint
    }

    case 'Decimal': {
      const min = constraints.min ?? 1;
      const max = constraints.max ?? 100;
      const precision = constraints.precision ?? 2;
      return Number(((min + max) / 2).toFixed(precision));
    }

    case 'Boolean':
      return true;

    case 'UUID':
      return generateDeterministicUUID(rng);

    case 'Timestamp':
      return new Date().toISOString();

    case 'Duration':
      return 1000;

    default:
      // Handle complex types
      if (type.kind === 'EnumType' && type.variants.length > 0) {
        return type.variants[0]!.name.name;
      }
      if (type.kind === 'StructType') {
        return generateStructValue(type, domain, rng);
      }
      if (type.kind === 'ListType') {
        return generateArrayValue(type.element, constraints, domain, rng, 'typical');
      }
      if (type.kind === 'MapType') {
        return {};
      }
      if (type.kind === 'ReferenceType') {
        const refName = type.name.parts.map(p => p.name).join('.');
        const typeDef = domain.types.find(t => t.name.name === refName);
        if (typeDef) {
          return generateTypicalValue(typeDef.definition, constraints, domain, rng);
        }
        // Assume entity reference
        return generateDeterministicUUID(rng);
      }
      return null;
  }
}

function generateRandomValidValue(
  type: AST.TypeDefinition,
  constraints: TypeConstraints,
  domain: AST.Domain,
  rng: SeededRandom
): unknown {
  const baseType = getBaseTypeName(type);

  switch (baseType) {
    case 'String':
      return generateRandomString(constraints, rng);

    case 'Int': {
      const min = constraints.min ?? 1;
      const max = constraints.max ?? 100;
      return rng.int(min, max);
    }

    case 'Decimal': {
      const min = constraints.min ?? 1;
      const max = constraints.max ?? 100;
      const precision = constraints.precision ?? 2;
      return Number(rng.float(min, max).toFixed(precision));
    }

    case 'Boolean':
      return rng.next() > 0.5;

    case 'UUID':
      return generateDeterministicUUID(rng);

    case 'Timestamp':
      // Random time in last 30 days
      const now = Date.now();
      const randomOffset = rng.int(0, 30 * 24 * 60 * 60 * 1000);
      return new Date(now - randomOffset).toISOString();

    default:
      return generateTypicalValue(type, constraints, domain, rng);
  }
}

function generateTypicalString(constraints: TypeConstraints, rng: SeededRandom): string {
  if (constraints.format === 'email') {
    const user = rng.string(8, 'abcdefghijklmnopqrstuvwxyz');
    return `${user}@example.com`;
  }

  const minLen = constraints.minLength ?? 1;
  const maxLen = constraints.maxLength ?? 50;
  const targetLen = Math.min(minLen + 10, maxLen);

  return 'test_' + rng.string(Math.max(0, targetLen - 5));
}

function generateRandomString(constraints: TypeConstraints, rng: SeededRandom): string {
  if (constraints.format === 'email') {
    const user = rng.string(rng.int(5, 12), 'abcdefghijklmnopqrstuvwxyz0123456789');
    const domains = ['example.com', 'test.org', 'mail.net', 'demo.io'];
    return `${user}@${rng.pick(domains)}`;
  }

  const minLen = constraints.minLength ?? 1;
  const maxLen = constraints.maxLength ?? 50;
  const targetLen = rng.int(minLen, Math.min(maxLen, minLen + 20));

  return rng.string(targetLen);
}

function generateStringOfLength(length: number, format?: string): string {
  if (format === 'email') {
    // For email, we need to generate a valid email of approximately this length
    const localPartLen = Math.max(1, length - 12); // "@example.com" is 12 chars
    return 'a'.repeat(localPartLen) + '@example.com';
  }

  return 'a'.repeat(length);
}

// ============================================================================
// COLLECTION/ARRAY GENERATION
// ============================================================================

/**
 * Generate array values respecting constraints
 */
function generateArrayValue(
  elementType: AST.TypeDefinition,
  constraints: TypeConstraints,
  domain: AST.Domain,
  rng: SeededRandom,
  category: 'typical' | 'boundary' | 'invalid' = 'typical'
): unknown[] {
  const minItems = constraints.minItems ?? 0;
  const maxItems = constraints.maxItems ?? 10;

  let count: number;
  switch (category) {
    case 'boundary':
      // Boundary: try min or max
      count = rng.next() > 0.5 ? minItems : Math.min(maxItems, minItems + 3);
      break;
    case 'invalid':
      // Invalid: below min or above max
      count = rng.next() > 0.5 ? Math.max(0, minItems - 1) : maxItems + 1;
      break;
    default:
      // Typical: between min and max
      count = rng.int(minItems, Math.min(maxItems, minItems + 5));
  }

  const result: unknown[] = [];
  const usedValues = new Set<string>();

  for (let i = 0; i < count; i++) {
    let value = generateTypicalValue(elementType, {}, domain, rng);
    
    // Handle uniqueItems constraint
    if (constraints.uniqueItems && typeof value === 'string') {
      let attempts = 0;
      while (usedValues.has(String(value)) && attempts < 10) {
        value = generateRandomValidValue(elementType, {}, domain, rng);
        attempts++;
      }
      usedValues.add(String(value));
    }
    
    result.push(value);
  }

  return result;
}

/**
 * Generate boundary values for arrays
 */
function generateArrayBoundaryValues(
  elementType: AST.TypeDefinition,
  constraints: TypeConstraints,
  domain: AST.Domain,
  rng: SeededRandom
): BoundaryValue[] {
  const values: BoundaryValue[] = [];
  const minItems = constraints.minItems ?? 0;
  const maxItems = constraints.maxItems ?? 10;

  // Empty array (if allowed)
  if (minItems === 0) {
    values.push({
      name: 'empty_array',
      value: [],
      description: 'empty array',
    });
  }

  // Minimum items
  if (minItems > 0) {
    values.push({
      name: 'at_min_items',
      value: generateArrayValue(elementType, { ...constraints }, domain, rng, 'boundary').slice(0, minItems),
      description: `minimum items (${minItems})`,
    });
  }

  // Maximum items
  values.push({
    name: 'at_max_items',
    value: generateArrayValue(elementType, { maxItems }, domain, rng, 'boundary'),
    description: `maximum items (${maxItems})`,
  });

  // Single item
  if (minItems <= 1) {
    values.push({
      name: 'single_item',
      value: [generateTypicalValue(elementType, {}, domain, rng)],
      description: 'single item array',
    });
  }

  return values;
}

// ============================================================================
// PATTERN-BASED STRING GENERATION
// ============================================================================

/** Common patterns for format-based generation */
const FORMAT_GENERATORS: Record<string, (rng: SeededRandom, length?: number) => string> = {
  email: (rng, _length) => {
    const user = rng.string(rng.int(5, 12), 'abcdefghijklmnopqrstuvwxyz0123456789');
    const domains = ['example.com', 'test.org', 'mail.net', 'demo.io'];
    return `${user}@${rng.pick(domains)}`;
  },
  uuid: (rng) => generateDeterministicUUID(rng),
  url: (rng, _length) => {
    const protocol = rng.pick(['http', 'https']);
    const domain = rng.string(rng.int(5, 10), 'abcdefghijklmnopqrstuvwxyz');
    const tld = rng.pick(['com', 'org', 'net', 'io']);
    return `${protocol}://${domain}.${tld}`;
  },
  phone: (rng) => {
    const areaCode = rng.int(200, 999);
    const exchange = rng.int(200, 999);
    const subscriber = rng.int(1000, 9999);
    return `+1${areaCode}${exchange}${subscriber}`;
  },
  date: () => {
    const now = new Date();
    return now.toISOString().split('T')[0]!;
  },
  'date-time': () => new Date().toISOString(),
  time: () => {
    const now = new Date();
    return now.toISOString().split('T')[1]!.split('.')[0]!;
  },
  ipv4: (rng) => {
    return `${rng.int(1, 255)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`;
  },
  ipv6: (rng) => {
    const segments = [];
    for (let i = 0; i < 8; i++) {
      segments.push(rng.int(0, 65535).toString(16).padStart(4, '0'));
    }
    return segments.join(':');
  },
  hostname: (rng) => {
    const name = rng.string(rng.int(5, 10), 'abcdefghijklmnopqrstuvwxyz');
    const tld = rng.pick(['com', 'org', 'net', 'io']);
    return `${name}.${tld}`;
  },
  slug: (rng, length) => {
    const len = length ?? rng.int(5, 20);
    return rng.string(len, 'abcdefghijklmnopqrstuvwxyz0123456789-');
  },
  credit_card: (rng) => {
    // Luhn-valid test card number (starts with 4 for Visa)
    const prefix = '4111';
    const middle = rng.string(11, '0123456789');
    const partial = prefix + middle;
    // Calculate Luhn check digit
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      let digit = parseInt(partial[i]!, 10);
      if (i % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return partial + checkDigit;
  },
  cvv: (rng) => rng.string(3, '0123456789'),
};

/**
 * Generate string from pattern (regex)
 * Simple implementation for common patterns
 */
function generateStringFromPattern(
  pattern: RegExp | string,
  rng: SeededRandom,
  constraints: TypeConstraints
): string {
  const patternStr = typeof pattern === 'string' ? pattern : pattern.source;
  
  // Handle simple patterns
  if (patternStr === '^[a-z]+$' || patternStr === '[a-z]+') {
    const length = constraints.maxLength ?? 10;
    return rng.string(Math.min(length, rng.int(3, 15)), 'abcdefghijklmnopqrstuvwxyz');
  }
  
  if (patternStr === '^[A-Z]+$' || patternStr === '[A-Z]+') {
    const length = constraints.maxLength ?? 10;
    return rng.string(Math.min(length, rng.int(3, 15)), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  }
  
  if (patternStr === '^[a-zA-Z]+$' || patternStr === '[a-zA-Z]+') {
    const length = constraints.maxLength ?? 10;
    return rng.string(Math.min(length, rng.int(3, 15)), 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
  }
  
  if (patternStr === '^[0-9]+$' || patternStr === '[0-9]+' || patternStr === '^\\d+$') {
    const length = constraints.maxLength ?? 10;
    return rng.string(Math.min(length, rng.int(1, 10)), '0123456789');
  }
  
  if (patternStr.includes('[a-zA-Z0-9]')) {
    const length = constraints.maxLength ?? 10;
    return rng.string(Math.min(length, rng.int(5, 15)), 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
  }

  // UUID pattern
  if (patternStr.includes('[0-9a-f]{8}') || patternStr.includes('uuid')) {
    return generateDeterministicUUID(rng);
  }

  // Fallback: generate alphanumeric
  const length = constraints.maxLength ?? 10;
  return rng.string(Math.min(length, 10), 'abcdefghijklmnopqrstuvwxyz0123456789');
}

function generateStructValue(
  type: AST.StructType,
  domain: AST.Domain,
  rng: SeededRandom
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of type.fields) {
    if (!field.optional) {
      result[field.name.name] = generateTypicalValue(field.type, {}, domain, rng);
    }
  }

  return result;
}

function generateDeterministicUUID(rng: SeededRandom): string {
  const hex = '0123456789abcdef';
  let uuid = '';

  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // Version 4
    } else if (i === 19) {
      uuid += hex[rng.int(8, 11)]; // Variant
    } else {
      uuid += hex[rng.int(0, 15)];
    }
  }

  return uuid;
}

function getBaseTypeName(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return type.name;
    case 'ConstrainedType':
      return getBaseTypeName(type.base);
    case 'ReferenceType':
      return type.name.parts.map(p => p.name).join('.');
    case 'OptionalType':
      return getBaseTypeName(type.inner);
    default:
      return type.kind;
  }
}

// ============================================================================
// DATA TRACE HELPERS
// ============================================================================

function buildConstraintSummaries(
  inputSpec: AST.InputSpec,
  constraintMap: Map<string, TypeConstraints>
): ConstraintSummary[] {
  const summaries: ConstraintSummary[] = [];

  for (const field of inputSpec.fields) {
    const constraints = constraintMap.get(field.name.name) || {};
    const constraintStrs: string[] = [];

    if (constraints.min !== undefined) constraintStrs.push(`min: ${constraints.min}`);
    if (constraints.max !== undefined) constraintStrs.push(`max: ${constraints.max}`);
    if (constraints.minLength !== undefined) constraintStrs.push(`minLength: ${constraints.minLength}`);
    if (constraints.maxLength !== undefined) constraintStrs.push(`maxLength: ${constraints.maxLength}`);
    if (constraints.format) constraintStrs.push(`format: ${constraints.format}`);
    if (constraints.precision !== undefined) constraintStrs.push(`precision: ${constraints.precision}`);

    summaries.push({
      field: field.name.name,
      type: getBaseTypeName(field.type),
      constraints: constraintStrs,
    });
  }

  return summaries;
}

function expressionToString(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'StringLiteral':
      return `"${expr.value}"`;
    case 'NumberLiteral':
      return String(expr.value);
    case 'BooleanLiteral':
      return String(expr.value);
    case 'MemberExpr':
      return `${expressionToString(expr.object)}.${expr.property.name}`;
    case 'InputExpr':
      return `input.${expr.property.name}`;
    case 'BinaryExpr':
      return `${expressionToString(expr.left)} ${expr.operator} ${expressionToString(expr.right)}`;
    case 'CallExpr':
      return `${expressionToString(expr.callee)}(...)`;
    default:
      return expr.kind;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SeededRandom,
  extractConstraints,
  generateTypicalValue,
  generateRandomValidValue,
  generateBoundaryValuesForField,
  generateInvalidValuesForField,
  generateArrayValue,
  generateArrayBoundaryValues,
  generateStringFromPattern,
  extractCrossFieldConstraints,
  applyCrossFieldConstraints,
  FORMAT_GENERATORS,
};
