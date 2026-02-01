/**
 * Validators - ISL-compatible validation utilities
 */
import { z } from 'zod';
import type { ValidationResult, ValidationError } from '../types';

/**
 * Create a validator from a Zod schema
 */
export function createValidator<T>(
  schema: z.ZodSchema<T>
): (input: unknown) => ValidationResult {
  return (input: unknown): ValidationResult => {
    const result = schema.safeParse(input);
    
    if (result.success) {
      return { valid: true };
    }
    
    return {
      valid: false,
      errors: result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  };
}

/**
 * Combine multiple validators
 */
export function combineValidators(
  ...validators: ((input: unknown) => ValidationResult)[]
): (input: unknown) => ValidationResult {
  return (input: unknown): ValidationResult => {
    const errors: ValidationError[] = [];
    
    for (const validator of validators) {
      const result = validator(input);
      if (!result.valid && result.errors) {
        errors.push(...result.errors);
      }
    }
    
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    
    return { valid: true };
  };
}

/**
 * Create a conditional validator
 */
export function conditionalValidator<T>(
  condition: (input: T) => boolean,
  validator: (input: T) => ValidationResult,
  message?: string
): (input: T) => ValidationResult {
  return (input: T): ValidationResult => {
    if (!condition(input)) {
      return { valid: true };
    }
    
    const result = validator(input);
    if (!result.valid && message) {
      return {
        valid: false,
        errors: [{ field: '', message, code: 'CONDITIONAL' }],
      };
    }
    
    return result;
  };
}

// Common ISL-compatible schemas
export const Schemas = {
  // String types
  Email: z.string().email().max(254),
  Username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  Password: z.string().min(8).max(128),
  UUID: z.string().uuid(),
  URL: z.string().url(),
  Phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  
  // Number types
  PositiveInt: z.number().int().positive(),
  NonNegativeInt: z.number().int().nonnegative(),
  Percentage: z.number().min(0).max(100),
  Currency: z.number().multipleOf(0.01),
  
  // Date types
  ISODate: z.string().datetime(),
  DateString: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  
  // Common patterns
  Slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  Hex: z.string().regex(/^[0-9a-fA-F]+$/),
  Base64: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/),
  
  // Pagination
  PageSize: z.number().int().min(1).max(100).default(20),
  PageNumber: z.number().int().min(1).default(1),
  Cursor: z.string().optional(),
  
  // Common entities
  Pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  
  CursorPagination: z.object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  
  SortOrder: z.enum(['asc', 'desc']).default('desc'),
};

// Validation helpers
export const Validators = {
  /**
   * Check if value is not empty
   */
  required: (value: unknown): ValidationResult => {
    if (value === null || value === undefined || value === '') {
      return {
        valid: false,
        errors: [{ field: '', message: 'This field is required', code: 'REQUIRED' }],
      };
    }
    return { valid: true };
  },

  /**
   * Check string length
   */
  length: (min: number, max: number) => (value: string): ValidationResult => {
    if (value.length < min) {
      return {
        valid: false,
        errors: [{ field: '', message: `Must be at least ${min} characters`, code: 'MIN_LENGTH' }],
      };
    }
    if (value.length > max) {
      return {
        valid: false,
        errors: [{ field: '', message: `Must be at most ${max} characters`, code: 'MAX_LENGTH' }],
      };
    }
    return { valid: true };
  },

  /**
   * Check if matches regex
   */
  pattern: (regex: RegExp, message: string) => (value: string): ValidationResult => {
    if (!regex.test(value)) {
      return {
        valid: false,
        errors: [{ field: '', message, code: 'PATTERN' }],
      };
    }
    return { valid: true };
  },

  /**
   * Check number range
   */
  range: (min: number, max: number) => (value: number): ValidationResult => {
    if (value < min || value > max) {
      return {
        valid: false,
        errors: [{ field: '', message: `Must be between ${min} and ${max}`, code: 'RANGE' }],
      };
    }
    return { valid: true };
  },

  /**
   * Check array length
   */
  arrayLength: (min: number, max: number) => (value: unknown[]): ValidationResult => {
    if (value.length < min) {
      return {
        valid: false,
        errors: [{ field: '', message: `Must have at least ${min} items`, code: 'MIN_ITEMS' }],
      };
    }
    if (value.length > max) {
      return {
        valid: false,
        errors: [{ field: '', message: `Must have at most ${max} items`, code: 'MAX_ITEMS' }],
      };
    }
    return { valid: true };
  },

  /**
   * Check if value is one of allowed values
   */
  oneOf: <T>(allowed: T[]) => (value: T): ValidationResult => {
    if (!allowed.includes(value)) {
      return {
        valid: false,
        errors: [{ field: '', message: `Must be one of: ${allowed.join(', ')}`, code: 'ONE_OF' }],
      };
    }
    return { valid: true };
  },

  /**
   * Custom validation function
   */
  custom: <T>(
    fn: (value: T) => boolean,
    message: string
  ) => (value: T): ValidationResult => {
    if (!fn(value)) {
      return {
        valid: false,
        errors: [{ field: '', message, code: 'CUSTOM' }],
      };
    }
    return { valid: true };
  },
};

/**
 * Validate object against schema
 */
export function validateObject<T extends Record<string, unknown>>(
  obj: T,
  validators: { [K in keyof T]?: (value: T[K]) => ValidationResult }
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [field, validator] of Object.entries(validators)) {
    if (validator) {
      const result = validator(obj[field as keyof T]);
      if (!result.valid && result.errors) {
        errors.push(
          ...result.errors.map(err => ({
            ...err,
            field: err.field ? `${field}.${err.field}` : field,
          }))
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
