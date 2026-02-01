/**
 * Client-side Validation utilities
 */
import { z } from 'zod';
import type { ValidationResult } from './types';

/**
 * Create validator from Zod schema
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
      })),
    };
  };
}

/**
 * Common validation schemas
 */
export const Schemas = {
  email: z.string().email(),
  uuid: z.string().uuid(),
  url: z.string().url(),
  password: z.string().min(8).max(128),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  positiveInt: z.number().int().positive(),
  nonNegativeInt: z.number().int().nonnegative(),
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  sortOrder: z.enum(['asc', 'desc']),
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
};

/**
 * Validation helpers
 */
export const validators = {
  required: (value: unknown): boolean => value !== null && value !== undefined && value !== '',
  minLength: (min: number) => (value: string): boolean => value.length >= min,
  maxLength: (max: number) => (value: string): boolean => value.length <= max,
  range: (min: number, max: number) => (value: number): boolean => value >= min && value <= max,
  pattern: (regex: RegExp) => (value: string): boolean => regex.test(value),
  oneOf: <T>(options: T[]) => (value: T): boolean => options.includes(value),
};

/**
 * Combine multiple validators
 */
export function combineValidators(
  ...fns: ((input: unknown) => ValidationResult)[]
): (input: unknown) => ValidationResult {
  return (input: unknown): ValidationResult => {
    const errors: { field: string; message: string }[] = [];
    
    for (const fn of fns) {
      const result = fn(input);
      if (!result.valid && result.errors) {
        errors.push(...result.errors);
      }
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true };
  };
}
