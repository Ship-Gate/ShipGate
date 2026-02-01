/**
 * Input Validation Generator - Generate validation from ISL constraints.
 */

import type { Field, Constraint } from '../types/ast';

/**
 * Generate validation code for GraphQL inputs
 */
export function generateInputValidation(
  inputName: string,
  fields: readonly Field[]
): string {
  const lines: string[] = [];

  lines.push(`export function validate${inputName}(input: ${inputName}): ValidationResult {`);
  lines.push('  const errors: ValidationError[] = [];');
  lines.push('');

  for (const field of fields) {
    const fieldValidation = generateFieldValidation(field);
    if (fieldValidation) {
      lines.push(fieldValidation);
      lines.push('');
    }
  }

  lines.push('  return {');
  lines.push('    valid: errors.length === 0,');
  lines.push('    errors,');
  lines.push('  };');
  lines.push('}');

  return lines.join('\n');
}

function generateFieldValidation(field: Field): string | null {
  const lines: string[] = [];
  const fieldName = field.name;
  const constraints = field.constraints ?? [];

  // Add null check for required fields
  if (!field.optional) {
    lines.push(`  if (input.${fieldName} === null || input.${fieldName} === undefined) {`);
    lines.push(`    errors.push({ field: '${fieldName}', message: '${fieldName} is required' });`);
    lines.push('  } else {');
  }

  // Generate constraint checks
  for (const constraint of constraints) {
    const check = generateConstraintCheck(fieldName, constraint);
    if (check) {
      lines.push(check);
    }
  }

  // Add type-specific validation
  const typeValidation = generateTypeValidation(fieldName, field.type);
  if (typeValidation) {
    lines.push(typeValidation);
  }

  if (!field.optional) {
    lines.push('  }');
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function generateConstraintCheck(fieldName: string, constraint: Constraint): string | null {
  const expr = constraint.expression;
  const message = constraint.message ?? `Constraint violated: ${expr}`;

  // Parse common constraint patterns
  if (expr.includes('length >=')) {
    const match = expr.match(/length >= (\d+)/);
    if (match) {
      return `    if (input.${fieldName}.length < ${match[1]}) {
      errors.push({ field: '${fieldName}', message: '${message}' });
    }`;
    }
  }

  if (expr.includes('length <=')) {
    const match = expr.match(/length <= (\d+)/);
    if (match) {
      return `    if (input.${fieldName}.length > ${match[1]}) {
      errors.push({ field: '${fieldName}', message: '${message}' });
    }`;
    }
  }

  if (expr.includes('>=')) {
    const match = expr.match(/>= (\d+)/);
    if (match) {
      return `    if (input.${fieldName} < ${match[1]}) {
      errors.push({ field: '${fieldName}', message: '${message}' });
    }`;
    }
  }

  if (expr.includes('<=')) {
    const match = expr.match(/<= (\d+)/);
    if (match) {
      return `    if (input.${fieldName} > ${match[1]}) {
      errors.push({ field: '${fieldName}', message: '${message}' });
    }`;
    }
  }

  if (expr.includes('matches')) {
    const match = expr.match(/matches "(.+)"/);
    if (match) {
      return `    if (!/${match[1]}/.test(input.${fieldName})) {
      errors.push({ field: '${fieldName}', message: '${message}' });
    }`;
    }
  }

  return null;
}

function generateTypeValidation(fieldName: string, type: string): string | null {
  switch (type) {
    case 'Email':
      return `    if (!/^[^@]+@[^@]+\\.[^@]+$/.test(input.${fieldName})) {
      errors.push({ field: '${fieldName}', message: 'Invalid email format' });
    }`;

    case 'URL':
      return `    try {
      new URL(input.${fieldName});
    } catch {
      errors.push({ field: '${fieldName}', message: 'Invalid URL format' });
    }`;

    case 'UUID':
      return `    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.${fieldName})) {
      errors.push({ field: '${fieldName}', message: 'Invalid UUID format' });
    }`;

    default:
      return null;
  }
}

/**
 * Validation result type
 */
export const validationTypes = `
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code?: string;
}

export function isValid(result: ValidationResult): result is { valid: true; errors: [] } {
  return result.valid;
}

export function getFirstError(result: ValidationResult): ValidationError | undefined {
  return result.errors[0];
}

export function getFieldErrors(result: ValidationResult, field: string): readonly ValidationError[] {
  return result.errors.filter(e => e.field === field);
}
`;

/**
 * Generate validation middleware for GraphQL
 */
export function generateValidationMiddleware(): string {
  return `
import { GraphQLError } from 'graphql';

export function withValidation<TArgs, TResult>(
  validator: (args: TArgs) => ValidationResult,
  resolver: (args: TArgs) => Promise<TResult>
) {
  return async (parent: unknown, args: TArgs, context: unknown, info: unknown) => {
    const result = validator(args);
    
    if (!result.valid) {
      throw new GraphQLError('Validation failed', {
        extensions: {
          code: 'BAD_USER_INPUT',
          errors: result.errors,
        },
      });
    }
    
    return resolver(args);
  };
}
`.trim();
}
