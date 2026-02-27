// ============================================================================
// Validation Analyzer - Completeness and quality checks
// ============================================================================

import type {
  ValidationSchema,
  ValidationField,
  ConstraintQuality,
  Finding,
} from './types.js';

/**
 * Check completeness of validation
 * Returns fields that are accessed but not validated
 */
export function checkCompleteness(
  validatedFields: string[],
  accessedFields: string[]
): string[] {
  const validatedSet = new Set(validatedFields);
  return accessedFields.filter(field => !validatedSet.has(field));
}

/**
 * Analyze constraint quality of validation schema
 */
export function analyzeConstraintQuality(schema: ValidationSchema | null): ConstraintQuality {
  if (!schema || schema.fields.length === 0) {
    return 'none';
  }

  let strictCount = 0;
  let basicCount = 0;
  let minimalCount = 0;

  for (const field of schema.fields) {
    const quality = analyzeFieldConstraints(field);
    if (quality === 'strict') strictCount++;
    else if (quality === 'basic') basicCount++;
    else if (quality === 'minimal') minimalCount++;
  }

  // Overall quality based on field distribution
  const totalFields = schema.fields.length;
  const strictRatio = strictCount / totalFields;
  const basicRatio = basicCount / totalFields;

  if (strictRatio >= 0.7) return 'strict';
  if (strictRatio + basicRatio >= 0.7) return 'basic';
  if (minimalCount > 0) return 'minimal';
  return 'none';
}

/**
 * Analyze constraints on a single field
 */
function analyzeFieldConstraints(field: ValidationField): ConstraintQuality {
  const constraints = field.constraints;

  // Count constraint types
  let constraintCount = 0;

  if (constraints.required) constraintCount++;
  if (constraints.minLength !== undefined) constraintCount++;
  if (constraints.maxLength !== undefined) constraintCount++;
  if (constraints.min !== undefined) constraintCount++;
  if (constraints.max !== undefined) constraintCount++;
  if (constraints.pattern !== undefined) constraintCount++;
  if (constraints.format !== undefined) constraintCount++;
  if (constraints.enum !== undefined) constraintCount++;
  if (constraints.nested && constraints.nested.length > 0) constraintCount++;

  // Strict: 3+ constraints including format/pattern/enum, or nested validation
  if (constraintCount >= 3 && (constraints.format || constraints.pattern || constraints.enum || constraints.nested)) {
    return 'strict';
  }

  // Basic: 2+ constraints including length/range bounds
  if (constraintCount >= 2 && (
    constraints.minLength !== undefined ||
    constraints.maxLength !== undefined ||
    constraints.min !== undefined ||
    constraints.max !== undefined
  )) {
    return 'basic';
  }

  // Minimal: only required or single constraint
  if (constraintCount >= 1) {
    return 'minimal';
  }

  return 'none';
}

/**
 * Check if validation result is actually used
 */
export function isValidationResultUsed(code: string, schema: ValidationSchema | null): boolean {
  if (!schema) return false;
  return schema.isUsed;
}

/**
 * Generate findings based on validation analysis
 */
export function generateFindings(
  file: string,
  route: string,
  schema: ValidationSchema | null,
  unvalidatedFields: string[],
  validationBeforeLogic: boolean,
  accessedFields: string[]
): Finding[] {
  const findings: Finding[] = [];

  // No validation at all
  if (!schema && accessedFields.length > 0) {
    findings.push({
      file,
      line: 0,
      severity: 'error',
      route,
      message: `Endpoint "${route}" processes input without validation`,
      suggestion: 'Add input validation using Zod, Joi, Yup, or class-validator',
    });
  }

  // Validation exists but not used
  if (schema && !schema.isUsed) {
    findings.push({
      file,
      line: schema.line,
      severity: 'error',
      route,
      message: `Validation result is not used in "${route}"`,
      suggestion: 'Use the validated data object instead of raw request data',
    });
  }

  // Partial validation (some fields not validated)
  if (schema && unvalidatedFields.length > 0) {
    findings.push({
      file,
      line: schema.line,
      severity: 'warning',
      route,
      message: `Endpoint "${route}" accesses unvalidated fields: ${unvalidatedFields.join(', ')}`,
      suggestion: 'Add validation for all accessed fields',
    });
  }

  // Validation not before logic
  if (schema && !validationBeforeLogic) {
    findings.push({
      file,
      line: schema.line,
      severity: 'warning',
      route,
      message: `Validation in "${route}" occurs after business logic`,
      suggestion: 'Move validation to the beginning of the handler',
    });
  }

  // Weak constraints
  if (schema && analyzeConstraintQuality(schema) === 'minimal') {
    findings.push({
      file,
      line: schema.line,
      severity: 'info',
      route,
      message: `Validation in "${route}" has minimal constraints`,
      suggestion: 'Add length limits, format validation, or range constraints',
    });
  }

  // No constraints at all (just type checking)
  if (schema && analyzeConstraintQuality(schema) === 'none') {
    findings.push({
      file,
      line: schema.line,
      severity: 'warning',
      route,
      message: `Validation in "${route}" has no constraints`,
      suggestion: 'Add meaningful constraints to prevent invalid input',
    });
  }

  return findings;
}

/**
 * Calculate validation coverage percentage
 */
export function calculateCoverage(
  validatedFields: string[],
  accessedFields: string[]
): number {
  if (accessedFields.length === 0) return 100;
  const validatedSet = new Set(validatedFields);
  const validatedCount = accessedFields.filter(f => validatedSet.has(f)).length;
  return Math.round((validatedCount / accessedFields.length) * 100);
}

/**
 * Determine if endpoint accepts input
 */
export function acceptsInput(method: string): boolean {
  const methodsWithBody = ['POST', 'PUT', 'PATCH'];
  return methodsWithBody.includes(method.toUpperCase());
}

/**
 * Extract field names from validation schema
 */
export function extractValidatedFields(schema: ValidationSchema | null): string[] {
  if (!schema) return [];
  return schema.fields.map(f => f.name).sort();
}
